<script setup lang="ts">
  import type { Vehicle } from '../vehicles/types/vehicle.types'
  import type { CitizenInspectionHistoryItem, CitizenInspectionResult, InspectionHistoryPagination } from './types/inspection-history.types'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { inspectionVehicleService } from '../vehicles/services/vehicle.service'
  import { formatProvince, normalizeProvinceSearch } from '../vehicles/utils/province-label'
  import { inspectionHistoryService } from './services/inspection-history.service'
  import { formatInspectionHistoryDate, inspectionResultLabel } from './utils/inspection-history-display'

  type VehiclePlate = Pick<Vehicle, 'plateCategory' | 'plateProvince' | 'plateNumber'> | CitizenInspectionHistoryItem['vehicle']
  type HistoryResultFilter = CitizenInspectionResult | 'ALL'

  const { locale, t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const inspections = ref<CitizenInspectionHistoryItem[]>([])
  const vehicles = ref<Vehicle[]>([])
  const meta = ref<InspectionHistoryPagination | null>(null)
  const page = ref(1)
  const historyPageSize = 20
  const historySearchDebounceMs = 350
  const selectedVehicleId = ref<string | null>(null)
  const selectedResult = ref<HistoryResultFilter>('ALL')
  const vehicleSearchQuery = ref('')
  const loading = ref(true)
  const loadError = ref(false)
  let historyRequest = 0
  let searchDebounce: ReturnType<typeof setTimeout> | undefined

  const selectedVehicle = computed(() => vehicles.value.find(vehicle => vehicle.id === selectedVehicleId.value) ?? null)
  const resultOptions = computed<Array<{ title: string, value: HistoryResultFilter }>>(() => [
    { title: t('inspection_history_filter_all'), value: 'ALL' },
    { title: t('inspection_history_passed'), value: 'PASS' },
    { title: t('inspection_history_failed'), value: 'FAIL' },
  ])

  onMounted(initialize)

  onBeforeUnmount(() => {
    clearSearchDebounce()
  })

  watch(vehicleSearchQuery, () => {
    page.value = 1
    clearSearchDebounce()
    searchDebounce = setTimeout(() => {
      searchDebounce = undefined
      void loadHistory()
    }, historySearchDebounceMs)
  }, { flush: 'sync' })

  watch(() => route.query.vehicleId, () => {
    void applyVehicleFromRoute()
  })

  async function initialize () {
    await loadVehicles()
    await applyVehicleFromRoute(false)
    await loadHistory()
  }

  async function loadVehicles () {
    try {
      vehicles.value = await loadVehiclePages()
    } catch {
      vehicles.value = []
    }
  }

  async function loadVehiclePages (search?: string): Promise<Vehicle[]> {
    const firstPage = await inspectionVehicleService.lookup({ page: 1, limit: 100, ...(search ? { search } : {}) })
    const remainingPages = await Promise.all(
      Array.from(
        { length: Math.max(0, firstPage.meta.totalPages - 1) },
        (_, index) => inspectionVehicleService.lookup({ page: index + 2, limit: 100, ...(search ? { search } : {}) }),
      ),
    )

    return [firstPage.data, ...remainingPages.map(response => response.data)].flat()
  }

  async function applyVehicleFromRoute (load = true) {
    const requestedVehicleId = typeof route.query.vehicleId === 'string' ? route.query.vehicleId : null
    const nextVehicleId = requestedVehicleId !== null && vehicles.value.some(vehicle => vehicle.id === requestedVehicleId)
      ? requestedVehicleId
      : null

    if (requestedVehicleId !== null && nextVehicleId === null) {
      const query = { ...route.query }
      delete query.vehicleId
      await router.replace({ query })
      return
    }

    if (nextVehicleId === selectedVehicleId.value) return
    selectedVehicleId.value = nextVehicleId
    page.value = 1
    if (load) await loadHistory()
  }

  async function selectVehicle (vehicleId: string | null) {
    const query = { ...route.query }
    if (vehicleId === null) delete query.vehicleId
    else query.vehicleId = vehicleId
    await router.push({ query })
  }

  async function loadHistory () {
    const request = ++historyRequest
    loading.value = true
    loadError.value = false
    try {
      const response = await inspectionHistoryService.list({
        page: page.value,
        limit: historyPageSize,
        vehicleId: selectedVehicleId.value ?? undefined,
        result: selectedResult.value === 'ALL' ? undefined : selectedResult.value,
        search: vehicleSearchQuery.value.trim() ? normalizeProvinceSearch(vehicleSearchQuery.value) : undefined,
      })
      if (request !== historyRequest) return
      inspections.value = response.data
      meta.value = response.meta
    } catch {
      if (request !== historyRequest) return
      loadError.value = true
    } finally {
      if (request === historyRequest) loading.value = false
    }
  }

  function changePage (value: number) {
    if (value === page.value) return
    page.value = value
    void loadHistory()
  }

  function changeResult (value: HistoryResultFilter = 'ALL') {
    if (value === selectedResult.value) return
    selectedResult.value = value
    page.value = 1
    void loadHistory()
  }

  function retryHistory () {
    if (loading.value) return

    void loadHistory()
  }

  function submitSearch () {
    clearSearchDebounce()
    page.value = 1
    void loadHistory()
  }

  function clearSearch () {
    vehicleSearchQuery.value = ''
    submitSearch()
  }

  function clearSearchDebounce () {
    if (searchDebounce !== undefined) {
      clearTimeout(searchDebounce)
      searchDebounce = undefined
    }
  }

  function vehiclePlateLabel (vehicle: VehiclePlate) {
    if (vehicle.plateCategory === 'PERSONALIZED_CAMBODIA') return `${t('inspection_plate_cambodia')} ${vehicle.plateNumber}`
    const province = formatProvince(vehicle.plateProvince, locale.value)
    return [province, vehicle.plateNumber].filter(Boolean).join(' ')
  }

  function formatDate (value: string) {
    return formatInspectionHistoryDate(value, locale.value)
  }

  function vehicleName (inspection: CitizenInspectionHistoryItem) {
    const currentVehicle = vehicles.value.find(vehicle => vehicle.registrationNumber === inspection.vehicle.registrationNumber)
    return [inspection.vehicle.make, inspection.vehicle.model, currentVehicle?.manufactureYear].filter(Boolean).join(' ') || '—'
  }

  function historyPlateLabel (inspection: CitizenInspectionHistoryItem) {
    return vehiclePlateLabel(inspection.vehicle)
  }

  function stationName (inspection: CitizenInspectionHistoryItem) {
    return locale.value === 'kh'
      ? inspection.station.nameKh || inspection.station.nameEn
      : inspection.station.nameEn || inspection.station.nameKh
  }

  function resultLabel (inspection: CitizenInspectionHistoryItem) {
    return inspectionResultLabel(inspection.result, t)
  }

  function resultColor (inspection: CitizenInspectionHistoryItem) {
    return inspection.result === 'PASS' ? 'success' : 'error'
  }

  function resultIcon (inspection: CitizenInspectionHistoryItem) {
    return inspection.result === 'PASS' ? 'mdi-check-circle-outline' : 'mdi-close-circle-outline'
  }

  function viewInspection (inspection: CitizenInspectionHistoryItem) {
    void router.push(`/services/inspection/inspection-history/${inspection.inspectionId}`)
  }

</script>

<template>
  <!-- eslint-disable vue/html-indent, vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <section class="citizen-auth-type-scale inspection-history-view">
    <div v-if="selectedVehicle" class="inspection-history-topline">
      <v-btn
        class="history-back-action"
        :class="{ 'history-back-action--english': locale === 'en' }"
        prepend-icon="mdi-arrow-left"
        variant="text"
        @click="selectVehicle(null)"
      >{{ $t('inspection_history_back_to_all_vehicles') }}</v-btn>
    </div>

    <header class="inspection-history-heading">
      <h1>{{ $t('inspection_history') }}</h1>
      <p>{{ $t('inspection_history_description') }}</p>
    </header>

    <div class="inspection-history-filter">
      <div class="inspection-history-filter__content">
        <v-text-field
          v-model="vehicleSearchQuery"
          :aria-label="$t('inspection_history_search_vehicle')"
          class="history-vehicle-search"
          clear-icon="mdi-close"
          clearable
          density="comfortable"
          hide-details
          :placeholder="$t('inspection_history_search_placeholder')"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          @click:clear="clearSearch"
          @click:prepend-inner="submitSearch"
          @keydown.enter.prevent="submitSearch"
        />

        <div :aria-label="$t('inspection_history_status_filter')" class="history-result-filters" role="tablist">
          <v-btn
            v-for="option in resultOptions"
            :key="option.value"
            class="history-result-filter"
            :class="{ 'history-result-filter--active': selectedResult === option.value }"
            rounded="pill"
            :variant="selectedResult === option.value ? 'flat' : 'outlined'"
            @click="changeResult(option.value)"
          >{{ option.title }}</v-btn>
        </div>
      </div>

    </div>

    <div v-if="loading" class="inspection-history-state">
      <v-progress-circular color="primary" indeterminate size="42" />
      <span>{{ $t('loading') }}</span>
    </div>

    <v-alert v-else-if="loadError" class="mt-6" type="error" variant="tonal">
      <div class="d-flex flex-wrap align-center justify-space-between ga-3">
        {{ $t('inspection_history_load_error') }}
        <v-btn
          color="error"
          :disabled="loading"
          :loading="loading"
          variant="outlined"
          @click="retryHistory"
        >{{ $t('retry') }}</v-btn>
      </div>
    </v-alert>

    <v-card v-else-if="inspections.length === 0" class="inspection-history-empty mt-6" elevation="0">
      <v-avatar color="primary" icon="mdi-history" size="58" variant="tonal" />
      <h2>{{ $t(selectedVehicle ? 'inspection_history_vehicle_empty_title' : 'inspection_history_empty_title') }}</h2>
      <p v-if="!selectedVehicle">{{ $t('inspection_history_empty_description') }}</p>
    </v-card>

    <template v-else>
      <v-card class="inspection-history-table mt-6" elevation="0">
        <v-table class="history-desktop">
          <colgroup>
            <col class="history-column-reference">
            <col class="history-column-plate">
            <col class="history-column-vehicle">
            <col class="history-column-date">
            <col class="history-column-station">
            <col class="history-column-result">
            <col class="history-column-action">
          </colgroup>

          <thead>
            <tr>
              <th class="history-table-header">{{ $t('inspection_history_transaction_number') }}</th>
              <th class="history-table-header">{{ $t('inspection_history_plate_label') }}</th>
              <th class="history-table-header">{{ $t('inspection_history_vehicle') }}</th>
              <th class="history-table-header">{{ $t('inspection_history_date') }}</th>
              <th class="history-table-header">{{ $t('inspection_history_station') }}</th>
              <th class="history-table-header">{{ $t('inspection_history_result') }}</th>
              <th class="history-table-header">{{ $t('inspection_history_action') }}</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="inspection in inspections" :key="`${inspection.applicationId}-${inspection.attemptNumber}-${inspection.inspectedAt}`">
              <td class="history-reference">{{ inspection.transactionNumber || '—' }}</td>
              <td class="history-plate">{{ historyPlateLabel(inspection) }}</td>
              <td class="history-vehicle"><strong>{{ vehicleName(inspection) }}</strong></td>
              <td>{{ formatDate(inspection.inspectedAt) }}</td>
              <td>{{ stationName(inspection) }}</td>

              <td><div class="history-result-cell"><v-chip
                    :class="['history-result-chip', `history-result-chip--${inspection.result.toLowerCase()}`]"
                    :color="resultColor(inspection)"
                    :prepend-icon="resultIcon(inspection)"
                    size="small"
                    variant="tonal"
                  >{{ resultLabel(inspection) }}</v-chip></div></td>
              <td><v-btn :aria-label="$t('inspection_history_view_details')" icon="mdi-eye-outline" size="small" :title="$t('inspection_history_view_details')" variant="text" @click="viewInspection(inspection)" /></td>
            </tr>
          </tbody>
        </v-table>

        <div class="history-mobile">
          <article v-for="inspection in inspections" :key="`${inspection.applicationId}-${inspection.attemptNumber}-${inspection.inspectedAt}`" class="history-card">
            <div class="history-card__top"><strong class="history-reference">{{ inspection.transactionNumber || '—' }}</strong>

              <v-chip
                :class="['history-result-chip', `history-result-chip--${inspection.result.toLowerCase()}`]"
                :color="resultColor(inspection)"
                :prepend-icon="resultIcon(inspection)"
                size="small"
                variant="tonal"
              >{{ resultLabel(inspection) }}</v-chip></div>

            <div class="history-card__vehicle"><strong>{{ vehicleName(inspection) }}</strong><v-btn :aria-label="$t('inspection_history_view_details')" icon="mdi-eye-outline" size="small" :title="$t('inspection_history_view_details')" variant="text" @click="viewInspection(inspection)" /></div>
            <dl class="history-card__facts"><div><dt>{{ $t('inspection_history_date') }}</dt><dd class="history-date">{{ formatDate(inspection.inspectedAt) }}</dd></div><div><dt>{{ $t('inspection_history_plate_label') }}</dt><dd class="history-plate">{{ historyPlateLabel(inspection) }}</dd></div><div><dt>{{ $t('inspection_history_station') }}</dt><dd>{{ stationName(inspection) }}</dd></div></dl>
          </article>
        </div>
      </v-card>

      <div v-if="(meta?.totalPages ?? 1) > 1" class="inspection-history-pagination">
        <v-pagination :length="Math.max(1, meta?.totalPages ?? 1)" :model-value="page" @update:model-value="changePage" />
      </div>
    </template>
  </section>
</template>

<style scoped>
  .inspection-history-view :deep(*) { font-weight: 400 !important; }
  .inspection-history-view { padding-bottom: 24px; position: relative; }
  .inspection-history-topline { display: flex; justify-content: flex-end; position: absolute; right: 0; top: 0; }.history-back-action { color: #273d7a; font-weight: 800; }
  .inspection-history-heading h1 { color: #10172d; font-size: clamp(1.35rem, 2vw, 1.72rem); font-weight: 800; line-height: 1.2; }
  .inspection-history-heading p { color: #656776; font-size: .91rem; margin-top: 12px; }
  .inspection-history-filter { display: grid; gap: 7px; margin-top: 22px; }
  .inspection-history-filter__label { color: #454854; font-size: .82rem; font-weight: 800; }
  .inspection-history-filter__content { align-items: center; display: flex; gap: 12px; }
  .inspection-history-filter__content--selected { display: inline-flex; max-width: 100%; }
  .all-vehicles-summary { color: #4f5360; font-size: .84rem; font-weight: 800; height: 36px; padding-inline: 14px; }.history-search-vehicle { min-height: 36px; }
  .vehicle-search-dialog { border-radius: 18px; overflow: hidden; }.vehicle-search-dialog__header { align-items: flex-start; border-bottom: 1px solid #e1e2e8; display: flex; justify-content: space-between; gap: 16px; padding: 20px 20px 14px; }.vehicle-search-dialog__header h2 { color: #1d2130; font-size: 1.18rem; font-weight: 800; }.vehicle-search-dialog__header p { color: #686b77; font-size: .86rem; margin-top: 4px; }.vehicle-search-dialog__body { padding: 20px; }
  .vehicle-search-results { display: grid; gap: 8px; max-height: min(48vh, 420px); overflow-y: auto; padding-right: 2px; }.vehicle-search-results__loading { align-items: center; display: flex; justify-content: center; min-height: 160px; }.vehicle-search-result { align-items: center; background: #fff; border: 1px solid #e0e2e9; border-radius: 12px; cursor: pointer; display: flex; gap: 12px; min-width: 0; padding: 12px; text-align: left; width: 100%; }.vehicle-search-result:hover, .vehicle-search-result:focus-visible, .vehicle-search-result--selected { background: #f2f5ff; border-color: #6b83c8; outline: none; }.vehicle-search-result__content { display: grid; gap: 3px; min-width: 0; flex: 1; }.vehicle-search-result__content strong { color: #20232e; font-size: .93rem; overflow-wrap: anywhere; }.vehicle-search-result__content span { color: #636774; font-size: .82rem; font-weight: 700; overflow-wrap: anywhere; }
  .history-vehicle { min-width: 150px; }
  .inspection-history-state { align-items: center; color: #656776; display: flex; flex-direction: column; gap: 14px; justify-content: center; min-height: 360px; }
  .inspection-history-table, .inspection-history-empty { border: 1px solid #d4d5de; border-radius: 16px; box-shadow: 0 6px 16px rgba(31, 36, 69, .05); }
  .inspection-history-empty { align-items: center; display: flex; flex-direction: column; min-height: 280px; justify-content: center; padding: 30px; text-align: center; }
  .inspection-history-empty h2 { color: #20212a; font-size: .95rem; font-weight: 800; margin-top: 14px; }.inspection-history-empty p { color: #656776; font-size: .85rem; margin-top: 5px; }
  .history-desktop { min-width: 1180px; table-layout: fixed; width: 100%; }.history-desktop :deep(.v-table__wrapper) { height: auto !important; max-height: none !important; overflow-x: auto !important; overflow-y: hidden !important; }.history-desktop :deep(th) { background: #f7f8fc; color: #535867; font-size: .84rem; font-weight: 800; white-space: nowrap; }.history-desktop :deep(td) { color: #252934; font-size: .93rem; font-weight: 600; padding-block: 15px; vertical-align: top; }.history-desktop :deep(tr:last-child td) { border-bottom: 0; }.history-desktop :deep(.history-column-date) { width: 13%; }.history-desktop :deep(.history-column-reference) { width: 20%; }.history-desktop :deep(.history-column-vehicle) { width: 17%; }.history-desktop :deep(.history-column-station) { width: 25%; }.history-desktop :deep(.history-column-result) { width: 18%; }.history-desktop :deep(.history-column-action) { width: 7%; }.history-table-header--action, .history-action { text-align: center; }.history-desktop--selected :deep(.history-column-date) { width: 16%; }.history-desktop--selected :deep(.history-column-reference) { width: 25%; }.history-desktop--selected :deep(.history-column-station) { width: 37%; }.history-desktop--selected :deep(.history-column-result) { width: 15%; }
  .history-reference { color: #2a3472; font-family: 'Siemreap', sans-serif; font-size: .88rem; font-weight: 700; white-space: nowrap; }.history-secondary { color: #5b5f6d; display: block; font-size: .84rem; font-weight: 600; margin-top: 3px; }.history-result-cell { min-width: 0; }
  .history-mobile { display: none; }.inspection-history-pagination { display: flex; justify-content: flex-end; margin-top: 24px; }.inspection-history-pagination :deep(.v-pagination__list) { gap: 10px; justify-content: flex-end; }.inspection-history-pagination :deep(.v-pagination__list > li) { margin: 0; }.inspection-history-pagination :deep(.v-pagination__item), .inspection-history-pagination :deep(.v-pagination__prev .v-btn), .inspection-history-pagination :deep(.v-pagination__next .v-btn) { align-items: center; background: #fff; border: 1px solid #d5d7dc; border-radius: 9px; box-shadow: none; color: #20212a; display: inline-flex; font-size: .86rem; font-weight: 800; height: 36px; justify-content: center; min-width: 36px; padding: 0; width: 36px; }.inspection-history-pagination :deep(.v-pagination__item--is-active .v-btn) { background: #293675 !important; border-color: #293675 !important; color: #fff !important; opacity: 1 !important; }.inspection-history-pagination :deep(.v-pagination__prev .v-btn--disabled), .inspection-history-pagination :deep(.v-pagination__next .v-btn--disabled) { background: #f4f5f8 !important; border-color: #d7d9e1 !important; color: #8a90a0 !important; opacity: .78 !important; }
  .inspection-history-pagination :deep(.v-pagination__item .v-btn), .inspection-history-pagination :deep(.v-pagination__prev .v-btn), .inspection-history-pagination :deep(.v-pagination__next .v-btn) { height: 36px !important; max-height: 36px !important; max-width: 36px !important; min-height: 36px !important; min-width: 36px !important; padding: 0 !important; width: 36px !important; }
  @media (max-width: 900px) { .inspection-history-filter__content { align-items: stretch; flex-direction: column; }.history-desktop { display: none; }.history-mobile { display: grid; gap: 0; }.history-card { border-bottom: 1px solid #e2e3e9; padding: 18px; }.history-card:last-child { border-bottom: 0; }.history-card__top { align-items: center; display: flex; gap: 10px; justify-content: space-between; }.history-card__vehicle { color: #292b35; display: grid; font-size: .96rem; gap: 3px; margin-top: 14px; }.history-card__vehicle span { color: #676a76; font-size: .83rem; font-weight: 600; }.history-card__facts { display: grid; gap: 12px; margin-top: 16px; }.history-card__facts div { display: grid; gap: 3px; }.history-card__facts dt { color: #696c78; font-size: .72rem; font-weight: 700; }.history-card__facts dd { color: #2d303a; font-size: .84rem; font-weight: 700; margin: 0; overflow-wrap: anywhere; } }
  @media (max-width: 600px) { .vehicle-search-dialog__header, .vehicle-search-dialog__body { padding-inline: 16px; }.vehicle-search-result { align-items: flex-start; }.vehicle-search-dialog { border-radius: 14px; } }
  .inspection-history-heading p { font-size: .94rem; }
  .inspection-history-filter__label { color: #282a33; font-size: .94rem; }
  .history-table-header { font-size: .88rem !important; font-weight: 600 !important; }
  .history-desktop :deep(td), .history-secondary { font-size: .94rem; }
  .inspection-history-view .history-desktop :deep(td:nth-child(4)),
  .history-reference { color: #2a3472 !important; font-size: .86rem; }
  .history-desktop :deep(.v-chip), .history-mobile :deep(.v-chip) { font-size: .84rem; }
  .history-result-chip--pass { background: #ecfdf3 !important; color: #166534 !important; }
  .history-result-chip--fail { background: #fff0f0 !important; color: #991b1b !important; }
  .all-vehicles-summary, .history-search-vehicle { font-size: .88rem; }
  .all-vehicles-summary { background: #293675 !important; color: #fff !important; }
  .history-search-vehicle { background: #fff !important; border: 1px solid #c5cada; border-radius: 12px; box-shadow: 0 4px 14px rgba(30, 43, 95, .06); color: #2a3472 !important; min-height: 54px; padding-inline: 20px; }
  .history-search-vehicle:hover { background: #f5f7ff !important; border-color: #2a3472; box-shadow: 0 7px 18px rgba(30, 43, 95, .1); }
  .inspection-history-filter__content { align-items: stretch; flex-direction: column; max-width: 675px; width: 100%; }
  .history-vehicle-search { width: 100%; }
  .history-vehicle-search :deep(.v-field) { background: #fff; border-radius: 12px; box-shadow: 0 4px 14px rgba(30, 43, 95, .06); min-height: 54px; transition: box-shadow .18s ease, transform .18s ease; }
  .history-vehicle-search :deep(.v-field__outline) { --v-field-border-opacity: 1; color: #c5cada; }
  .history-vehicle-search :deep(.v-field__input) { color: #202744; font-size: .94rem; min-height: 54px; padding-top: 0; }
  .history-vehicle-search :deep(input::placeholder) { color: #8b91a2; opacity: 1; }
  .history-vehicle-search :deep(.v-field__prepend-inner) { color: #2a3472; cursor: pointer; opacity: 1; padding-right: 10px; }
  .history-vehicle-search :deep(.v-list-item-title) { color: #282a33; font-size: .94rem; }
  .history-vehicle-search :deep(.v-list-item-subtitle) { font-size: .88rem; }
  .history-vehicle-search :deep(.v-autocomplete__menu-icon) { display: none; }
  .history-vehicle-search :deep(.v-field--focused) { box-shadow: 0 0 0 4px rgba(42, 52, 114, .12), 0 7px 18px rgba(30, 43, 95, .1); transform: translateY(-1px); }
  .history-vehicle-search :deep(.v-field--focused .v-field__outline) { color: #2a3472; }
  .history-result-filters { display: flex; flex-wrap: wrap; gap: 7px; }
  .history-result-filter { --v-btn-height: 36px; border-color: #cfd1db; color: #333747; font-size: .85rem !important; font-weight: 800; height: 36px !important; letter-spacing: .02em; min-height: 36px !important; min-width: 0; padding-inline: 16px !important; }
  .history-result-filter--active { background: #293675 !important; color: #fff !important; }
  :global(.history-vehicle-search-menu .v-list-item-title) { color: #282a33; font-size: .9rem !important; overflow: visible; padding-inline-start: 2px; }
  :global(.history-vehicle-search-menu .v-list-item-subtitle) { font-size: .85rem !important; line-height: 1.45rem; overflow: visible; padding-inline-start: 2px; }
  .inspection-history-view .inspection-history-table .history-desktop :deep(th) { font-size: .85rem !important; font-weight: 400 !important; }
  .history-desktop :deep(.history-column-date) { width: 11%; }
  .history-desktop :deep(.history-column-reference) { width: 15%; }
  .history-desktop :deep(.history-column-vehicle) { width: 17%; }
  .history-desktop :deep(.history-column-plate) { width: 12%; }
  .history-desktop :deep(.history-column-station) { width: 23%; }
  .history-desktop :deep(.history-column-result) { width: 15%; }
  .history-desktop :deep(.history-column-action) { width: 7%; }
  .history-plate { color: #535661; white-space: nowrap; }
  .history-back-action { font-size: .9rem; }
  .history-back-action--english { font-size: .84rem; letter-spacing: .03em; }
  @media (max-width: 600px) { .history-back-action { font-size: .84rem !important; } }
</style>
