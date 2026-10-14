<script setup lang="ts">
  import type { RenewalApplication, RenewalApplicationListItem } from '@/modules/inspection/citizen/applications/types/application.types'
  import type { Vehicle } from '@/modules/inspection/citizen/vehicles/types/vehicle.types'
  import { useI18n } from 'vue-i18n'
  import heroPickup from '@/assets/inspection/vehicle-inspection-hero-pickup.png'
  import heroSuv from '@/assets/inspection/vehicle-inspection-hero-suv.png'
  import heroDefault from '@/assets/inspection/vehicle-inspection-hero.png'
  import { useInspectionAuthStore } from '@/modules/inspection/auth/stores/auth.store'
  import { inspectionApplicationService } from '@/modules/inspection/citizen/applications/services/application.service'
  import { citizenCardCycleForVehicle, citizenCardIdentifierLabel, resolveCitizenVehicleRenewalStatus } from '@/modules/inspection/citizen/applications/utils/citizen-application-status'
  import RenewalStartConfirmationDialog from '@/modules/inspection/citizen/renewal/components/RenewalStartConfirmationDialog.vue'
  import { useRenewalEntryFlow } from '@/modules/inspection/citizen/renewal/composables/use-renewal-entry-flow'
  import { findUnfinishedApplication, renewalEntryAction } from '@/modules/inspection/citizen/renewal/utils/renewal-entry-action'
  import CitizenVehicleCard from '@/modules/inspection/citizen/vehicles/components/CitizenVehicleCard.vue'
  import { inspectionVehicleService } from '@/modules/inspection/citizen/vehicles/services/vehicle.service'
  import { inspectionExpiryState, type InspectionExpiryState } from '@/modules/inspection/citizen/vehicles/utils/inspection-expiry-status'
  import { formatProvince } from '@/modules/inspection/citizen/vehicles/utils/province-label'
  import { sortCitizenVehicleCards } from '@/modules/inspection/citizen/vehicles/utils/vehicle-card-priority'
  import { getVehicleTypeIcon } from '@/modules/inspection/citizen/vehicles/utils/vehicle-type-icon'
  import { formatDisplayDate } from '@/modules/inspection/shared/utils/display-date'

  type IdleCallbackWindow = Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
    cancelIdleCallback?: (handle: number) => void
  }

  const { locale, t } = useI18n()
  const authStore = useInspectionAuthStore()
  const sessionCheckComplete = ref(false)
  const vehicles = ref<Vehicle[]>([])
  const applications = ref<RenewalApplicationListItem[]>([])
  const loadingVehicles = ref(false)
  const vehicleLoadError = ref(false)
  const renewalError = ref<string | null>(null)
  const heroBackgrounds = [heroDefault, heroSuv, heroPickup]
  const activeHeroBackground = ref(0)
  const currentHeroBackground = computed(() => heroBackgrounds[activeHeroBackground.value])
  let heroRotationTimer: ReturnType<typeof setInterval> | undefined
  let routePrefetchTimer: ReturnType<typeof setTimeout> | undefined
  let routePrefetchIdleCallback: number | undefined
  const visibleVehicles = computed(() => sortCitizenVehicleCards(vehicles.value, applications.value).slice(0, 3))
  const { confirmationLoading, confirmationOpen, confirmRenewal, isRenewingVehicle, startOrContinueRenewal } = useRenewalEntryFlow({
    onApplicationsLoaded: loaded => applications.value = loaded,
    onError: messageKey => renewalError.value = messageKey || null,
  })

  onMounted(async () => {
    startHeroRotation()
    await authStore.restoreSession()
    sessionCheckComplete.value = true

    if (!authStore.isCitizen) return

    await loadVehicles()
    scheduleCitizenRoutePrefetch()
  })

  onBeforeUnmount(() => {
    if (heroRotationTimer) clearInterval(heroRotationTimer)
    if (routePrefetchTimer) clearTimeout(routePrefetchTimer)
    if (routePrefetchIdleCallback !== undefined) (window as IdleCallbackWindow).cancelIdleCallback?.(routePrefetchIdleCallback)
  })

  function scheduleCitizenRoutePrefetch () {
    const idleWindow = window as IdleCallbackWindow
    const prefetch = () => {
      routePrefetchIdleCallback = undefined
      routePrefetchTimer = undefined

      void Promise.all([
        import('@/pages/services/inspection/vehicles/index.vue'),
        import('@/pages/services/inspection/renewal/documents.vue'),
      ]).catch(() => undefined)
    }

    if (idleWindow.requestIdleCallback !== undefined) {
      routePrefetchIdleCallback = idleWindow.requestIdleCallback(prefetch, { timeout: 3000 })
      return
    }

    routePrefetchTimer = window.setTimeout(prefetch, 0)
  }

  function startHeroRotation () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    heroRotationTimer = setInterval(() => {
      activeHeroBackground.value = (activeHeroBackground.value + 1) % heroBackgrounds.length
    }, 6000)
  }

  async function loadVehicles () {
    loadingVehicles.value = true
    vehicleLoadError.value = false
    try {
      const [vehicleResponse, citizenApplications] = await Promise.all([
        inspectionVehicleService.lookup({ sortBy: 'inspectionExpiryDate', sortOrder: 'asc' }),
        inspectionApplicationService.listCitizenApplications({ limit: 100, sortOrder: 'desc' }),
      ])
      vehicles.value = vehicleResponse.data
      applications.value = citizenApplications.data
    } catch {
      vehicleLoadError.value = true
    } finally {
      loadingVehicles.value = false
    }
  }

  function getInspectionState (vehicle: Vehicle): InspectionExpiryState {
    return inspectionExpiryState(vehicle.inspectionExpiryDate)
  }

  function getInspectionStateKey (vehicle: Vehicle) {
    return `inspection_dashboard_${getInspectionState(vehicle)}`
  }

  function getInspectionStateColor (vehicle: Vehicle): 'error' | 'warning' | 'success' {
    return ({ expired: 'error', expiring: 'warning', valid: 'success' } as const)[getInspectionState(vehicle)]
  }

  function formatInspectionDate (value: string) {
    return formatDisplayDate(value)
  }

  function formatVehicleModel (vehicle: Vehicle) {
    return [vehicle.make, vehicle.model, vehicle.manufactureYear].filter(Boolean).join(' ')
  }

  function plateTypeLabel (vehicle: Vehicle) {
    if (vehicle.plateCategory === 'PERSONALIZED_CAMBODIA') return t('inspection_plate_cambodia')
    return formatProvince(vehicle.plateProvince, locale.value)
  }

  function unfinishedApplication (vehicle: Vehicle): RenewalApplication | undefined {
    return findUnfinishedApplication(applications.value, vehicle.id)
  }

  function vehicleApplication (vehicle: Vehicle): RenewalApplicationListItem | undefined {
    return citizenCardCycleForVehicle(applications.value, vehicle.id)
  }

  function vehicleRenewalAction (vehicle: Vehicle) {
    return renewalEntryAction(unfinishedApplication(vehicle))
  }

  function vehicleRenewalStatus (vehicle: Vehicle) {
    return resolveCitizenVehicleRenewalStatus(vehicleApplication(vehicle), vehicle.inspectionExpiryDate)
  }

  function vehicleRenewalStatusPresentation (vehicle: Vehicle) {
    const status = vehicleRenewalStatus(vehicle)
    return status === undefined
      ? undefined
      : { ...status, label: t(status.labelKey), modifier: status.color }
  }

  function vehicleIdentifier (vehicle: Vehicle, identifier: 'certificate' | 'transaction') {
    return citizenCardIdentifierLabel(vehicleApplication(vehicle), identifier)
  }

  async function handleRenewalAction (vehicle: Vehicle) {
    await startOrContinueRenewal(vehicle)
  }
