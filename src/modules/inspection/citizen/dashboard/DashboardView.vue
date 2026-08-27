<script setup lang="ts">
  import type { RenewalApplication } from '@/modules/inspection/citizen/applications/types/application.types'
  import type { Vehicle } from '@/modules/inspection/citizen/vehicles/types/vehicle.types'
  import { isAxiosError } from 'axios'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { useInspectionAuthStore } from '@/modules/inspection/auth/stores/auth.store'
  import { inspectionApplicationService } from '@/modules/inspection/citizen/applications/services/application.service'
  import { findUnfinishedApplication, renewalApplicationStatusBadge, renewalEntryAction, renewalReminderBadge, unfinishedApplicationMessageKey } from '@/modules/inspection/citizen/renewal/utils/renewal-entry-action'
  import { inspectionVehicleService } from '@/modules/inspection/citizen/vehicles/services/vehicle.service'
  import { inspectionExpiryState, type InspectionExpiryState } from '@/modules/inspection/citizen/vehicles/utils/inspection-expiry-status'
  import { getVehicleTypeIcon } from '@/modules/inspection/citizen/vehicles/utils/vehicle-type-icon'
  import { formatVehicleType } from '@/modules/inspection/citizen/vehicles/utils/vehicle-type-label'
  import heroDefault from '@/assets/inspection/vehicle-inspection-hero.png'
  import heroPickup from '@/assets/inspection/vehicle-inspection-hero-pickup.png'
  import heroSuv from '@/assets/inspection/vehicle-inspection-hero-suv.png'

  type ApiErrorResponse = { code?: string }

  const { locale, t } = useI18n()
  const router = useRouter()
  const authStore = useInspectionAuthStore()
  const sessionCheckComplete = ref(false)
  const vehicles = ref<Vehicle[]>([])
  const applications = ref<RenewalApplication[]>([])
  const loadingVehicles = ref(false)
  const vehicleLoadError = ref(false)
  const creatingDraft = ref(false)
  const renewalError = ref<string | null>(null)
  const heroBackgrounds = [heroDefault, heroSuv, heroPickup]
  const activeHeroBackground = ref(0)
  const currentHeroBackground = computed(() => heroBackgrounds[activeHeroBackground.value])
  let heroRotationTimer: ReturnType<typeof setInterval> | undefined
  const visibleVehicles = computed(() => [
    ...vehicles.value.filter(vehicle => getInspectionState(vehicle) === 'expiring'),
    ...vehicles.value.filter(vehicle => getInspectionState(vehicle) === 'expired'),
    ...vehicles.value.filter(vehicle => getInspectionState(vehicle) === 'valid'),
  ].slice(0, 3))

  onMounted(async () => {
    startHeroRotation()
    await authStore.restoreSession()
    sessionCheckComplete.value = true

    if (!authStore.isCitizen) return

    await loadVehicles()
  })

  onBeforeUnmount(() => {
    if (heroRotationTimer) clearInterval(heroRotationTimer)
  })

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
        inspectionVehicleService.lookup({}),
        inspectionApplicationService.listCitizenApplications(),
      ])
      vehicles.value = vehicleResponse.data
      applications.value = citizenApplications
    } catch {
      vehicleLoadError.value = true
    } finally {
      loadingVehicles.value = false
    }
  }

  function getInspectionState (vehicle: Vehicle): InspectionExpiryState { return inspectionExpiryState(vehicle.inspectionExpiryDate) }

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

  async function continueRenewal (vehicle: Vehicle) {
    if (creatingDraft.value) return

    creatingDraft.value = true
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
      creatingDraft.value = false
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
      applications.value = citizenApplications
      const unfinishedApplication = findUnfinishedApplication(citizenApplications, vehicleId)

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
  <section class="dashboard-view">
    <v-sheet class="dashboard-hero" rounded="xl">
      <Transition name="dashboard-hero-fade" mode="out-in">
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
        <h2 class="text-h6 font-weight-bold">{{ $t('inspection_dashboard_vehicle_overview') }}</h2>
        <v-btn append-icon="mdi-chevron-right" color="primary" to="/services/inspection/vehicles" variant="text">{{ $t('inspection_dashboard_view_all') }}</v-btn>
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
                  <v-chip :color="getInspectionStateColor(vehicle)" :prepend-icon="getInspectionStateIcon(vehicle)" variant="tonal">
                    {{ $t(getInspectionStateKey(vehicle)) }}
                  </v-chip>
                </div>

                <div class="dashboard-renewal-status-slot">
                  <v-chip
                    v-if="vehicleRenewalStatus(vehicle)"
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
              <p class="text-subtitle-1 text-primary font-weight-bold mb-2">{{ formatVehicleModel(vehicle) }}</p>
              <p class="text-body-2 text-medium-emphasis mb-4">{{ formatVehicleType(vehicle.vehicleType, t) }}</p>

              <v-sheet class="inspection-expiry d-flex align-center ga-2 px-3 py-3" :class="`inspection-expiry--${getInspectionState(vehicle)}`" rounded="lg">
                <v-icon icon="mdi-calendar-month-outline" />
                <span>{{ $t('inspection_dashboard_expiry_date') }}: <strong>{{ formatInspectionDate(vehicle.inspectionExpiryDate) }}</strong></span>
              </v-sheet>
            </div>

            <div class="dashboard-vehicle-actions mt-auto pt-4">
              <v-btn class="dashboard-vehicle-actions__details" prepend-icon="mdi-eye-outline" :to="`/services/inspection/vehicles/${vehicle.id}`" variant="outlined">{{ $t('inspection_dashboard_view_vehicle') }}</v-btn>

              <v-btn
                v-if="unfinishedApplication(vehicle) || getInspectionState(vehicle) !== 'valid'"
                class="dashboard-vehicle-actions__renew"
                color="primary"
                :loading="creatingDraft"
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
  .dashboard-hero__eyebrow { color: #d7ddfb; font-size: 1rem; letter-spacing: .08em; line-height: 1.35; }
  .dashboard-hero-title { font-size: clamp(1.85rem, 2.6vw, 2.7rem); font-weight: 800; letter-spacing: -.01em; line-height: 1.2; max-width: 700px; }
  .dashboard-hero-copy { color: #d1d8f5; font-size: clamp(.95rem, 1.15vw, 1.07rem); line-height: 1.6; max-width: 660px; }
  .dashboard-hero__action { color: #1f2d68 !important; font-weight: 800; letter-spacing: 0; min-height: 44px; padding-inline: 22px; }
  .dashboard-notice { cursor: pointer; transition: border-color .15s ease, transform .15s ease; }
  .dashboard-notice:hover { border-color: #2a3472 !important; transform: translateY(-1px); }
  .vehicle-dashboard-card { height: 100%; }
  .dashboard-vehicle-statuses { align-items: flex-end; display: flex; flex-direction: column; }
  .dashboard-inspection-status-row { align-items: center; display: flex; justify-content: flex-end; }
  .dashboard-renewal-status-slot { align-items: flex-end; display: flex; justify-content: flex-end; margin-top: 8px; min-height: 24px; }
  .dashboard-vehicle-plate { align-items: center; color: #20212a; display: flex; flex-wrap: wrap; font-size: 1.15rem; font-weight: 800; gap: 7px; line-height: 1.3; }
  .dashboard-vehicle-plate span { color: #3a3b43; font-weight: 700; }
  .dashboard-vehicle-actions { display: grid; gap: 12px; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); }
  .dashboard-vehicle-actions :deep(.v-btn) { min-width: 0; padding-inline: 10px; }
  .dashboard-vehicle-actions__renew { font-size: .78rem; letter-spacing: .04em; }
  .dashboard-vehicle-actions__renew :deep(.v-btn__prepend) { margin-inline-end: 6px; }
  .inspection-expiry { background: #f4f2f6; color: #363640; }
  .inspection-expiry--expired { background: #fff0f0; color: #bb1e22; }
  .inspection-expiry--expiring { background: #fff9e7; color: #9a530d; }
  .inspection-expiry--valid { background: #effbf3; color: #18733a; }

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
    .dashboard-hero-title { font-size: clamp(1.65rem, 8vw, 2.15rem); }
    .dashboard-hero-copy { font-size: .93rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .dashboard-hero-fade-enter-active, .dashboard-hero-fade-leave-active { transition: none; }
  }
</style>
