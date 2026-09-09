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
  const showLoadingPlaceholder = ref(false)
  const loadError = ref(false)
  const selectedFilter = ref<VehicleFilter>('all')
  const search = ref<string | null>('')
  const renewingVehicleIds = ref<Set<string>>(new Set())
  const renewalError = ref<string | null>(null)
  const vehiclePageSize = 12
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
  const filteredVehicles = computed(() =>
    vehicles.value
      .filter(vehicle => vehicleMatchesSearch(vehicle, searchTerm.value))
      .filter(vehicle => selectedFilter.value === 'all' || inspectionState(vehicle) === selectedFilter.value),
  )

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
      void loadVehicles()
    }, 300)
  })

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
        ...(searchTerm.value ? { search: searchTerm.value } : {}),
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
      applications.value = (await inspectionApplicationService.listCitizenApplications()).data
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
      <article v-for="vehicle in filteredVehicles" :key="vehicle.id" class="vehicle-card">
        <div class="vehicle-card__main">
          <div class="d-flex align-start justify-space-between ga-3">
            <v-avatar class="vehicle-card__icon" :icon="getVehicleTypeIcon(vehicle.vehicleType)" size="52" />

            <div class="text-right"><div class="vehicle-inspection-status-row"><v-chip
                                      :class="['vehicle-state', `vehicle-state--${inspectionState(vehicle)}`]"
                                      :color="stateColor(vehicle)"
                                      :prepend-icon="stateIcon(vehicle)"
                                      size="small"
                                      :style="{ fontSize: '.82rem', height: '28px', minHeight: '28px' }"
                                      variant="tonal"
                                    >{{ stateLabel(vehicle) }}</v-chip></div>

              <div class="vehicle-renewal-state-slot"><v-chip
                v-if="vehicleRenewalStatus(vehicle)"
                :class="['vehicle-renewal-state', `vehicle-renewal-state--${vehicleRenewalStatus(vehicle)?.color}`]"
                :color="vehicleRenewalStatus(vehicle)?.color"
                :prepend-icon="vehicleRenewalStatus(vehicle)?.icon"
                size="small"
                :style="{ fontSize: '.78rem', height: '28px', minHeight: '28px' }"
                variant="tonal"
              >{{ $t(vehicleRenewalStatus(vehicle)?.labelKey ?? '') }}</v-chip></div></div>
          </div>

          <div class="vehicle-card__title"><h2><span class="vehicle-plate-label">{{ plateCategoryLabel(vehicle) }}</span>{{ vehicle.plateNumber }}</h2><p>{{ vehicleName(vehicle) }}</p></div>

          <dl class="vehicle-facts">
            <div><dt>{{ $t('inspection_vehicle_type') }}</dt><dd>{{ formatVehicleType(vehicle.vehicleType, t) }}</dd></div>
            <div><dt>{{ $t('inspection_registration_number') }}</dt><dd>{{ vehicle.registrationNumber || '—' }}</dd></div>
            <div><dt>{{ $t('inspection_last_inspection_date') }}</dt><dd>{{ formatDate(vehicle.lastInspectionDate) }}</dd></div>
            <div :class="`vehicle-facts__expiry vehicle-facts__expiry--${inspectionState(vehicle)}`"><dt><v-icon icon="mdi-calendar-month-outline" size="20" />{{ $t('inspection_dashboard_expiry_date') }}</dt><dd>{{ formatDate(vehicle.inspectionExpiryDate) }}</dd></div>
          </dl>
        </div>

        <div class="vehicle-card__actions"><v-btn class="flex-grow-1" prepend-icon="mdi-eye-outline" :to="`/services/inspection/vehicles/${vehicle.id}`" variant="outlined">{{ $t('inspection_dashboard_view_vehicle') }}</v-btn>

          <v-btn
            v-if="unfinishedApplication(vehicle) || inspectionState(vehicle) !== 'valid'"
            class="flex-grow-1"
            color="primary"
            :loading="isRenewingVehicle(vehicle.id)"
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
  .vehicle-card__main { padding: 16px 18px 13px; }
  .vehicle-card__icon { background: #dbe3ff; color: #142c68; }
  .vehicle-inspection-status-row { display: flex; justify-content: flex-end; }
  .vehicle-state { font-size: .82rem !important; font-weight: 800; height: 28px !important; min-height: 28px; }
  .vehicle-state--expired { background: #fee2e2 !important; color: #991b1b !important; }
  .vehicle-state--expiring { background: #fff1cf !important; color: #92400e !important; }
  .vehicle-state--valid { background: #dcfce7 !important; color: #166534 !important; }
  .vehicle-renewal-state-slot { align-items: flex-start; display: flex; justify-content: flex-end; margin-top: 5px; min-height: 28px; }
  .vehicle-renewal-state { display: flex; font-size: .82rem !important; font-weight: 800; height: 28px !important; min-height: 28px; }
  .vehicle-renewal-state--info { background: #dbeeff !important; color: #075985 !important; }
  .vehicle-renewal-state--deep-purple { background: #ede9fe !important; color: #5b21b6 !important; }
  .vehicle-renewal-state--secondary { background: #f0e7ff !important; color: #6b21a8 !important; }
  .vehicle-renewal-state--success { background: #dcfce7 !important; color: #166534 !important; }
  .vehicle-renewal-state--warning { background: #fff1cf !important; color: #8a4b00 !important; }
  .vehicle-renewal-state--error { background: #fee2e2 !important; color: #b42318 !important; }
  .vehicle-state :deep(.v-chip__content), .vehicle-renewal-state :deep(.v-chip__content) { font-size: .82rem !important; line-height: 1.5; }
  .vehicle-card__title { margin-top: 11px; }
  .vehicle-card__title h2 { align-items: center; color: #171b28 !important; display: flex; flex-wrap: wrap; font-size: 1rem !important; font-weight: 400 !important; gap: 7px; line-height: 1.25; }
  .vehicle-plate-label { color: #171b28 !important; font: inherit; font-weight: 400 !important; }
  .vehicle-card__title p { color: #173d8d !important; font-size: .95rem !important; font-weight: 400 !important; line-height: 1.45; margin-top: 3px; }
  .vehicle-facts { margin-top: 12px; }
  .vehicle-facts > div { align-items: center; border-bottom: 1px solid #e2e3e9; display: grid; gap: 12px; grid-template-columns: minmax(86px, 1fr) minmax(106px, 1.3fr); min-height: 48px; }
  .vehicle-facts dt { color: #4f5361; font-size: .9rem !important; font-weight: 600; line-height: 1.45; }
  .vehicle-facts dd { color: #181c27; font-size: .95rem !important; font-weight: 800; line-height: 1.45; margin: 0; overflow-wrap: anywhere; text-align: right; }
  .vehicle-facts__expiry { background: #f4f2f6; border-bottom: 0 !important; border-radius: 9px; grid-template-columns: minmax(175px, 1fr) auto !important; margin-top: 8px; padding-inline: 10px; }
  .vehicle-facts__expiry dt { align-items: center; color: #626876; display: flex; font-size: .9rem !important; gap: 8px; white-space: nowrap; }
  .vehicle-facts__expiry dd { font-size: .95rem !important; }
  .vehicle-list-view .vehicle-card .vehicle-facts dt { font-size: .85rem !important; }
  .vehicle-facts__expiry--valid { background: #dcfce7; color: #166534; }.vehicle-facts__expiry--valid dt, .vehicle-facts__expiry--valid dd { color: #166534; }
  .vehicle-facts__expiry--expired { background: #fee2e2; color: #991b1b; }.vehicle-facts__expiry--expired dt, .vehicle-facts__expiry--expired dd { color: #991b1b; }
  .vehicle-facts__expiry--expiring { background: #fff1cf; color: #92400e; }.vehicle-facts__expiry--expiring dt, .vehicle-facts__expiry--expiring dd { color: #92400e; }
  .vehicle-card__actions { background: #fafafd; border-top: 1px solid #d7d8e1; display: flex; gap: 8px; padding: 10px 12px; }.vehicle-card__actions :deep(.v-btn) { font-size: .85rem !important; font-weight: 800; letter-spacing: 0; min-height: 39px; text-transform: none; }
  @media (max-width: 1279px) { .vehicle-grid, .vehicle-skeleton-grid { grid-template-columns: 1fr; } }
  @media (max-width: 600px) { .vehicle-card { border-radius: 20px; }.vehicle-card__main { padding: 22px 20px; }.vehicle-card__actions { flex-direction: column; padding: 16px; } }
  @media (prefers-reduced-motion: reduce) { .vehicle-card--skeleton :deep(.v-skeleton-loader__bone) { animation: none !important; } }
</style>