</script>

<template>
  <!-- eslint-disable vue/padding-line-between-tags -->
  <section class="citizen-auth-type-scale dashboard-view">
    <v-sheet class="dashboard-hero" rounded="xl">
      <Transition mode="out-in" name="dashboard-hero-fade">
        <div
          :key="activeHeroBackground"
          aria-hidden="true"
          class="dashboard-hero__background"
          :style="{ '--dashboard-hero-image': `url('${currentHeroBackground}')` }"
        />
      </Transition>

      <div class="dashboard-hero__content">
        <p class="dashboard-hero__eyebrow text-overline font-weight-bold mb-2">{{ $t('inspection_service_label') }}</p>
        <h1 class="dashboard-hero-title mb-3">{{ $t('inspection_dashboard_welcome') }}</h1>
        <p class="dashboard-hero-copy mb-5">{{ $t('inspection_dashboard_description') }}</p>

        <v-btn
          class="dashboard-hero__action"
          color="white"
          :prepend-icon="authStore.isCitizen ? 'mdi-car-arrow-right' : 'mdi-login'"
          rounded="pill"
          size="default"
          :to="authStore.isCitizen ? '/services/inspection/renewal' : { path: '/services/inspection/login', query: { redirect: '/services/inspection/dashboard' } }"
          variant="flat"
        >
          {{ authStore.isCitizen ? $t('inspection_dashboard_renewal_cta') : $t('inspection_sign_in') }}
        </v-btn>
      </div>
    </v-sheet>

    <template v-if="sessionCheckComplete && authStore.isCitizen">
      <v-alert
        v-if="renewalError"
        class="mt-4"
        density="compact"
        type="error"
        variant="tonal"
      >
        {{ $t(renewalError) }}
      </v-alert>

      <v-card
        border
        class="dashboard-notice pa-3 pa-md-4 mt-4"
        elevation="0"
        rounded="xl"
        to="/services/inspection/applications"
      >
        <div class="d-flex align-center justify-space-between ga-4">
          <div class="d-flex align-center ga-4">
            <v-avatar color="primary" icon="mdi-file-document-outline" size="56" variant="tonal" />

            <div>
              <h2 class="text-h6 font-weight-bold mb-1">{{ $t('inspection_dashboard_notice') }}</h2>
              <p class="text-body-1 text-medium-emphasis mb-0">{{ $t('inspection_dashboard_notice_description') }}</p>
            </div>
          </div>

          <v-icon icon="mdi-chevron-right" size="32" />
        </div>
      </v-card>

      <div class="d-flex flex-wrap align-center justify-space-between ga-3 mt-6 mb-3">
        <h2 class="dashboard-vehicles-heading text-h6">
          <v-icon icon="mdi-car-outline" size="26" />
          {{ $t('inspection_dashboard_vehicle_overview') }}
        </h2>

        <v-btn
          append-icon="mdi-chevron-right"
          class="dashboard-view-all"
          color="primary"
          to="/services/inspection/vehicles"
          variant="text"
        >{{ $t('inspection_dashboard_view_all') }}</v-btn>
      </div>

      <div v-if="loadingVehicles" class="py-10 text-center"><v-progress-circular color="primary" indeterminate /></div>
      <v-alert v-else-if="vehicleLoadError" type="error">{{ $t('inspection_dashboard_vehicle_load_error') }}</v-alert>
      <v-alert v-else-if="vehicles.length === 0" type="info">{{ $t('inspection_dashboard_no_vehicles') }}</v-alert>

      <div v-else class="vehicle-grid">
        <CitizenVehicleCard
          v-for="vehicle in visibleVehicles"
          :key="vehicle.id"
          :action-icon="vehicleRenewalAction(vehicle).icon"
          :action-label="$t(vehicleRenewalAction(vehicle).labelKey)"
          :action-loading="isRenewingVehicle(vehicle.id)"
          :certificate-number="vehicleIdentifier(vehicle, 'certificate')"
          :expiry-date="formatInspectionDate(vehicle.inspectionExpiryDate)"
          :has-certificate-number="Boolean(vehicleApplication(vehicle)?.certificate?.certificateNumber)"
          :has-transaction-number="Boolean(vehicleApplication(vehicle)?.payment?.transactionNumber)"
          :inspection-status="{ color: getInspectionStateColor(vehicle), label: $t(getInspectionStateKey(vehicle)), modifier: getInspectionState(vehicle) }"
          :plate-label="plateTypeLabel(vehicle)"
          :renewal-status="vehicleRenewalStatusPresentation(vehicle)"
          :transaction-number="vehicleIdentifier(vehicle, 'transaction')"
          :vehicle="vehicle"
          :vehicle-icon="getVehicleTypeIcon(vehicle.vehicleType)"
          :vehicle-name="formatVehicleModel(vehicle)"
          @renew="handleRenewalAction(vehicle)"
        />
      </div>
    </template>
    <RenewalStartConfirmationDialog v-model="confirmationOpen" :loading="confirmationLoading" @confirm="confirmRenewal" />
  </section>
