<script setup lang="ts">
  import type { RenewalApplication, RenewalApplicationListItem } from '../applications/types/application.types'
  import type { PaginationMeta, Vehicle } from './types/vehicle.types'
  import { useI18n } from 'vue-i18n'
  import { formatDisplayDate } from '@/modules/inspection/shared/utils/display-date'
  import { inspectionApplicationService } from '../applications/services/application.service'
  import { citizenCardCycleForVehicle, citizenCardIdentifierLabel, resolveCitizenVehicleRenewalStatus } from '../applications/utils/citizen-application-status'
  import RenewalStartConfirmationDialog from '../renewal/components/RenewalStartConfirmationDialog.vue'
  import { useRenewalEntryFlow } from '../renewal/composables/use-renewal-entry-flow'
  import { findUnfinishedApplication, renewalEntryAction } from '../renewal/utils/renewal-entry-action'
  import CitizenVehicleCard from './components/CitizenVehicleCard.vue'
  import { inspectionVehicleService } from './services/vehicle.service'
  import { daysUntilInspectionExpiry, inspectionExpiryState, type InspectionExpiryState } from './utils/inspection-expiry-status'
  import { formatProvince, normalizeProvinceSearch } from './utils/province-label'
  import { getVehicleTypeIcon } from './utils/vehicle-type-icon'

  type VehicleFilter = 'all' | InspectionExpiryState

  const { locale, t } = useI18n()
  const vehicles = ref<Vehicle[]>([])
  const vehicleMeta = ref<PaginationMeta | null>(null)
  const page = ref(1)
  const applications = ref<RenewalApplicationListItem[]>([])
  const loading = ref(true)
  const showLoadingPlaceholder = ref(false)
  const loadError = ref(false)
  const selectedFilter = ref<VehicleFilter>('all')
  const search = ref<string | null>('')
  const renewalError = ref<string | null>(null)
  const { confirmationLoading, confirmationOpen, confirmRenewal, isRenewingVehicle, startOrContinueRenewal } = useRenewalEntryFlow({
    onApplicationsLoaded: loaded => applications.value = loaded,
    onError: messageKey => renewalError.value = messageKey || null,
  })
  const vehiclePageSize = 12
  const vehicleSearchDebounceMs = 350
  const loadingPlaceholderDelayMs = 175
  let vehicleRequest = 0
  let loadingPlaceholderTimer: ReturnType<typeof setTimeout> | undefined
  let searchDebounce: ReturnType<typeof setTimeout> | undefined

  const filters = computed(() => [
    { value: 'all' as const, label: t('inspection_vehicle_filter_all') },
    { value: 'valid' as const, label: t('inspection_dashboard_valid') },
    { value: 'expired' as const, label: t('inspection_dashboard_expired') },
    { value: 'expiring' as const, label: t('inspection_dashboard_expiring') },
  ])
  const searchTerm = computed(() => search.value?.trim() ?? '')
  const filteredVehicles = computed(() => vehicles.value)

  onMounted(async () => {
    await Promise.all([loadVehicles(), loadApplications()])
  })

  onBeforeUnmount(() => {
    if (loadingPlaceholderTimer !== undefined) clearTimeout(loadingPlaceholderTimer)
    if (searchDebounce !== undefined) clearTimeout(searchDebounce)
  })

  watch(search, () => {
    page.value = 1
    if (searchDebounce !== undefined) clearTimeout(searchDebounce)
    searchDebounce = setTimeout(() => {
      searchDebounce = undefined
      void loadVehicles()
    }, vehicleSearchDebounceMs)
  }, { flush: 'sync' })

  function submitSearch () {
    clearSearchDebounce()
    page.value = 1
    void loadVehicles()
  }

  function clearSearch () {
    search.value = ''
    submitSearch()
  }

  function clearSearchDebounce () {
    if (searchDebounce !== undefined) {
      clearTimeout(searchDebounce)
      searchDebounce = undefined
    }
  }

  async function loadVehicles () {
    const request = ++vehicleRequest
    const validVehiclesOnly = selectedFilter.value === 'valid'
    loading.value = true
    scheduleLoadingPlaceholder()
    loadError.value = false
    try {
      const response = await inspectionVehicleService.lookup({
        page: page.value,
        limit: vehiclePageSize,
        sortBy: validVehiclesOnly ? 'updatedAt' : 'inspectionExpiryDate',
        sortOrder: validVehiclesOnly ? 'desc' : 'asc',
        ...(searchTerm.value ? { search: normalizeProvinceSearch(searchTerm.value) } : {}),
        ...(selectedFilter.value === 'all' ? {} : { inspectionStatus: selectedFilter.value }),
      })
      if (request !== vehicleRequest) return
      vehicles.value = response.data
      vehicleMeta.value = response.meta
    } catch {
      if (request !== vehicleRequest) return
      loadError.value = true
    } finally {
      if (request === vehicleRequest) {
        loading.value = false
        hideLoadingPlaceholder()
      }
    }
  }

  function scheduleLoadingPlaceholder () {
    hideLoadingPlaceholder()
    if (vehicles.value.length > 0) return

    loadingPlaceholderTimer = setTimeout(() => {
      loadingPlaceholderTimer = undefined
      showLoadingPlaceholder.value = loading.value && vehicles.value.length === 0
    }, loadingPlaceholderDelayMs)
  }

  function hideLoadingPlaceholder () {
    if (loadingPlaceholderTimer !== undefined) {
      clearTimeout(loadingPlaceholderTimer)
      loadingPlaceholderTimer = undefined
    }
    showLoadingPlaceholder.value = false
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

  function retryVehicles () {
    if (loading.value) return

    void loadVehicles()
  }

  async function loadApplications () {
    try {
      applications.value = (await inspectionApplicationService.listCitizenApplications({ limit: 100, sortOrder: 'desc' })).data
    } catch {
      // Vehicle search remains available even if renewal actions cannot load.
    }
  }

  function inspectionState (vehicle: Vehicle): InspectionExpiryState {
    return inspectionExpiryState(vehicle.inspectionExpiryDate)
  }
  function _daysUntilExpiry (vehicle: Vehicle) {
    return daysUntilInspectionExpiry(vehicle.inspectionExpiryDate)
  }
  function stateColor (vehicle: Vehicle): 'error' | 'warning' | 'success' {
    return ({ expired: 'error', expiring: 'warning', valid: 'success' } as const)[inspectionState(vehicle)]
  }
  function stateLabel (vehicle: Vehicle) {
    return t(`inspection_dashboard_${inspectionState(vehicle)}`)
  }
  function formatDate (date: string | null) {
    return formatDisplayDate(date)
  }
  function vehicleName (vehicle: Vehicle) {
    return [vehicle.make, vehicle.model, vehicle.manufactureYear].filter(Boolean).join(' ')
  }
  function plateCategoryLabel (vehicle: Vehicle) {
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
  <!-- eslint-disable vue/html-indent, vue/padding-line-between-tags -->
  <section class="citizen-auth-type-scale vehicle-list-view">
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
        @click:clear="clearSearch"
        @click:prepend-inner="submitSearch"
        @keydown.enter.prevent="submitSearch"
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

    <div v-if="loading && vehicles.length === 0" :aria-busy="loading" aria-live="polite" class="vehicle-list-loading">
      <div v-if="showLoadingPlaceholder" class="vehicle-skeleton-grid">
        <v-skeleton-loader
          v-for="index in 3"
          :key="index"
          class="vehicle-card vehicle-card--skeleton"
          type="avatar, heading, paragraph, paragraph, paragraph, actions"
        />
      </div>
    </div>

    <v-alert v-else-if="loadError" class="mt-6" type="error" variant="tonal"><div class="d-flex flex-wrap align-center justify-space-between ga-3">{{ $t('inspection_dashboard_vehicle_load_error') }}<v-btn
      color="error"
      :disabled="loading"
      :loading="loading"
      variant="outlined"
      @click="retryVehicles"
    >{{ $t('retry') }}</v-btn></div></v-alert>

    <v-alert v-else-if="filteredVehicles.length === 0" class="mt-6" type="info" variant="tonal">{{ $t(searchTerm ? 'inspection_vehicle_search_empty' : selectedFilter === 'all' ? 'inspection_dashboard_no_vehicles' : 'inspection_no_filtered_vehicles') }}</v-alert>

    <div v-else class="vehicle-grid mt-6">
      <CitizenVehicleCard
        v-for="vehicle in filteredVehicles"
        :key="vehicle.id"
        :action-icon="vehicleRenewalAction(vehicle).icon"
        :action-label="$t(vehicleRenewalAction(vehicle).labelKey)"
        :action-loading="isRenewingVehicle(vehicle.id)"
        :certificate-number="vehicleIdentifier(vehicle, 'certificate')"
        :expiry-date="formatDate(vehicle.inspectionExpiryDate)"
        :has-certificate-number="Boolean(vehicleApplication(vehicle)?.certificate?.certificateNumber)"
        :has-transaction-number="Boolean(vehicleApplication(vehicle)?.payment?.transactionNumber)"
        :inspection-status="{ color: stateColor(vehicle), label: stateLabel(vehicle), modifier: inspectionState(vehicle) }"
        :plate-label="plateCategoryLabel(vehicle)"
        :renewal-status="vehicleRenewalStatusPresentation(vehicle)"
        :transaction-number="vehicleIdentifier(vehicle, 'transaction')"
        :vehicle="vehicle"
        :vehicle-icon="getVehicleTypeIcon(vehicle.vehicleType)"
        :vehicle-name="vehicleName(vehicle)"
        @renew="handleRenewalAction(vehicle)"
      />
    </div>

    <div v-if="!loading && !loadError && (vehicleMeta?.totalPages ?? 1) > 1" class="vehicle-pagination">
      <v-pagination
        :length="Math.max(1, vehicleMeta?.totalPages ?? 1)"
        :model-value="page"
        @update:model-value="changePage"
      />
    </div>
    <RenewalStartConfirmationDialog v-model="confirmationOpen" :loading="confirmationLoading" @confirm="confirmRenewal" />
  </section>
    </template>

<style scoped>
  .vehicle-list-view :deep(*) { font-weight: 400 !important; }
  .vehicle-list-view { padding-bottom: 24px; }
  .vehicle-list-heading h1 { color: #10172d; font-size: clamp(1.35rem, 2vw, 1.72rem); font-weight: 800; line-height: 1.2; }
  .vehicle-list-heading p { color: #656776; font-size: .95rem !important; margin-top: 5px; }
  .vehicle-search-toolbar { margin-top: 22px; max-width: 540px; width: 100%; }
  .vehicle-search { width: 100%; }
  .vehicle-search :deep(.v-field) { background: #fff; border-radius: 12px; box-shadow: 0 4px 14px rgba(30, 43, 95, .06); min-height: 54px; transition: box-shadow .18s ease, transform .18s ease; }
  .vehicle-search :deep(.v-field__outline) { --v-field-border-opacity: 1; color: #c5cada; }
  .vehicle-search :deep(.v-field__input) { color: #202744; font-size: .95rem !important; min-height: 54px; padding-top: 0; }
  .vehicle-search :deep(input::placeholder) { color: #8b91a2; opacity: 1; }
  .vehicle-search :deep(.v-field__prepend-inner) { color: #2a3472; opacity: 1; padding-right: 10px; }
  .vehicle-search :deep(.v-field--focused) { box-shadow: 0 0 0 4px rgba(42, 52, 114, .12), 0 7px 18px rgba(30, 43, 95, .1); transform: translateY(-1px); }
  .vehicle-search :deep(.v-field--focused .v-field__outline) { color: #2a3472; }
  .vehicle-filters { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
  .vehicle-filter { --v-btn-height: 36px; border-color: #cfd1db; color: #333747; font-size: .85rem !important; font-weight: 800; height: 36px !important; letter-spacing: .02em; min-height: 36px !important; min-width: 0; padding-inline: 16px !important; }
  .vehicle-filter--active { background: #293675 !important; color: #fff !important; }
  .vehicle-list-loading { margin-top: 24px; min-height: 380px; }
  .vehicle-skeleton-grid { display: grid; gap: 20px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .vehicle-card--skeleton { min-height: 340px; }
  .vehicle-grid { display: grid; gap: 20px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .vehicle-pagination { display: flex; justify-content: flex-end; margin-top: 28px; }
  .vehicle-pagination :deep(.v-pagination__list) { gap: 10px; justify-content: flex-end; }
  .vehicle-pagination :deep(.v-pagination__list > li) { margin: 0; }
  .vehicle-pagination :deep(.v-pagination__item), .vehicle-pagination :deep(.v-pagination__prev .v-btn), .vehicle-pagination :deep(.v-pagination__next .v-btn) { align-items: center; background: #fff; border: 1px solid #d5d7dc; border-radius: 9px; box-shadow: none; color: #20212a; display: inline-flex; font-size: .82rem; font-weight: 800; height: 36px; justify-content: center; min-width: 36px; padding: 0; width: 36px; }
  .vehicle-pagination :deep(.v-pagination__item .v-btn), .vehicle-pagination :deep(.v-pagination__prev .v-btn), .vehicle-pagination :deep(.v-pagination__next .v-btn) { height: 36px !important; max-height: 36px !important; max-width: 36px !important; min-height: 36px !important; min-width: 36px !important; padding: 0 !important; width: 36px !important; }
  .vehicle-pagination :deep(.v-pagination__item--is-active .v-btn) { background: #293675 !important; border-color: #293675 !important; color: #fff !important; opacity: 1 !important; }
  .vehicle-pagination :deep(.v-pagination__prev .v-btn--disabled), .vehicle-pagination :deep(.v-pagination__next .v-btn--disabled) { background: #f4f5f8 !important; border-color: #d7d9e1 !important; color: #8a90a0 !important; opacity: .78 !important; }
  .vehicle-card { background: #fff; border: 1px solid #d4d5de; border-radius: 20px; box-shadow: 0 6px 16px rgba(31, 36, 69, .05); display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
  .vehicle-card__main { display: flex; flex: 1; flex-direction: column; padding: 16px 18px 13px; }
  .vehicle-card__icon { background: #dbe3ff; color: #142c68; }
  .vehicle-inspection-status-row { display: flex; justify-content: flex-end; }
  .vehicle-state { font-size: .95rem !important; font-weight: 800; height: 28px !important; min-height: 28px; }
  .vehicle-state :deep(.v-chip__underlay), .vehicle-renewal-state :deep(.v-chip__underlay) { opacity: 0 !important; }
  .vehicle-state--expired { background: #fff0f0 !important; color: #b42318 !important; }
  .vehicle-state--expired :deep(.v-chip__underlay) { opacity: 0 !important; }
  .vehicle-state--expiring { background: #fff3e8 !important; color: #c25f00 !important; }
  .vehicle-state--expiring :deep(.v-chip__underlay) { opacity: 0 !important; }
  .vehicle-state--valid { background: #ecfdf3 !important; color: #166534 !important; }
  .vehicle-renewal-state-slot { align-items: flex-start; display: flex; justify-content: flex-end; margin-top: 5px; min-height: 28px; }
  .vehicle-renewal-state { display: flex; font-size: .82rem !important; font-weight: 800; height: 28px !important; min-height: 28px; }
  .vehicle-renewal-state--info { background: #e8f4fc !important; color: #1683bd !important; }
  .vehicle-renewal-state--deep-purple { background: #f4f1ff !important; color: #5b21b6 !important; }
  .vehicle-renewal-state--secondary { background: #f7f2ff !important; color: #6b21a8 !important; }
  .vehicle-renewal-state--success { background: #ecfdf3 !important; color: #166534 !important; }
  .vehicle-renewal-state--warning { background: #fff3e8 !important; color: #c25f00 !important; }
  .vehicle-renewal-state--error { background: #fff0f0 !important; color: #b42318 !important; }
  .vehicle-state :deep(.v-chip__content), .vehicle-renewal-state :deep(.v-chip__content) { font-size: .82rem !important; line-height: 1.5; }
  .vehicle-card__title { margin-top: 11px; }
  .vehicle-card__title h2 { align-items: center; color: #171b28 !important; display: flex; flex-wrap: wrap; font-size: 1rem !important; font-weight: 400 !important; gap: 7px; line-height: 1.25; }
  .vehicle-plate-label { color: #171b28 !important; font: inherit; font-weight: 400 !important; }
  .vehicle-card__title p { color: #173d8d !important; font-size: .95rem !important; font-weight: 400 !important; line-height: 1.45; margin-top: 3px; }
  .vehicle-facts { margin-top: 12px; }
  .vehicle-facts > div { align-items: center; border-bottom: 1px solid #e2e3e9; display: grid; gap: 12px; grid-template-columns: minmax(86px, 1fr) minmax(106px, 1.3fr); min-height: 48px; }
  .vehicle-facts dt { color: #4f5361; font-size: .9rem !important; font-weight: 600; line-height: 1.45; }
  .vehicle-facts dd { color: #181c27; font-size: .95rem !important; font-weight: 800; line-height: 1.45; margin: 0; overflow-wrap: anywhere; text-align: right; }
  .vehicle-facts__placeholder { color: #252934 !important; font-style: normal; font-weight: 400 !important; }
  .vehicle-facts__type { align-items: start !important; grid-template-columns: minmax(82px, .75fr) minmax(175px, 1.75fr) !important; padding-block: 10px; }
  .vehicle-facts__type dt { color: #4f5361; padding-top: 2px; }
  .vehicle-facts__type dd { color: #181c27; font-size: .91rem !important; line-height: 1.5; text-align: right; }
  .vehicle-facts__type + .vehicle-facts__identifier { border-top: 1px solid #e2e3e9; margin-top: 10px; }
  .vehicle-facts__inspection-status { border-top: 1px solid #e2e3e9; margin-top: 10px; }
  .vehicle-facts__expiry { background: transparent; border-bottom: 1px solid #e2e3e9 !important; border-radius: 0; grid-template-columns: minmax(86px, 1fr) minmax(106px, 1.3fr) !important; margin-top: 0; padding-inline: 0; }
  .vehicle-facts__expiry dt { color: #4f5361; font-size: .85rem !important; }
  .vehicle-facts__expiry dd { font-size: .95rem !important; }
  .vehicle-list-view .vehicle-card .vehicle-facts dt { font-size: .85rem !important; }
  .vehicle-facts__expiry--valid, .vehicle-facts__expiry--expired, .vehicle-facts__expiry--expiring, .vehicle-facts__expiry dt { background: transparent; color: #5d6170; }.vehicle-facts__expiry--valid dd { color: #166534; }.vehicle-facts__expiry--expired dd { color: #b42318; }.vehicle-facts__expiry--expiring dd { color: #92400e; }
  .vehicle-card__actions { background: #fafafd; border-top: 1px solid #d7d8e1; display: flex; gap: 8px; margin-top: auto; padding: 10px 12px; }.vehicle-card__actions :deep(.v-btn) { font-size: .85rem !important; font-weight: 800; letter-spacing: 0; min-height: 39px; text-transform: none; }
  @media (max-width: 1279px) { .vehicle-grid, .vehicle-skeleton-grid { grid-template-columns: 1fr; } }
  @media (max-width: 600px) { .vehicle-card { border-radius: 20px; }.vehicle-card__main { padding: 22px 20px; }.vehicle-card__actions { flex-direction: column; padding: 16px; }.vehicle-facts > div { align-items: start; grid-template-columns: 1fr; padding-block: 9px; }.vehicle-facts dd { text-align: left; }.vehicle-facts__expiry { grid-template-columns: 1fr !important; } }
  @media (prefers-reduced-motion: reduce) { .vehicle-card--skeleton :deep(.v-skeleton-loader__bone) { animation: none !important; } }
</style>
