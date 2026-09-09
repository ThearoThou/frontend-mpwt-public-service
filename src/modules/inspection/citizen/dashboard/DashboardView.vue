<script setup lang="ts">
  import type { RenewalApplication } from '@/modules/inspection/citizen/applications/types/application.types'
  import type { Vehicle } from '@/modules/inspection/citizen/vehicles/types/vehicle.types'
  import { isAxiosError } from 'axios'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import heroPickup from '@/assets/inspection/vehicle-inspection-hero-pickup.png'
  import heroSuv from '@/assets/inspection/vehicle-inspection-hero-suv.png'
  import heroDefault from '@/assets/inspection/vehicle-inspection-hero.png'
  import { useInspectionAuthStore } from '@/modules/inspection/auth/stores/auth.store'
  import { inspectionApplicationService } from '@/modules/inspection/citizen/applications/services/application.service'
  import { findUnfinishedApplication, renewalApplicationStatusBadge, renewalEntryAction, renewalReminderBadge, unfinishedApplicationMessageKey } from '@/modules/inspection/citizen/renewal/utils/renewal-entry-action'
  import { inspectionVehicleService } from '@/modules/inspection/citizen/vehicles/services/vehicle.service'
  import { inspectionExpiryState, type InspectionExpiryState } from '@/modules/inspection/citizen/vehicles/utils/inspection-expiry-status'
  import { getVehicleTypeIcon } from '@/modules/inspection/citizen/vehicles/utils/vehicle-type-icon'
  import { formatVehicleType } from '@/modules/inspection/citizen/vehicles/utils/vehicle-type-label'

  type ApiErrorResponse = { code?: string }
  type IdleCallbackWindow = Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
    cancelIdleCallback?: (handle: number) => void
  }

  const { locale, t } = useI18n()
  const router = useRouter()
  const authStore = useInspectionAuthStore()
  const sessionCheckComplete = ref(false)
  const vehicles = ref<Vehicle[]>([])
  const applications = ref<RenewalApplication[]>([])
  const loadingVehicles = ref(false)
  const vehicleLoadError = ref(false)
  const renewingVehicleIds = ref<Set<string>>(new Set())
  const renewalError = ref<string | null>(null)
  const heroBackgrounds = [heroDefault, heroSuv, heroPickup]
  const activeHeroBackground = ref(0)
  const currentHeroBackground = computed(() => heroBackgrounds[activeHeroBackground.value])
  let heroRotationTimer: ReturnType<typeof setInterval> | undefined
  let routePrefetchTimer: ReturnType<typeof setTimeout> | undefined
  let routePrefetchIdleCallback: number | undefined
  const visibleVehicles = computed(() => vehicles.value.slice(0, 3))

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
        inspectionApplicationService.listCitizenApplications(),
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

  function getInspectionStateColor (vehicle: Vehicle) {
    return { expired: 'error', expiring: 'warning', valid: 'success' }[getInspectionState(vehicle)]
  }

  function getInspectionStateIcon (vehicle: Vehicle) {
    return getInspectionState(vehicle) === 'valid' ? 'mdi-shield-check-outline' : 'mdi-calendar-alert-outline'
  }

  function formatInspectionDate (value: string) {
    return new Intl.DateTimeFormat(locale.value === 'kh' ? 'km-KH' : 'en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    }).format(new Date(value))
  }

  function formatVehicleModel (vehicle: Vehicle) {
    return [vehicle.make, vehicle.model, vehicle.manufactureYear].filter(Boolean).join(' ')
  }

  function plateTypeLabel (vehicle: Vehicle) {
    if (vehicle.plateCategory === 'PERSONALIZED_CAMBODIA') return t('inspection_plate_cambodia')
    if (vehicle.plateProvince === 'ភ្នំពេញ' || vehicle.plateProvince?.toLowerCase() === 'phnom penh') return t('inspection_plate_phnom_penh')
    return vehicle.plateProvince || t('inspection_plate_category_province')
  }

  function unfinishedApplication (vehicle: Vehicle): RenewalApplication | undefined {
    return findUnfinishedApplication(applications.value, vehicle.id)
  }

  function vehicleRenewalAction (vehicle: Vehicle) {
    return renewalEntryAction(unfinishedApplication(vehicle))
  }

  function vehicleRenewalStatus (vehicle: Vehicle) {
    const application = unfinishedApplication(vehicle)
    return application === undefined
      ? renewalReminderBadge(vehicle.inspectionExpiryDate)
      : renewalApplicationStatusBadge(application)
  }

  async function handleRenewalAction (vehicle: Vehicle) {
    const application = unfinishedApplication(vehicle)
    const action = renewalEntryAction(application)

    if (action.kind === 'start') {
      await continueRenewal(vehicle)
      return
    }

    if (application === undefined) return

    await router.push(action.kind === 'resume'
      ? { path: '/services/inspection/renewal/documents', query: { applicationId: application.id } }
      : { path: `/services/inspection/applications/${application.id}` })
  }

  function isRenewingVehicle (vehicleId: string): boolean {
    return renewingVehicleIds.value.has(vehicleId)
  }

  function setVehicleRenewing (vehicleId: string, renewing: boolean) {
    const renewingIds = new Set(renewingVehicleIds.value)

    if (renewing) renewingIds.add(vehicleId)
    else renewingIds.delete(vehicleId)

    renewingVehicleIds.value = renewingIds
  }

  async function continueRenewal (vehicle: Vehicle) {
    if (isRenewingVehicle(vehicle.id)) return

    setVehicleRenewing(vehicle.id, true)
    renewalError.value = null
    try {
      const application = await inspectionApplicationService.createDraft(vehicle.id)
      await router.push({ path: '/services/inspection/renewal/documents', query: { applicationId: application.id } })
    } catch (error) {
      if (isUnfinishedApplicationError(error)) {
        await handleUnfinishedApplication(vehicle.id)
        return
      }

      renewalError.value = getRenewalErrorMessage(error)
    } finally {
      setVehicleRenewing(vehicle.id, false)
    }
  }

  function isUnfinishedApplicationError (error: unknown): boolean {
    return isAxiosError<ApiErrorResponse>(error)
      && error.response?.data?.code === 'UNFINISHED_APPLICATION_ALREADY_EXISTS'
  }

  function getRenewalErrorMessage (error: unknown): string {
    if (isAxiosError<ApiErrorResponse>(error)
      && error.response?.data?.code === 'VEHICLE_CLASSIFICATION_INCOMPLETE') {
      return 'inspection_vehicle_classification_incomplete'
    }

    if (isAxiosError<ApiErrorResponse>(error)
      && error.response?.data?.code === 'VEHICLE_NOT_YET_ELIGIBLE_FOR_RENEWAL') {
      return 'inspection_renewal_not_yet_eligible'
    }

    return 'inspection_draft_creation_error'
  }

  async function handleUnfinishedApplication (vehicleId: string) {
    try {
      const citizenApplications = await inspectionApplicationService.listCitizenApplications()
      applications.value = citizenApplications.data
      const unfinishedApplication = findUnfinishedApplication(citizenApplications.data, vehicleId)

      if (unfinishedApplication?.status === 'DRAFT') {
        await router.push({ path: '/services/inspection/renewal/documents', query: { applicationId: unfinishedApplication.id } })
        return
      }

      renewalError.value = unfinishedApplicationMessageKey(unfinishedApplication)
      return
    } catch {
      // Fall through to the localized error below.
    }

    renewalError.value = 'inspection_unfinished_application_error'
  }
</script>

<template>
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
        <h2 class="dashboard-vehicles-heading text-h6">{{ $t('inspection_dashboard_vehicle_overview') }}</h2>

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

      <v-row v-else>
        <v-col v-for="vehicle in visibleVehicles" :key="vehicle.id" cols="12" lg="4">
          <v-card border class="vehicle-dashboard-card d-flex flex-column pa-3 pa-md-4" elevation="0" rounded="xl">
            <div class="d-flex align-start justify-space-between ga-3">
              <v-avatar color="primary" :icon="getVehicleTypeIcon(vehicle.vehicleType)" size="56" variant="tonal" />

              <div class="dashboard-vehicle-statuses">
                <div class="dashboard-inspection-status-row">
                  <v-chip :class="['dashboard-inspection-status', `dashboard-inspection-status--${getInspectionState(vehicle)}`]" :color="getInspectionStateColor(vehicle)" :prepend-icon="getInspectionStateIcon(vehicle)" variant="tonal">
                    {{ $t(getInspectionStateKey(vehicle)) }}
                  </v-chip>
                </div>

                <div class="dashboard-renewal-status-slot">
                  <v-chip
                    v-if="vehicleRenewalStatus(vehicle)"
                    :class="['dashboard-renewal-status', `dashboard-renewal-status--${vehicleRenewalStatus(vehicle)?.color}`]"
                    :color="vehicleRenewalStatus(vehicle)?.color"
                    :prepend-icon="vehicleRenewalStatus(vehicle)?.icon"
                    size="small"
                    variant="tonal"
                  >
                    {{ $t(vehicleRenewalStatus(vehicle)?.labelKey ?? '') }}
                  </v-chip>
                </div>
              </div>
            </div>

            <div class="mt-4">
              <h3 class="dashboard-vehicle-plate mb-1"><span>{{ plateTypeLabel(vehicle) }}</span>{{ vehicle.plateNumber }}</h3>
              <p class="dashboard-vehicle-model text-primary mb-2">{{ formatVehicleModel(vehicle) }}</p>
              <p class="dashboard-vehicle-type text-medium-emphasis mb-4">{{ formatVehicleType(vehicle.vehicleType, t) }}</p>

              <v-sheet class="inspection-expiry d-flex align-center ga-2 px-3 py-3" :class="`inspection-expiry--${getInspectionState(vehicle)}`" rounded="lg">
                <v-icon icon="mdi-calendar-month-outline" />
                <span>{{ $t('inspection_dashboard_expiry_date') }}: <strong>{{ formatInspectionDate(vehicle.inspectionExpiryDate) }}</strong></span>
              </v-sheet>
            </div>

            <div class="dashboard-vehicle-actions mt-auto pt-4">
              <v-btn
                class="dashboard-vehicle-actions__details"
                :class="{ 'dashboard-vehicle-actions__details--only': !unfinishedApplication(vehicle) && getInspectionState(vehicle) === 'valid' }"
                prepend-icon="mdi-eye-outline"
                :to="`/services/inspection/vehicles/${vehicle.id}`"
                variant="outlined"
              >{{ $t('inspection_dashboard_view_vehicle') }}</v-btn>

              <v-btn
                v-if="unfinishedApplication(vehicle) || getInspectionState(vehicle) !== 'valid'"
                class="dashboard-vehicle-actions__renew"
                color="primary"
                :loading="isRenewingVehicle(vehicle.id)"
                :prepend-icon="vehicleRenewalAction(vehicle).icon"
                @click="handleRenewalAction(vehicle)"
              >
                {{ $t(vehicleRenewalAction(vehicle).labelKey) }}
              </v-btn>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </template>
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
  .dashboard-hero-title { font-family: 'Moul', 'Siemreap', sans-serif !important; font-size: clamp(1.65rem, 2.2vw, 2.25rem); font-weight: 400 !important; letter-spacing: -.01em; line-height: 1.2; max-width: 700px; }
  .dashboard-hero-copy { color: #d1d8f5; font-size: .94rem; font-weight: 400 !important; line-height: 1.6; max-width: 660px; }
  .dashboard-view :deep(.dashboard-hero__action.v-btn) { color: #1f2d68 !important; font-size: .9rem !important; font-weight: 400 !important; letter-spacing: 0; min-height: 48px; padding-inline: 26px; }
  .dashboard-view .dashboard-hero :deep(.dashboard-hero__action.v-btn .v-btn__content) { font-size: .9rem !important; }
  .dashboard-notice { cursor: pointer; transition: border-color .15s ease, transform .15s ease; }
  .dashboard-view .dashboard-notice :deep(.text-h6) { font-size: 1rem !important; font-weight: 400 !important; }
  .dashboard-view .dashboard-notice :deep(.text-body-1) { color: #4d5261 !important; font-size: .9rem !important; font-weight: 400 !important; opacity: 1 !important; }
  .dashboard-notice:hover { border-color: #2a3472 !important; transform: translateY(-1px); }
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
  .dashboard-vehicle-type { font-size: .94rem !important; line-height: 1.45; }
  .dashboard-vehicle-actions { display: grid; gap: 12px; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); }
  .dashboard-vehicle-actions :deep(.v-btn) { font-size: .86rem; letter-spacing: 0; min-width: 0; padding-inline: 10px; text-transform: none; }
  .dashboard-vehicle-actions__details--only { grid-column: 1 / -1; }
  .dashboard-vehicle-actions__renew { font-size: .86rem; letter-spacing: 0; }
  .dashboard-vehicle-actions__renew :deep(.v-btn__prepend) { margin-inline-end: 6px; }
  .inspection-expiry { background: #f4f2f6; color: #363640; font-size: .94rem; }
  .inspection-expiry--expired { background: #fee2e2; color: #991b1b; }
  .inspection-expiry--expiring { background: #fff1cf; color: #92400e; }
  .inspection-expiry--valid { background: #dcfce7; color: #166534; }

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
