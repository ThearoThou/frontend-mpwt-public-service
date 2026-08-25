<script setup lang="ts">
  import type { Vehicle } from './types/vehicle.types'
  import { isAxiosError } from 'axios'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { inspectionApplicationService } from '../applications/services/application.service'
  import { inspectionVehicleService } from './services/vehicle.service'

  type ApiErrorResponse = { code?: string }
  type InspectionState = 'expired' | 'expiring' | 'valid'
  type VehicleFilter = 'all' | InspectionState

  const { locale, t } = useI18n()
  const router = useRouter()
  const vehicles = ref<Vehicle[]>([])
  const loading = ref(true)
  const loadError = ref(false)
  const selectedFilter = ref<VehicleFilter>('all')
  const creatingDraft = ref(false)
  const renewalError = ref<string | null>(null)

  const filters = computed(() => [
    { value: 'all' as const, label: t('inspection_vehicle_filter_all') },
    { value: 'valid' as const, label: t('inspection_dashboard_valid') },
    { value: 'expired' as const, label: t('inspection_dashboard_expired') },
    { value: 'expiring' as const, label: t('inspection_dashboard_expiring') },
  ])
  const filteredVehicles = computed(() => selectedFilter.value === 'all'
    ? vehicles.value
    : vehicles.value.filter(vehicle => inspectionState(vehicle) === selectedFilter.value))

  onMounted(loadVehicles)

  async function loadVehicles () {
    loading.value = true
    loadError.value = false
    try {
      vehicles.value = (await inspectionVehicleService.lookup({})).data
    } catch {
      loadError.value = true
    } finally {
      loading.value = false
    }
  }

  function inspectionState (vehicle: Vehicle): InspectionState {
    const days = daysUntilExpiry(vehicle)
    if (days < 0) return 'expired'
    if (days <= 30) return 'expiring'
    return 'valid'
  }
  function daysUntilExpiry (vehicle: Vehicle) { return Math.ceil((new Date(vehicle.inspectionExpiryDate).getTime() - Date.now()) / 86_400_000) }
  function stateColor (vehicle: Vehicle) { return { expired: 'error', expiring: 'warning', valid: 'success' }[inspectionState(vehicle)] }
  function stateLabel (vehicle: Vehicle) { return t(`inspection_dashboard_${inspectionState(vehicle)}`) }
  function formatDate (date: string | null) {
    if (!date) return '—'
    return new Intl.DateTimeFormat(locale.value === 'kh' ? 'km-KH' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
  }
  function vehicleName (vehicle: Vehicle) { return [vehicle.make, vehicle.model, vehicle.manufactureYear].filter(Boolean).join(' ') }
  function vehicleIcon (vehicle: Vehicle) { return vehicle.vehicleClass === 'HEAVY' ? 'mdi-truck-outline' : 'mdi-car-outline' }
  function plateCategoryLabel (vehicle: Vehicle) {
    if (vehicle.plateCategory === 'PERSONALIZED_CAMBODIA') return t('inspection_plate_cambodia')
    if (vehicle.plateProvince === 'ភ្នំពេញ' || vehicle.plateProvince?.toLowerCase() === 'phnom penh') return t('inspection_plate_phnom_penh')
    return vehicle.plateProvince || t('inspection_plate_category_province')
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
        await resumeExistingDraft(vehicle.id)
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

    return 'inspection_draft_creation_error'
  }

  async function resumeExistingDraft (vehicleId: string) {
    try {
      const applications = await inspectionApplicationService.listCitizenApplications()
      const draft = applications.find(application => application.vehicleId === vehicleId && application.status === 'DRAFT')

      if (draft !== undefined) {
        await router.push({ path: '/services/inspection/renewal/documents', query: { applicationId: draft.id } })
        return
      }
    } catch {
      // Fall through to the localized error below.
    }

    renewalError.value = 'inspection_unfinished_application_error'
  }
</script>

<template>
  <section class="vehicle-list-view">
    <header class="vehicle-list-heading">
      <h1>{{ $t('inspection_my_vehicles') }}</h1>
      <p>{{ $t('inspection_my_vehicles_description') }}</p>
    </header>

    <v-alert v-if="renewalError" class="mt-4" density="compact" type="error" variant="tonal">
      {{ $t(renewalError) }}
    </v-alert>

    <div class="vehicle-filters" role="tablist">
      <v-btn v-for="filter in filters" :key="filter.value" class="vehicle-filter" :class="{ 'vehicle-filter--active': selectedFilter === filter.value }" :variant="selectedFilter === filter.value ? 'flat' : 'outlined'" rounded="pill" @click="selectedFilter = filter.value">
        {{ filter.label }}
      </v-btn>
    </div>

    <div v-if="loading" class="vehicle-list-state"><v-progress-circular color="primary" indeterminate size="42" /><span>{{ $t('inspection_loading_vehicles') }}</span></div>
    <v-alert v-else-if="loadError" class="mt-6" type="error" variant="tonal"><div class="d-flex flex-wrap align-center justify-space-between ga-3">{{ $t('inspection_dashboard_vehicle_load_error') }}<v-btn color="error" variant="outlined" @click="loadVehicles">{{ $t('retry') }}</v-btn></div></v-alert>
    <v-alert v-else-if="filteredVehicles.length === 0" class="mt-6" type="info" variant="tonal">{{ $t(selectedFilter === 'all' ? 'inspection_dashboard_no_vehicles' : 'inspection_no_filtered_vehicles') }}</v-alert>

    <div v-else class="vehicle-grid mt-6">
      <article v-for="vehicle in filteredVehicles" :key="vehicle.id" class="vehicle-card">
        <div class="vehicle-card__main">
          <div class="d-flex align-start justify-space-between ga-3">
            <v-avatar class="vehicle-card__icon" :icon="vehicleIcon(vehicle)" size="52" />
            <div class="text-right"><v-chip class="vehicle-state" :color="stateColor(vehicle)" size="small" variant="tonal"><v-icon class="mr-1" :icon="inspectionState(vehicle) === 'valid' ? 'mdi-check-circle' : 'mdi-alert-circle'" size="14" />{{ stateLabel(vehicle) }}</v-chip><p class="vehicle-state-date">{{ $t('inspection_valid_until') }} {{ formatDate(vehicle.inspectionExpiryDate) }}</p></div>
          </div>
          <div class="vehicle-card__title"><h2><span class="vehicle-plate-label">{{ plateCategoryLabel(vehicle) }}</span>{{ vehicle.plateNumber }}</h2><p>{{ vehicleName(vehicle) }}</p></div>
          <dl class="vehicle-facts">
            <div><dt>{{ $t('inspection_vehicle_type') }}</dt><dd>{{ vehicle.vehicleType || '—' }}</dd></div>
            <div><dt>{{ $t('inspection_registration_number') }}</dt><dd>{{ vehicle.registrationNumber || '—' }}</dd></div>
            <div><dt>{{ $t('inspection_last_inspection_date') }}</dt><dd>{{ formatDate(vehicle.lastInspectionDate) }}</dd></div>
            <div :class="`vehicle-facts__expiry vehicle-facts__expiry--${inspectionState(vehicle)}`"><dt>{{ $t('inspection_dashboard_expiry_date') }}</dt><dd>{{ formatDate(vehicle.inspectionExpiryDate) }}</dd></div>
          </dl>
        </div>
        <div class="vehicle-card__actions"><v-btn class="flex-grow-1" :to="`/services/inspection/vehicles/${vehicle.id}`" prepend-icon="mdi-eye-outline" variant="outlined">{{ $t('inspection_dashboard_view_vehicle') }}</v-btn><v-btn v-if="inspectionState(vehicle) !== 'valid'" class="flex-grow-1" color="primary" :loading="creatingDraft" prepend-icon="mdi-refresh" @click="continueRenewal(vehicle)">{{ $t('inspection_dashboard_renew_vehicle') }}</v-btn></div>
      </article>
    </div>
  </section>
</template>

<style scoped>
  .vehicle-list-view { margin-inline: auto; max-width: 1020px; padding-bottom: 24px; }
  .vehicle-list-heading h1 { color: #10172d; font-size: clamp(1.45rem, 2.25vw, 1.9rem); font-weight: 800; line-height: 1.2; }
  .vehicle-list-heading p { color: #656776; font-size: .91rem; margin-top: 5px; }
  .vehicle-filters { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 14px; }
  .vehicle-filter { --v-btn-height: 34px; border-color: #cfd1db; color: #333747; font-size: .78rem; font-weight: 800; height: 34px !important; letter-spacing: .02em; min-height: 34px !important; min-width: 0; padding-inline: 16px !important; }
  .vehicle-filter--active { background: #293675 !important; color: #fff !important; }
  .vehicle-list-state { align-items: center; color: #656776; display: flex; flex-direction: column; gap: 14px; justify-content: center; min-height: 380px; }
  .vehicle-grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
  .vehicle-card { background: #fff; border: 1px solid #d4d5de; border-radius: 20px; box-shadow: 0 6px 16px rgba(31, 36, 69, .05); display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
  .vehicle-card__main { padding: 21px 21px 17px; }
  .vehicle-card__icon { background: #dbe3ff; color: #142c68; }
  .vehicle-state { font-size: .78rem; font-weight: 800; }
  .vehicle-state-date { color: #6f7180; font-size: .73rem; font-weight: 700; margin-top: 6px; }
  .vehicle-card__title { margin-top: 16px; }
  .vehicle-card__title h2 { align-items: center; color: #20212a; display: flex; flex-wrap: wrap; font-size: clamp(1.12rem, 1.35vw, 1.35rem); font-weight: 800; gap: 7px; line-height: 1.25; }
  .vehicle-plate-label { color: #3a3b43; font: inherit; font-weight: 700; }
  .vehicle-card__title p { color: #5e606c; font-size: .9rem; font-weight: 600; margin-top: 3px; }
  .vehicle-facts { margin-top: 16px; }
  .vehicle-facts > div { align-items: center; border-bottom: 1px solid #e2e3e9; display: grid; gap: 12px; grid-template-columns: minmax(86px, 1fr) minmax(106px, 1.3fr); min-height: 47px; }
  .vehicle-facts dt { color: #6b6d79; font-size: .78rem; font-weight: 600; }
  .vehicle-facts dd { color: #292a33; font-size: .87rem; font-weight: 800; margin: 0; overflow-wrap: anywhere; text-align: right; }
  .vehicle-facts__expiry--expired dd { color: #c72026; }.vehicle-facts__expiry--expiring dd { color: #d77a06; }
  .vehicle-card__actions { background: #fafafd; border-top: 1px solid #d7d8e1; display: flex; gap: 8px; padding: 12px 14px; }.vehicle-card__actions :deep(.v-btn) { font-size: .81rem; font-weight: 800; letter-spacing: 0; min-height: 37px; }
  @media (max-width: 600px) { .vehicle-card { border-radius: 20px; }.vehicle-card__main { padding: 22px 20px; }.vehicle-card__actions { flex-direction: column; padding: 16px; } }
</style>
