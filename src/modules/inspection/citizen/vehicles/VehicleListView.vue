<script setup lang="ts">
  import type { RenewalApplication } from '../applications/types/application.types'
  import type { PaginationMeta, Vehicle } from './types/vehicle.types'
  import { isAxiosError } from 'axios'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { inspectionApplicationService } from '../applications/services/application.service'
  import { findUnfinishedApplication, renewalApplicationStatusBadge, renewalEntryAction, renewalReminderBadge, unfinishedApplicationMessageKey } from '../renewal/utils/renewal-entry-action'
  import { inspectionVehicleService } from './services/vehicle.service'
  import { daysUntilInspectionExpiry, inspectionExpiryState, type InspectionExpiryState } from './utils/inspection-expiry-status'
  import { getVehicleTypeIcon } from './utils/vehicle-type-icon'
  import { formatVehicleType } from './utils/vehicle-type-label'

  type ApiErrorResponse = { code?: string }
  type VehicleFilter = 'all' | InspectionExpiryState

  const { locale, t } = useI18n()
  const router = useRouter()
  const vehicles = ref<Vehicle[]>([])
  const vehicleMeta = ref<PaginationMeta | null>(null)
  const page = ref(1)
  const applications = ref<RenewalApplication[]>([])
  const loading = ref(true)
  const loadError = ref(false)
  const selectedFilter = ref<VehicleFilter>('all')
  const search = ref('')
  const creatingDraft = ref(false)
  const renewalError = ref<string | null>(null)
  const vehiclePageSize = 12
  let vehicleRequest = 0
  let searchDebounce: ReturnType<typeof setTimeout> | undefined

  const filters = computed(() => [
    { value: 'all' as const, label: t('inspection_vehicle_filter_all') },
    { value: 'valid' as const, label: t('inspection_dashboard_valid') },
    { value: 'expired' as const, label: t('inspection_dashboard_expired') },
    { value: 'expiring' as const, label: t('inspection_dashboard_expiring') },
  ])
  const filteredVehicles = computed(() => {
    const matchingVehicles = vehicles.value
      .filter(vehicle => vehicleMatchesSearch(vehicle, search.value))
      .filter(vehicle => selectedFilter.value === 'all' || inspectionState(vehicle) === selectedFilter.value)

    return (['expiring', 'expired', 'valid'] as const)
      .flatMap(state => matchingVehicles.filter(vehicle => inspectionState(vehicle) === state))
  })

  onMounted(async () => {
    await Promise.all([loadVehicles(), loadApplications()])
  })

  onBeforeUnmount(() => {
    if (searchDebounce !== undefined) clearTimeout(searchDebounce)
  })

  watch(search, () => {
    page.value = 1
    if (searchDebounce !== undefined) clearTimeout(searchDebounce)
    searchDebounce = setTimeout(() => {
      void loadVehicles()
    }, 300)
  })

  async function loadVehicles () {
    const request = ++vehicleRequest
    loading.value = true
    loadError.value = false
    try {
      const response = await inspectionVehicleService.lookup({
        page: page.value,
        limit: vehiclePageSize,
        ...(search.value.trim() ? { search: search.value.trim() } : {}),
      })
      if (request !== vehicleRequest) return
      vehicles.value = response.data
      vehicleMeta.value = response.meta
    } catch {
      if (request !== vehicleRequest) return
      loadError.value = true
    } finally {
      if (request === vehicleRequest) loading.value = false
    }
  }

  function selectFilter (filter: VehicleFilter) {
    if (selectedFilter.value === filter) return
    selectedFilter.value = filter
    page.value = 1
    void loadVehicles()
  }

  function changePage (value: number) {
    if (value === page.value) return
    page.value = value
    void loadVehicles()
  }

  async function loadApplications () {
    try {
      applications.value = await inspectionApplicationService.listCitizenApplications()
    } catch {
      // Vehicle search remains available even if renewal actions cannot load.
    }
  }

  function inspectionState (vehicle: Vehicle): InspectionExpiryState {
    return inspectionExpiryState(vehicle.inspectionExpiryDate)
  }
  function daysUntilExpiry (vehicle: Vehicle) {
    return daysUntilInspectionExpiry(vehicle.inspectionExpiryDate)
  }
  function stateColor (vehicle: Vehicle) {
    return { expired: 'error', expiring: 'warning', valid: 'success' }[inspectionState(vehicle)]
  }
  function stateIcon (vehicle: Vehicle) {
    return inspectionState(vehicle) === 'valid' ? 'mdi-shield-check-outline' : 'mdi-calendar-alert-outline'
  }
  function stateLabel (vehicle: Vehicle) {
    return t(`inspection_dashboard_${inspectionState(vehicle)}`)
  }
  function formatDate (date: string | null) {
    if (!date) return '—'
    return new Intl.DateTimeFormat(locale.value === 'kh' ? 'km-KH' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
  }
  function vehicleName (vehicle: Vehicle) {
    return [vehicle.make, vehicle.model, vehicle.manufactureYear].filter(Boolean).join(' ')
  }
  function vehicleMatchesSearch (vehicle: Vehicle, query: string) {
    const tokens = normalizeSearch(query).split(' ').filter(Boolean)
    if (tokens.length === 0) return true
    const searchableText = normalizeSearch([
      vehicle.plateNumber,
      vehicle.registrationNumber,
      vehicle.make,
      vehicle.model,
      vehicle.manufactureYear,
    ].filter(Boolean).join(' '))
    return tokens.every(token => searchableText.includes(token))
  }
  function normalizeSearch (value: string) {
    return value.trim().toLocaleLowerCase()
  }
  function plateCategoryLabel (vehicle: Vehicle) {
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
  <section class="vehicle-list-view">
    <header class="vehicle-list-heading">
      <h1>{{ $t('inspection_my_vehicles') }}</h1>
      <p>{{ $t('inspection_my_vehicles_description') }}</p>
    </header>

    <v-alert
      v-if="renewalError"
      class="mt-4"
      density="compact"
      type="error"
      variant="tonal"
    >
      {{ $t(renewalError) }}
    </v-alert>

    <div class="vehicle-search-toolbar">
      <v-text-field
        v-model="search"
        :aria-label="$t('inspection_vehicle_search_label')"
        class="vehicle-search"
        clear-icon="mdi-close"
        clearable
        density="comfortable"
        hide-details
        :placeholder="$t('inspection_vehicle_search_placeholder')"
        prepend-inner-icon="mdi-magnify"
        single-line
        variant="outlined"
      />

      <div class="vehicle-filters" role="tablist">
        <v-btn
          v-for="filter in filters"
          :key="filter.value"
          class="vehicle-filter"
          :class="{ 'vehicle-filter--active': selectedFilter === filter.value }"
          rounded="pill"
          :variant="selectedFilter === filter.value ? 'flat' : 'outlined'"
          @click="selectFilter(filter.value)"
        >
          {{ filter.label }}
        </v-btn>
      </div>
    </div>

    <div v-if="loading" class="vehicle-list-state"><v-progress-circular color="primary" indeterminate size="42" /><span>{{ $t('inspection_loading_vehicles') }}</span></div>
    <v-alert v-else-if="loadError" class="mt-6" type="error" variant="tonal"><div class="d-flex flex-wrap align-center justify-space-between ga-3">{{ $t('inspection_dashboard_vehicle_load_error') }}<v-btn color="error" variant="outlined" @click="loadVehicles">{{ $t('retry') }}</v-btn></div></v-alert>
    <v-alert v-else-if="filteredVehicles.length === 0" class="mt-6" type="info" variant="tonal">{{ $t(search.trim() ? 'inspection_vehicle_search_empty' : selectedFilter === 'all' ? 'inspection_dashboard_no_vehicles' : 'inspection_no_filtered_vehicles') }}</v-alert>

    <div v-else class="vehicle-grid mt-6">
      <article v-for="vehicle in filteredVehicles" :key="vehicle.id" class="vehicle-card">
        <div class="vehicle-card__main">
          <div class="d-flex align-start justify-space-between ga-3">
            <v-avatar class="vehicle-card__icon" :icon="getVehicleTypeIcon(vehicle.vehicleType)" size="52" />

            <div class="text-right"><div class="vehicle-inspection-status-row"><v-chip
                                      class="vehicle-state"
                                      :color="stateColor(vehicle)"
                                      :prepend-icon="stateIcon(vehicle)"
                                      size="small"
                                      variant="tonal"
                                    >{{ stateLabel(vehicle) }}</v-chip></div>

              <div class="vehicle-renewal-state-slot"><v-chip
                v-if="vehicleRenewalStatus(vehicle)"
                class="vehicle-renewal-state"
                :color="vehicleRenewalStatus(vehicle)?.color"
                :prepend-icon="vehicleRenewalStatus(vehicle)?.icon"
                size="small"
                variant="tonal"
              >{{ $t(vehicleRenewalStatus(vehicle)?.labelKey ?? '') }}</v-chip></div></div>
          </div>

          <div class="vehicle-card__title"><h2><span class="vehicle-plate-label">{{ plateCategoryLabel(vehicle) }}</span>{{ vehicle.plateNumber }}</h2><p>{{ vehicleName(vehicle) }}</p></div>

          <dl class="vehicle-facts">
            <div><dt>{{ $t('inspection_vehicle_type') }}</dt><dd>{{ formatVehicleType(vehicle.vehicleType, t) }}</dd></div>
            <div><dt>{{ $t('inspection_registration_number') }}</dt><dd>{{ vehicle.registrationNumber || '—' }}</dd></div>
            <div><dt>{{ $t('inspection_last_inspection_date') }}</dt><dd>{{ formatDate(vehicle.lastInspectionDate) }}</dd></div>
            <div :class="`vehicle-facts__expiry vehicle-facts__expiry--${inspectionState(vehicle)}`"><dt>{{ $t('inspection_dashboard_expiry_date') }}</dt><dd>{{ formatDate(vehicle.inspectionExpiryDate) }}</dd></div>
          </dl>
        </div>

        <div class="vehicle-card__actions"><v-btn class="flex-grow-1" prepend-icon="mdi-eye-outline" :to="`/services/inspection/vehicles/${vehicle.id}`" variant="outlined">{{ $t('inspection_dashboard_view_vehicle') }}</v-btn>

          <v-btn
            v-if="unfinishedApplication(vehicle) || inspectionState(vehicle) !== 'valid'"
            class="flex-grow-1"
            color="primary"
            :loading="creatingDraft"
            :prepend-icon="vehicleRenewalAction(vehicle).icon"
            @click="handleRenewalAction(vehicle)"
          >{{ $t(vehicleRenewalAction(vehicle).labelKey) }}</v-btn></div>
      </article>
    </div>

    <div v-if="!loading && !loadError" class="vehicle-pagination">
      <v-pagination
        :length="Math.max(1, vehicleMeta?.totalPages ?? 1)"
        :model-value="page"
        @update:model-value="changePage"
      />
    </div>
  </section>
</template>

<style scoped>
  .vehicle-list-view { padding-bottom: 24px; }
  .vehicle-list-heading h1 { color: #10172d; font-size: clamp(1.45rem, 2.25vw, 1.9rem); font-weight: 800; line-height: 1.2; }
  .vehicle-list-heading p { color: #656776; font-size: .91rem; margin-top: 5px; }
  .vehicle-search-toolbar { margin-top: 22px; max-width: 480px; width: 100%; }
  .vehicle-search { width: 100%; }
  .vehicle-filters { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
  .vehicle-filter { --v-btn-height: 34px; border-color: #cfd1db; color: #333747; font-size: .78rem; font-weight: 800; height: 34px !important; letter-spacing: .02em; min-height: 34px !important; min-width: 0; padding-inline: 16px !important; }
  .vehicle-filter--active { background: #293675 !important; color: #fff !important; }
  .vehicle-list-state { align-items: center; color: #656776; display: flex; flex-direction: column; gap: 14px; justify-content: center; min-height: 380px; }
  .vehicle-grid { display: grid; gap: 20px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .vehicle-pagination { display: flex; justify-content: flex-end; margin-top: 28px; }
  .vehicle-pagination :deep(.v-pagination__list) { gap: 10px; justify-content: flex-end; }
  .vehicle-pagination :deep(.v-pagination__list > li) { margin: 0; }
  .vehicle-pagination :deep(.v-pagination__item), .vehicle-pagination :deep(.v-pagination__prev .v-btn), .vehicle-pagination :deep(.v-pagination__next .v-btn) { align-items: center; background: #fff; border: 1px solid #d5d7dc; border-radius: 9px; box-shadow: none; color: #20212a; display: inline-flex; font-size: .86rem; font-weight: 800; height: 36px; justify-content: center; min-width: 36px; padding: 0; width: 36px; }
  .vehicle-pagination :deep(.v-pagination__item--is-active) { background: #293675; border-color: #293675; color: #fff; }
  .vehicle-card { background: #fff; border: 1px solid #d4d5de; border-radius: 20px; box-shadow: 0 6px 16px rgba(31, 36, 69, .05); display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
  .vehicle-card__main { padding: 21px 21px 17px; }
  .vehicle-card__icon { background: #dbe3ff; color: #142c68; }
  .vehicle-inspection-status-row { display: flex; justify-content: flex-end; }
  .vehicle-state { font-size: .78rem; font-weight: 800; }
  .vehicle-renewal-state-slot { align-items: flex-start; display: flex; justify-content: flex-end; margin-top: 8px; min-height: 24px; }
  .vehicle-renewal-state { display: flex; font-size: .71rem; font-weight: 800; }
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
  @media (max-width: 1279px) { .vehicle-grid { grid-template-columns: 1fr; } }
  @media (max-width: 600px) { .vehicle-card { border-radius: 20px; }.vehicle-card__main { padding: 22px 20px; }.vehicle-card__actions { flex-direction: column; padding: 16px; } }
</style>
