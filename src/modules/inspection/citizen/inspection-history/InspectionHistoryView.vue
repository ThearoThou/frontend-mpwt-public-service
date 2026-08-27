<script setup lang="ts">
  import type { Vehicle } from '../vehicles/types/vehicle.types'
  import type { CitizenInspectionHistoryItem, InspectionHistoryPagination } from './types/inspection-history.types'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { inspectionVehicleService } from '../vehicles/services/vehicle.service'
  import { getVehicleTypeIcon } from '../vehicles/utils/vehicle-type-icon'
  import { inspectionHistoryService } from './services/inspection-history.service'

  type VehiclePlate = Pick<Vehicle, 'plateCategory' | 'plateProvince' | 'plateNumber'> | CitizenInspectionHistoryItem['vehicle']

  const { locale, t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const inspections = ref<CitizenInspectionHistoryItem[]>([])
  const vehicles = ref<Vehicle[]>([])
  const meta = ref<InspectionHistoryPagination | null>(null)
  const page = ref(1)
  const historyPageSize = 20
  const selectedVehicleId = ref<string | null>(null)
  const loading = ref(true)
  const loadError = ref(false)
  const vehicleSearchDialog = ref(false)
  const vehicleSearchQuery = ref('')
  const vehicleSearchResults = ref<Vehicle[]>([])
  const vehicleSearchLoading = ref(false)
  let historyRequest = 0
  let vehicleSearchRequest = 0
  let vehicleSearchDebounce: ReturnType<typeof setTimeout> | undefined

  const selectedVehicle = computed(() => vehicles.value.find(vehicle => vehicle.id === selectedVehicleId.value) ?? null)
  const showVehicleColumn = computed(() => selectedVehicleId.value === null)

  onMounted(initialize)

  onBeforeUnmount(() => {
    if (vehicleSearchDebounce !== undefined) clearTimeout(vehicleSearchDebounce)
  })

  watch(() => route.query.vehicleId, () => {
    void applyVehicleFromRoute()
  })

  watch(vehicleSearchQuery, query => {
    if (!vehicleSearchDialog.value) return
    if (vehicleSearchDebounce !== undefined) clearTimeout(vehicleSearchDebounce)
    vehicleSearchDebounce = setTimeout(() => {
      void searchVehicles(query)
    }, 300)
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

  function openVehicleSearch () {
    vehicleSearchQuery.value = ''
    vehicleSearchDialog.value = true
    vehicleSearchResults.value = vehicles.value
    void searchVehicles('')
  }

  async function searchVehicles (query: string) {
    const request = ++vehicleSearchRequest
    vehicleSearchLoading.value = true
    try {
      const results = await loadVehiclePages(query.trim() || undefined)
      if (request !== vehicleSearchRequest) return
      vehicleSearchResults.value = results
    } catch {
      if (request !== vehicleSearchRequest) return
      vehicleSearchResults.value = []
    } finally {
      if (request === vehicleSearchRequest) vehicleSearchLoading.value = false
    }
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
    vehicleSearchDialog.value = false
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

  function vehicleDisplayName (vehicle: Vehicle) {
    return [vehicle.make, vehicle.model, vehicle.manufactureYear].filter(Boolean).join(' ') || '—'
  }

  function vehiclePlateLabel (vehicle: VehiclePlate) {
    if (vehicle.plateCategory === 'PERSONALIZED_CAMBODIA') return `${t('inspection_plate_cambodia')} ${vehicle.plateNumber}`
    const province = vehicle.plateProvince === 'ភ្នំពេញ' || vehicle.plateProvince?.toLowerCase() === 'phnom penh'
      ? t('inspection_plate_phnom_penh')
      : vehicle.plateProvince
    return [province, vehicle.plateNumber].filter(Boolean).join(' ')
  }

  function formatDate (value: string) {
    return new Intl.DateTimeFormat(locale.value === 'kh' ? 'km-KH' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value))
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
    return t(inspection.result === 'PASS' ? 'inspection_history_passed' : 'inspection_history_failed')
  }

  function resultColor (inspection: CitizenInspectionHistoryItem) {
    return inspection.result === 'PASS' ? 'success' : 'error'
  }

  function resultIcon (inspection: CitizenInspectionHistoryItem) {
    return inspection.result === 'PASS' ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline'
  }
</script>

<template>
  <section class="inspection-history-view">
    <div v-if="selectedVehicle" class="inspection-history-topline">
      <v-btn class="history-back-action" prepend-icon="mdi-arrow-left" variant="text" @click="selectVehicle(null)">{{ $t('inspection_history_back_to_all_vehicles') }}</v-btn>
    </div>

    <header class="inspection-history-heading">
      <h1>{{ $t('inspection_history') }}</h1>
      <p>{{ $t('inspection_history_description') }}</p>
    </header>

    <div class="inspection-history-filter">
      <span class="inspection-history-filter__label">{{ $t('inspection_history_vehicle') }}</span>

      <div class="inspection-history-filter__content" :class="{ 'inspection-history-filter__content--selected': selectedVehicle }">
        <div v-if="selectedVehicle" class="selected-vehicle-summary">
          <v-avatar color="primary" :icon="getVehicleTypeIcon(selectedVehicle.vehicleType)" size="42" variant="tonal" />

          <div>
            <strong>{{ vehicleDisplayName(selectedVehicle) }}</strong>
            <span>{{ vehiclePlateLabel(selectedVehicle) }}</span>
          </div>
        </div>

        <v-chip v-else class="all-vehicles-summary" variant="tonal">{{ $t('inspection_history_all_vehicles') }}</v-chip>

        <v-btn
          v-if="!selectedVehicle"
          class="history-search-vehicle"
          color="primary"
          prepend-icon="mdi-magnify"
          variant="flat"
          @click="openVehicleSearch"
        >{{ $t('inspection_history_search_vehicle') }}</v-btn>
      </div>
    </div>

    <v-dialog v-model="vehicleSearchDialog" aria-labelledby="inspection-history-search-title" max-width="680">
      <v-card class="vehicle-search-dialog">
        <div class="vehicle-search-dialog__header">
          <div>
            <h2 id="inspection-history-search-title">{{ $t('inspection_history_search_vehicle') }}</h2>
            <p>{{ $t('inspection_history_search_vehicle_description') }}</p>
          </div>

          <v-btn :aria-label="$t('inspection_history_close_vehicle_search')" icon="mdi-close" variant="text" @click="vehicleSearchDialog = false" />
        </div>

        <v-card-text class="vehicle-search-dialog__body">
          <v-text-field
            v-model="vehicleSearchQuery"
            :aria-label="$t('inspection_search')"
            autofocus
            clearable
            density="comfortable"
            hide-details
            :placeholder="$t('inspection_vehicle_search_placeholder')"
            prepend-inner-icon="mdi-magnify"
            single-line
            variant="outlined"
          />

          <div aria-live="polite" class="vehicle-search-results">
            <div v-if="vehicleSearchLoading" class="vehicle-search-results__loading"><v-progress-circular color="primary" indeterminate size="28" /></div>
            <v-alert v-else-if="vehicleSearchResults.length === 0" type="info" variant="tonal">{{ $t('inspection_vehicle_search_empty') }}</v-alert>

            <button
              v-for="vehicle in vehicleSearchResults"
              v-else
              :key="vehicle.id"
              :aria-pressed="vehicle.id === selectedVehicleId"
              class="vehicle-search-result"
              :class="{ 'vehicle-search-result--selected': vehicle.id === selectedVehicleId }"
              type="button"
              @click="selectVehicle(vehicle.id)"
            >
              <v-avatar color="primary" :icon="getVehicleTypeIcon(vehicle.vehicleType)" size="40" variant="tonal" />

              <span class="vehicle-search-result__content">
                <strong>{{ vehicleDisplayName(vehicle) }}</strong>
                <span>{{ vehiclePlateLabel(vehicle) }}</span>
              </span>

              <v-icon v-if="vehicle.id === selectedVehicleId" color="primary" icon="mdi-check-circle" />
            </button>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <div v-if="loading" class="inspection-history-state">
      <v-progress-circular color="primary" indeterminate size="42" />
      <span>{{ $t('loading') }}</span>
    </div>

    <v-alert v-else-if="loadError" class="mt-6" type="error" variant="tonal">
      <div class="d-flex flex-wrap align-center justify-space-between ga-3">
        {{ $t('inspection_history_load_error') }}
        <v-btn color="error" variant="outlined" @click="loadHistory">{{ $t('retry') }}</v-btn>
      </div>
    </v-alert>

    <v-card v-else-if="inspections.length === 0" class="inspection-history-empty mt-6" elevation="0">
      <v-avatar color="primary" icon="mdi-history" size="58" variant="tonal" />
      <h2>{{ $t(selectedVehicle ? 'inspection_history_vehicle_empty_title' : 'inspection_history_empty_title') }}</h2>
      <p>{{ $t(selectedVehicle ? 'inspection_history_vehicle_empty_description' : 'inspection_history_empty_description') }}</p>
    </v-card>

    <template v-else>
      <v-card class="inspection-history-table mt-6" elevation="0">
        <v-table class="history-desktop" :class="{ 'history-desktop--selected': !showVehicleColumn }">
          <colgroup>
            <col class="history-column-date">
            <col class="history-column-reference">
            <col class="history-column-attempt">
            <col v-if="showVehicleColumn" class="history-column-vehicle">
            <col class="history-column-station">
            <col class="history-column-result">
          </colgroup>

          <thead>
            <tr>
              <th>{{ $t('inspection_history_date') }}</th>
              <th>{{ $t('inspection_history_application_reference') }}</th>
              <th>{{ $t('inspection_history_attempt') }}</th>
              <th v-if="showVehicleColumn">{{ $t('inspection_history_vehicle') }}</th>
              <th>{{ $t('inspection_history_station') }}</th>
              <th>{{ $t('inspection_history_result') }}</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="inspection in inspections" :key="`${inspection.applicationId}-${inspection.attemptNumber}-${inspection.inspectedAt}`">
              <td>{{ formatDate(inspection.inspectedAt) }}</td>
              <td class="history-reference">{{ inspection.referenceNumber || '—' }}</td>
              <td>{{ $t('inspection_history_attempt_label', { attempt: inspection.attemptNumber }) }}</td>
              <td v-if="showVehicleColumn" class="history-vehicle"><strong>{{ vehicleName(inspection) }}</strong><span v-if="inspection.vehicle.plateNumber" class="history-secondary">{{ historyPlateLabel(inspection) }}</span></td>
              <td>{{ stationName(inspection) }}</td>
              <td><v-chip :color="resultColor(inspection)" :prepend-icon="resultIcon(inspection)" size="small" variant="tonal">{{ resultLabel(inspection) }}</v-chip><p v-if="inspection.result === 'FAIL' && inspection.failureReason" class="history-failure"><strong>{{ $t('inspection_history_failure_reason') }}:</strong> {{ inspection.failureReason }}</p></td>
            </tr>
          </tbody>
        </v-table>

        <div class="history-mobile">
          <article v-for="inspection in inspections" :key="`${inspection.applicationId}-${inspection.attemptNumber}-${inspection.inspectedAt}`" class="history-card">
            <div class="history-card__top"><strong>{{ formatDate(inspection.inspectedAt) }}</strong><v-chip :color="resultColor(inspection)" :prepend-icon="resultIcon(inspection)" size="small" variant="tonal">{{ resultLabel(inspection) }}</v-chip></div>
            <div v-if="showVehicleColumn" class="history-card__vehicle"><strong>{{ vehicleName(inspection) }}</strong><span v-if="inspection.vehicle.plateNumber">{{ historyPlateLabel(inspection) }}</span></div>
            <dl class="history-card__facts"><div><dt>{{ $t('inspection_history_application_reference') }}</dt><dd class="history-reference">{{ inspection.referenceNumber || '—' }}</dd></div><div><dt>{{ $t('inspection_history_attempt') }}</dt><dd>{{ $t('inspection_history_attempt_label', { attempt: inspection.attemptNumber }) }}</dd></div><div><dt>{{ $t('inspection_history_station') }}</dt><dd>{{ stationName(inspection) }}</dd></div><div v-if="inspection.result === 'FAIL' && inspection.failureReason"><dt>{{ $t('inspection_history_failure_reason') }}</dt><dd>{{ inspection.failureReason }}</dd></div></dl>
          </article>
        </div>
      </v-card>

      <div class="inspection-history-pagination">
        <v-pagination :length="Math.max(1, meta?.totalPages ?? 1)" :model-value="page" @update:model-value="changePage" />
      </div>
    </template>
  </section>
</template>

<style scoped>
  .inspection-history-view { padding-bottom: 24px; }
  .inspection-history-topline { display: flex; justify-content: flex-end; margin-bottom: 6px; }.history-back-action { color: #273d7a; font-weight: 800; }
  .inspection-history-heading h1 { color: #10172d; font-size: clamp(1.45rem, 2.25vw, 1.9rem); font-weight: 800; line-height: 1.2; }
  .inspection-history-heading p { color: #656776; font-size: .91rem; margin-top: 5px; }
  .inspection-history-filter { display: grid; gap: 7px; margin-top: 22px; }
  .inspection-history-filter__label { color: #454854; font-size: .82rem; font-weight: 800; }
  .inspection-history-filter__content { align-items: center; display: flex; gap: 12px; }
  .inspection-history-filter__content--selected { display: inline-flex; max-width: 100%; }
  .all-vehicles-summary { color: #4f5360; font-size: .84rem; font-weight: 800; height: 36px; padding-inline: 14px; }.history-search-vehicle { min-height: 36px; }
  .selected-vehicle-summary { align-items: center; border: 1px solid #d4d5de; border-radius: 14px; display: flex; gap: 11px; max-width: 100%; padding: 14px 16px; width: fit-content; }.selected-vehicle-summary div { display: grid; gap: 2px; min-width: 0; }.selected-vehicle-summary strong { color: #20232e; overflow-wrap: anywhere; }.selected-vehicle-summary span { color: #686b77; font-size: .82rem; font-weight: 700; overflow-wrap: anywhere; }
  .vehicle-search-dialog { border-radius: 18px; overflow: hidden; }.vehicle-search-dialog__header { align-items: flex-start; border-bottom: 1px solid #e1e2e8; display: flex; justify-content: space-between; gap: 16px; padding: 20px 20px 14px; }.vehicle-search-dialog__header h2 { color: #1d2130; font-size: 1.18rem; font-weight: 800; }.vehicle-search-dialog__header p { color: #686b77; font-size: .86rem; margin-top: 4px; }.vehicle-search-dialog__body { padding: 20px; }
  .vehicle-search-results { display: grid; gap: 8px; max-height: min(48vh, 420px); overflow-y: auto; padding-right: 2px; }.vehicle-search-results__loading { align-items: center; display: flex; justify-content: center; min-height: 160px; }.vehicle-search-result { align-items: center; background: #fff; border: 1px solid #e0e2e9; border-radius: 12px; cursor: pointer; display: flex; gap: 12px; min-width: 0; padding: 12px; text-align: left; width: 100%; }.vehicle-search-result:hover, .vehicle-search-result:focus-visible, .vehicle-search-result--selected { background: #f2f5ff; border-color: #6b83c8; outline: none; }.vehicle-search-result__content { display: grid; gap: 3px; min-width: 0; flex: 1; }.vehicle-search-result__content strong { color: #20232e; font-size: .93rem; overflow-wrap: anywhere; }.vehicle-search-result__content span { color: #636774; font-size: .82rem; font-weight: 700; overflow-wrap: anywhere; }
  .history-vehicle { min-width: 150px; }
  .inspection-history-state { align-items: center; color: #656776; display: flex; flex-direction: column; gap: 14px; justify-content: center; min-height: 360px; }
  .inspection-history-table, .inspection-history-empty { border: 1px solid #d4d5de; border-radius: 16px; box-shadow: 0 6px 16px rgba(31, 36, 69, .05); overflow: hidden; }
  .inspection-history-empty { align-items: center; display: flex; flex-direction: column; min-height: 280px; justify-content: center; padding: 30px; text-align: center; }
  .inspection-history-empty h2 { color: #20212a; font-size: 1.1rem; font-weight: 800; margin-top: 14px; }.inspection-history-empty p { color: #656776; font-size: .9rem; margin-top: 5px; }
  .history-desktop { min-width: 1120px; table-layout: fixed; width: 100%; }.history-desktop :deep(th) { background: #f7f8fc; color: #5d6170; font-size: .75rem; font-weight: 800; white-space: nowrap; }.history-desktop :deep(td) { color: #2d303a; font-size: .84rem; font-weight: 600; padding-block: 15px; vertical-align: top; }.history-desktop :deep(tr:last-child td) { border-bottom: 0; }.history-desktop :deep(.history-column-date) { width: 12%; }.history-desktop :deep(.history-column-reference) { width: 20%; }.history-desktop :deep(.history-column-attempt) { width: 9%; }.history-desktop :deep(.history-column-vehicle) { width: 17%; }.history-desktop :deep(.history-column-station) { width: 27%; }.history-desktop :deep(.history-column-result) { width: 15%; }.history-desktop--selected :deep(.history-column-date) { width: 14%; }.history-desktop--selected :deep(.history-column-reference) { width: 28%; }.history-desktop--selected :deep(.history-column-attempt) { width: 11%; }.history-desktop--selected :deep(.history-column-station) { width: 30%; }.history-desktop--selected :deep(.history-column-result) { width: 17%; }
  .history-reference { color: #273d7a; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .79rem; font-weight: 700; white-space: nowrap; }.history-secondary { color: #686b77; display: block; font-size: .77rem; font-weight: 600; margin-top: 3px; }.history-failure { color: #a6232a; font-size: .74rem; line-height: 1.4; margin-top: 7px; max-width: 220px; }
  .history-mobile { display: none; }.inspection-history-pagination { display: flex; justify-content: flex-end; margin-top: 24px; }.inspection-history-pagination :deep(.v-pagination__list) { gap: 10px; justify-content: flex-end; }.inspection-history-pagination :deep(.v-pagination__list > li) { margin: 0; }.inspection-history-pagination :deep(.v-pagination__item), .inspection-history-pagination :deep(.v-pagination__prev .v-btn), .inspection-history-pagination :deep(.v-pagination__next .v-btn) { align-items: center; background: #fff; border: 1px solid #d5d7dc; border-radius: 9px; box-shadow: none; color: #20212a; display: inline-flex; font-size: .86rem; font-weight: 800; height: 36px; justify-content: center; min-width: 36px; padding: 0; width: 36px; }.inspection-history-pagination :deep(.v-pagination__item--is-active) { background: #293675; border-color: #293675; color: #fff; }
  @media (max-width: 900px) { .inspection-history-filter__content { align-items: stretch; flex-direction: column; }.history-desktop { display: none; }.history-mobile { display: grid; gap: 0; }.history-card { border-bottom: 1px solid #e2e3e9; padding: 18px; }.history-card:last-child { border-bottom: 0; }.history-card__top { align-items: center; display: flex; gap: 10px; justify-content: space-between; }.history-card__vehicle { color: #292b35; display: grid; font-size: .96rem; gap: 3px; margin-top: 14px; }.history-card__vehicle span { color: #676a76; font-size: .83rem; font-weight: 600; }.history-card__facts { display: grid; gap: 12px; margin-top: 16px; }.history-card__facts div { display: grid; gap: 3px; }.history-card__facts dt { color: #696c78; font-size: .72rem; font-weight: 700; }.history-card__facts dd { color: #2d303a; font-size: .84rem; font-weight: 700; margin: 0; overflow-wrap: anywhere; } }
  @media (max-width: 600px) { .vehicle-search-dialog__header, .vehicle-search-dialog__body { padding-inline: 16px; }.vehicle-search-result { align-items: flex-start; }.vehicle-search-dialog { border-radius: 14px; } }
</style>