</template>

<style scoped>
  .dashboard-hero {
    background-color: #2a3472;
    color: white;
    display: flex;
    min-height: 330px;
    overflow: hidden;
    padding: clamp(28px, 3vw, 44px) clamp(28px, 3.5vw, 52px);
    position: relative;
  }
  .dashboard-hero__background {
    background-image:
      linear-gradient(90deg, rgba(42, 52, 114, .98) 0%, rgba(42, 52, 114, .93) 46%, rgba(42, 52, 114, .66) 100%),
      var(--dashboard-hero-image);
    background-position: center, center right;
    background-repeat: no-repeat;
    background-size: cover;
    inset: 0;
    pointer-events: none;
    position: absolute;
  }
  .dashboard-hero-fade-enter-active, .dashboard-hero-fade-leave-active { transition: opacity .7s ease; }
  .dashboard-hero-fade-enter-from, .dashboard-hero-fade-leave-to { opacity: 0; }
  .dashboard-hero__content { align-self: center; max-width: 720px; position: relative; z-index: 1; }
  .dashboard-hero__eyebrow { color: #d7ddfb; font-size: .94rem !important; font-weight: 400 !important; letter-spacing: .02em; line-height: 1.5; }
  .dashboard-hero-title { font-family: 'Moul', Calibri, 'Siemreap', sans-serif !important; font-size: clamp(1.65rem, 2.2vw, 2.25rem); font-weight: 400 !important; letter-spacing: -.01em; line-height: 1.2; max-width: 700px; }
  .dashboard-hero-copy { color: #d1d8f5; font-size: .94rem; font-weight: 400 !important; line-height: 1.6; max-width: 660px; }
  .dashboard-view :deep(.dashboard-hero__action.v-btn) { color: #1f2d68 !important; font-size: .9rem !important; font-weight: 400 !important; letter-spacing: 0; min-height: 48px; padding-inline: 26px; }
  .dashboard-view .dashboard-hero :deep(.dashboard-hero__action.v-btn .v-btn__content) { font-size: .9rem !important; }
  .dashboard-notice { cursor: pointer; transition: border-color .15s ease, transform .15s ease; }
  .dashboard-view .dashboard-notice :deep(.text-h6) { font-size: 1rem !important; font-weight: 400 !important; }
  .dashboard-view .dashboard-notice :deep(.text-body-1) { color: #4d5261 !important; font-size: .9rem !important; font-weight: 400 !important; opacity: 1 !important; }
  .dashboard-notice:hover { border-color: #2a3472 !important; transform: translateY(-1px); }
  .dashboard-vehicles-heading { align-items: center; display: flex; gap: 9px; }
  .dashboard-vehicles-heading, .dashboard-view-all { font-weight: 400 !important; }
  .dashboard-vehicles-heading { font-size: 1.05rem !important; }
  .dashboard-view-all { font-size: .86rem !important; }
  .vehicle-dashboard-card { height: 100%; }
  .dashboard-vehicle-statuses { align-items: flex-end; display: flex; flex-direction: column; }
  .dashboard-inspection-status-row { align-items: center; display: flex; justify-content: flex-end; }
  .dashboard-renewal-status-slot { align-items: flex-end; display: flex; justify-content: flex-end; margin-top: 8px; min-height: 24px; }
  .dashboard-inspection-status-row :deep(.v-chip), .dashboard-renewal-status-slot :deep(.v-chip),
  .dashboard-inspection-status-row :deep(.v-chip__content), .dashboard-renewal-status-slot :deep(.v-chip__content) { font-size: .82rem !important; }
  .dashboard-inspection-status--expired { background: #fee2e2 !important; color: #991b1b !important; }
  .dashboard-inspection-status--expiring { background: #fff1cf !important; color: #92400e !important; }
  .dashboard-inspection-status--valid { background: #dcfce7 !important; color: #166534 !important; }
  .dashboard-renewal-status--info { background: #dbeeff !important; color: #075985 !important; }
  .dashboard-renewal-status--deep-purple { background: #ede9fe !important; color: #5b21b6 !important; }
  .dashboard-renewal-status--secondary { background: #f0e7ff !important; color: #6b21a8 !important; }
  .dashboard-renewal-status--success { background: #dcfce7 !important; color: #166534 !important; }
  .dashboard-renewal-status--warning { background: #fff1cf !important; color: #8a4b00 !important; }
  .dashboard-renewal-status--error { background: #fee2e2 !important; color: #b42318 !important; }
  .dashboard-vehicle-plate { align-items: center; color: #20212a; display: flex; flex-wrap: wrap; font-size: clamp(1.06rem, 1.18vw, 1.2rem); font-weight: 400; gap: 7px; line-height: 1.3; }
  .dashboard-vehicle-plate span { color: #3a3b43; font-weight: 400; }
  .dashboard-vehicle-model { font-size: .96rem !important; font-weight: 400; line-height: 1.45; }
  .dashboard-vehicle-type { font-size: .94rem !important; font-weight: 450; line-height: 1.45; }
  .dashboard-vehicle-summary { border-top: 1px solid #e2e3e9; margin-bottom: 14px; }
  .dashboard-vehicle-summary > div { align-items: center; border-bottom: 1px solid #e2e3e9; display: grid; gap: 10px; grid-template-columns: minmax(105px, 1fr) minmax(120px, 1.25fr); min-height: 42px; }
  .dashboard-vehicle-summary dt { color: #5d6170; font-size: .78rem; font-weight: 600; }
  .dashboard-vehicle-summary dd { color: #252934; font-size: .82rem; font-weight: 700; margin: 0; overflow-wrap: anywhere; text-align: right; }
  .dashboard-vehicle-summary__placeholder { color: #252934 !important; font-style: normal; font-weight: 400 !important; }
  .dashboard-vehicle-summary dd :deep(.v-chip) { font-size: .76rem !important; max-width: 100%; }
  .dashboard-vehicle-summary__inspection-status { border-top: 1px solid #e2e3e9; margin-top: 10px; }
  .dashboard-vehicle-actions { display: grid; gap: 12px; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); }
  .dashboard-vehicle-actions :deep(.v-btn) { font-size: .86rem; letter-spacing: 0; min-width: 0; padding-inline: 10px; text-transform: none; }
  .dashboard-vehicle-actions__details--only { grid-column: 1 / -1; }
  .dashboard-vehicle-actions__renew { font-size: .86rem; letter-spacing: 0; }
  .dashboard-vehicle-actions__renew :deep(.v-btn__prepend) { margin-inline-end: 6px; }
  .inspection-expiry { background: #f4f2f6; color: #363640; font-size: .94rem; }
  .inspection-expiry > span { font-size: .85rem; }
  .inspection-expiry > span strong { font-size: .95rem; }
  .inspection-expiry--expired { background: #fee2e2; color: #991b1b; }
  .inspection-expiry--expiring { background: #fff1cf; color: #92400e; }
  .inspection-expiry--valid { background: #dcfce7; color: #166534; }

  /* Shared visual treatment with the My Vehicles cards. */
  .vehicle-grid { display: grid; gap: 20px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .vehicle-card { background: #fff; border: 1px solid #d4d5de; border-radius: 20px; box-shadow: 0 6px 16px rgba(31, 36, 69, .05); display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
  .vehicle-card__main { display: flex; flex: 1; flex-direction: column; padding: 16px 18px 13px; }
  .vehicle-card__icon { background: #dbe3ff; color: #142c68; }
  .vehicle-inspection-status-row { display: flex; justify-content: flex-end; }
  .vehicle-renewal-state, .vehicle-state { font-size: .82rem !important; font-weight: 800; height: 28px !important; min-height: 28px; }
  .vehicle-state { font-size: .95rem !important; }
  .vehicle-state :deep(.v-chip__content), .vehicle-renewal-state :deep(.v-chip__content) { font-size: .82rem !important; line-height: 1.5; }
  .vehicle-renewal-state--info { background: #dbeeff !important; color: #075985 !important; }.vehicle-renewal-state--deep-purple { background: #ede9fe !important; color: #5b21b6 !important; }.vehicle-renewal-state--secondary { background: #f0e7ff !important; color: #6b21a8 !important; }.vehicle-renewal-state--success, .vehicle-state--valid { background: #dcfce7 !important; color: #166534 !important; }.vehicle-renewal-state--warning, .vehicle-state--expiring { background: #fff1cf !important; color: #92400e !important; }.vehicle-renewal-state--error, .vehicle-state--expired { background: #fee2e2 !important; color: #991b1b !important; }
  .vehicle-state--expired { background: transparent !important; color: #b42318 !important; }
  .vehicle-card__title { margin-top: 11px; }.vehicle-card__title h2 { align-items: center; color: #171b28 !important; display: flex; flex-wrap: wrap; font-size: 1rem !important; font-weight: 400 !important; gap: 7px; line-height: 1.25; }.vehicle-plate-label { color: #171b28 !important; font: inherit; font-weight: 400 !important; }.vehicle-card__title p { color: #173d8d !important; font-size: .95rem !important; font-weight: 400 !important; line-height: 1.45; margin-top: 3px; }
  .vehicle-facts { margin-top: 12px; }.vehicle-facts > div { align-items: center; border-bottom: 1px solid #e2e3e9; display: grid; gap: 12px; grid-template-columns: minmax(86px, 1fr) minmax(106px, 1.3fr); min-height: 48px; }.vehicle-facts dt { color: #4f5361; font-size: .85rem !important; font-weight: 600; line-height: 1.45; }.vehicle-facts dd { color: #181c27; font-size: .95rem !important; font-weight: 800; line-height: 1.45; margin: 0; overflow-wrap: anywhere; text-align: right; }.vehicle-facts__placeholder { color: #252934 !important; font-style: normal; font-weight: 400 !important; }
  .vehicle-facts__type { align-items: start !important; grid-template-columns: minmax(82px, .75fr) minmax(175px, 1.75fr) !important; padding-block: 10px; }.vehicle-facts__type dt { color: #4f5361; padding-top: 2px; }.vehicle-facts__type dd { color: #181c27; font-size: .91rem !important; line-height: 1.5; text-align: right; }.vehicle-facts__type + .vehicle-facts__identifier, .vehicle-facts__inspection-status { border-top: 1px solid #e2e3e9; margin-top: 10px; }
  .vehicle-facts__expiry { background: transparent; border-bottom: 1px solid #e2e3e9 !important; border-radius: 0; grid-template-columns: minmax(86px, 1fr) minmax(106px, 1.3fr) !important; margin-top: 0; padding-inline: 0; }.vehicle-facts__expiry dt { color: #4f5361; }.vehicle-facts__expiry--valid, .vehicle-facts__expiry--expired, .vehicle-facts__expiry--expiring { background: transparent; }.vehicle-facts__expiry--valid dd { color: #166534; }.vehicle-facts__expiry--expired dd { color: #991b1b; }.vehicle-facts__expiry--expiring dd { color: #92400e; }
  .vehicle-card__actions { background: #fafafd; border-top: 1px solid #d7d8e1; display: flex; gap: 8px; margin-top: auto; padding: 10px 12px; }.vehicle-card__actions :deep(.v-btn) { font-size: .85rem !important; font-weight: 800; letter-spacing: 0; min-height: 39px; text-transform: none; }

  @media (max-width: 1279px) { .vehicle-grid { grid-template-columns: 1fr; } }
  @media (max-width: 600px) { .dashboard-vehicle-summary > div { align-items: start; grid-template-columns: 1fr; padding-block: 9px; }.dashboard-vehicle-summary dd { text-align: left; }.vehicle-card__main { padding: 22px 20px; }.vehicle-card__actions { flex-direction: column; padding: 16px; }.vehicle-facts > div { align-items: start; grid-template-columns: 1fr; padding-block: 9px; }.vehicle-facts dd { text-align: left; }.vehicle-facts__expiry { grid-template-columns: 1fr !important; } }

  @media (max-width: 600px) {
    .dashboard-hero {
      min-height: 300px;
      padding: 28px 24px;
    }
    .dashboard-hero__background {
      background-image:
        linear-gradient(90deg, rgba(42, 52, 114, .97) 0%, rgba(42, 52, 114, .9) 100%),
        var(--dashboard-hero-image);
      background-position: center, center;
    }
  .dashboard-hero-title { font-size: clamp(1.45rem, 7vw, 1.85rem); }
    .dashboard-hero-copy { font-size: .94rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .dashboard-hero-fade-enter-active, .dashboard-hero-fade-leave-active { transition: none; }
  }
</style>
