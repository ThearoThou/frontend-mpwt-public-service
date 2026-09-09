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
  const vehicleSearchLimit = 30
  const selectedVehicleId = ref<string | null>(null)
  const vehicleSearchQuery = ref('')
  const loading = ref(true)
  const loadError = ref(false)
  let historyRequest = 0

  const selectedVehicle = computed(() => vehicles.value.find(vehicle => vehicle.id === selectedVehicleId.value) ?? null)
  const _showVehicleColumn = computed(() => selectedVehicleId.value === null)
  const vehicleSearchOptions = computed(() => {
    const terms = vehicleSearchQuery.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)

    return vehicles.value
      .filter(vehicle => {
        const searchableText = [vehicleDisplayName(vehicle), vehiclePlateLabel(vehicle), vehicle.registrationNumber]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()

        return terms.every(term => searchableText.includes(term))
      })
      .slice(0, vehicleSearchLimit)
      .map(vehicle => ({
        id: vehicle.id,
        title: vehiclePlateLabel(vehicle),
        subtitle: vehicleDisplayName(vehicle),
        icon: getVehicleTypeIcon(vehicle.vehicleType),
      }))
  })

  onMounted(initialize)

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

  function retryHistory () {
    if (loading.value) return

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
        <v-autocomplete
          v-model:search="vehicleSearchQuery"
          :aria-label="$t('inspection_history_search_vehicle')"
          class="history-vehicle-search"
          clear-icon="mdi-close"
          clearable
          density="comfortable"
          hide-details
          item-title="title"
          item-value="id"
          :items="vehicleSearchOptions"
          :menu-props="{ contentClass: 'history-vehicle-search-menu' }"
          :model-value="selectedVehicleId"
          :no-data-text="$t('no_data')"
          no-filter
          :placeholder="$t('inspection_vehicle_search_placeholder')"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          @update:model-value="selectVehicle($event ?? null)"
        >
          <template #item="{ props, item }">
            <v-list-item v-bind="props" :subtitle="item.raw.subtitle">
              <template #prepend><v-avatar color="primary" :icon="item.raw.icon" size="36" variant="tonal" /></template>
            </v-list-item>
          </template>
        </v-autocomplete>
      </div>

      <span v-if="selectedVehicle" class="inspection-history-filter__label">{{ $t('inspection_history_vehicle') }}</span>

      <div v-if="selectedVehicle" class="selected-vehicle-summary">
        <v-avatar color="primary" :icon="getVehicleTypeIcon(selectedVehicle.vehicleType)" size="44" variant="tonal" />

        <div>
          <strong>{{ vehicleDisplayName(selectedVehicle) }}</strong>
          <span>{{ vehiclePlateLabel(selectedVehicle) }}</span>
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
      <p>{{ $t(selectedVehicle ? 'inspection_history_vehicle_empty_description' : 'inspection_history_empty_description') }}</p>
    </v-card>

    <template v-else>
      <v-card class="inspection-history-table mt-6" elevation="0">
        <v-table class="history-desktop">
          <colgroup>
            <col class="history-column-reference">
            <col class="history-column-date">
            <col class="history-column-vehicle">
            <col class="history-column-plate">
            <col class="history-column-station">
            <col class="history-column-result">
          </colgroup>

          <thead>
            <tr>
              <th class="history-table-header">{{ $t('inspection_history_application_reference') }}</th>
              <th class="history-table-header">{{ $t('inspection_history_date') }}</th>
              <th class="history-table-header">{{ $t('inspection_history_vehicle') }}</th>
              <th class="history-table-header">{{ $t('inspection_plate_label') }}</th>
              <th class="history-table-header">{{ $t('inspection_history_station') }}</th>
              <th class="history-table-header">{{ $t('inspection_history_result') }}</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="inspection in inspections" :key="`${inspection.applicationId}-${inspection.attemptNumber}-${inspection.inspectedAt}`">
              <td class="history-reference">{{ inspection.referenceNumber || '—' }}</td>
              <td>{{ formatDate(inspection.inspectedAt) }}</td>
              <td class="history-vehicle"><strong>{{ vehicleName(inspection) }}</strong></td>
              <td class="history-plate">{{ historyPlateLabel(inspection) }}</td>
              <td>{{ stationName(inspection) }}</td>
              <td><v-chip :color="resultColor(inspection)" :prepend-icon="resultIcon(inspection)" size="small" variant="tonal">{{ resultLabel(inspection) }}</v-chip><p v-if="inspection.result === 'FAIL' && inspection.failureReason" class="history-failure"><strong>{{ $t('inspection_history_failure_reason') }}:</strong> {{ inspection.failureReason }}</p></td>
            </tr>
          </tbody>
        </v-table>

        <div class="history-mobile">
          <article v-for="inspection in inspections" :key="`${inspection.applicationId}-${inspection.attemptNumber}-${inspection.inspectedAt}`" class="history-card">
            <div class="history-card__top"><strong class="history-reference">{{ inspection.referenceNumber || '—' }}</strong><v-chip :color="resultColor(inspection)" :prepend-icon="resultIcon(inspection)" size="small" variant="tonal">{{ resultLabel(inspection) }}</v-chip></div>
            <div class="history-card__vehicle"><strong>{{ vehicleName(inspection) }}</strong></div>
            <dl class="history-card__facts"><div><dt>{{ $t('inspection_history_date') }}</dt><dd class="history-date">{{ formatDate(inspection.inspectedAt) }}</dd></div><div><dt>{{ $t('inspection_plate_label') }}</dt><dd class="history-plate">{{ historyPlateLabel(inspection) }}</dd></div><div><dt>{{ $t('inspection_history_station') }}</dt><dd>{{ stationName(inspection) }}</dd></div><div v-if="inspection.result === 'FAIL' && inspection.failureReason"><dt>{{ $t('inspection_history_failure_reason') }}</dt><dd>{{ inspection.failureReason }}</dd></div></dl>
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
  .selected-vehicle-summary { align-items: center; border: 1px solid #d4d5de; border-radius: 14px; display: flex; gap: 11px; max-width: 100%; padding: 14px 16px; width: fit-content; }.selected-vehicle-summary div { display: grid; gap: 2px; min-width: 0; }.selected-vehicle-summary strong { color: #20232e; overflow-wrap: anywhere; }.selected-vehicle-summary span { color: #686b77; font-size: .82rem; font-weight: 700; overflow-wrap: anywhere; }
  .vehicle-search-dialog { border-radius: 18px; overflow: hidden; }.vehicle-search-dialog__header { align-items: flex-start; border-bottom: 1px solid #e1e2e8; display: flex; justify-content: space-between; gap: 16px; padding: 20px 20px 14px; }.vehicle-search-dialog__header h2 { color: #1d2130; font-size: 1.18rem; font-weight: 800; }.vehicle-search-dialog__header p { color: #686b77; font-size: .86rem; margin-top: 4px; }.vehicle-search-dialog__body { padding: 20px; }
  .vehicle-search-results { display: grid; gap: 8px; max-height: min(48vh, 420px); overflow-y: auto; padding-right: 2px; }.vehicle-search-results__loading { align-items: center; display: flex; justify-content: center; min-height: 160px; }.vehicle-search-result { align-items: center; background: #fff; border: 1px solid #e0e2e9; border-radius: 12px; cursor: pointer; display: flex; gap: 12px; min-width: 0; padding: 12px; text-align: left; width: 100%; }.vehicle-search-result:hover, .vehicle-search-result:focus-visible, .vehicle-search-result--selected { background: #f2f5ff; border-color: #6b83c8; outline: none; }.vehicle-search-result__content { display: grid; gap: 3px; min-width: 0; flex: 1; }.vehicle-search-result__content strong { color: #20232e; font-size: .93rem; overflow-wrap: anywhere; }.vehicle-search-result__content span { color: #636774; font-size: .82rem; font-weight: 700; overflow-wrap: anywhere; }
  .history-vehicle { min-width: 150px; }
  .inspection-history-state { align-items: center; color: #656776; display: flex; flex-direction: column; gap: 14px; justify-content: center; min-height: 360px; }
  .inspection-history-table, .inspection-history-empty { border: 1px solid #d4d5de; border-radius: 16px; box-shadow: 0 6px 16px rgba(31, 36, 69, .05); overflow: hidden; }
  .inspection-history-empty { align-items: center; display: flex; flex-direction: column; min-height: 280px; justify-content: center; padding: 30px; text-align: center; }
  .inspection-history-empty h2 { color: #20212a; font-size: 1.1rem; font-weight: 800; margin-top: 14px; }.inspection-history-empty p { color: #656776; font-size: .9rem; margin-top: 5px; }
  .history-desktop { min-width: 1120px; table-layout: fixed; width: 100%; }.history-desktop :deep(th) { background: #f7f8fc; color: #535867; font-size: .84rem; font-weight: 800; white-space: nowrap; }.history-desktop :deep(td) { color: #252934; font-size: .93rem; font-weight: 600; padding-block: 15px; vertical-align: top; }.history-desktop :deep(tr:last-child td) { border-bottom: 0; }.history-desktop :deep(.history-column-date) { width: 14%; }.history-desktop :deep(.history-column-reference) { width: 22%; }.history-desktop :deep(.history-column-vehicle) { width: 18%; }.history-desktop :deep(.history-column-station) { width: 30%; }.history-desktop :deep(.history-column-result) { width: 16%; }.history-desktop--selected :deep(.history-column-date) { width: 16%; }.history-desktop--selected :deep(.history-column-reference) { width: 25%; }.history-desktop--selected :deep(.history-column-station) { width: 44%; }.history-desktop--selected :deep(.history-column-result) { width: 15%; }
  .history-reference { color: #273d7a; font-family: 'Siemreap', sans-serif; font-size: .88rem; font-weight: 700; white-space: nowrap; }.history-secondary { color: #5b5f6d; display: block; font-size: .84rem; font-weight: 600; margin-top: 3px; }.history-failure { color: #a6232a; font-size: .84rem; line-height: 1.45; margin-top: 7px; max-width: 220px; }
  .history-mobile { display: none; }.inspection-history-pagination { display: flex; justify-content: flex-end; margin-top: 24px; }.inspection-history-pagination :deep(.v-pagination__list) { gap: 10px; justify-content: flex-end; }.inspection-history-pagination :deep(.v-pagination__list > li) { margin: 0; }.inspection-history-pagination :deep(.v-pagination__item), .inspection-history-pagination :deep(.v-pagination__prev .v-btn), .inspection-history-pagination :deep(.v-pagination__next .v-btn) { align-items: center; background: #fff; border: 1px solid #d5d7dc; border-radius: 9px; box-shadow: none; color: #20212a; display: inline-flex; font-size: .86rem; font-weight: 800; height: 36px; justify-content: center; min-width: 36px; padding: 0; width: 36px; }.inspection-history-pagination :deep(.v-pagination__item--is-active .v-btn) { background: #293675 !important; border-color: #293675 !important; color: #fff !important; opacity: 1 !important; }.inspection-history-pagination :deep(.v-pagination__prev .v-btn--disabled), .inspection-history-pagination :deep(.v-pagination__next .v-btn--disabled) { background: #f4f5f8 !important; border-color: #d7d9e1 !important; color: #8a90a0 !important; opacity: .78 !important; }
  .inspection-history-pagination :deep(.v-pagination__item .v-btn), .inspection-history-pagination :deep(.v-pagination__prev .v-btn), .inspection-history-pagination :deep(.v-pagination__next .v-btn) { height: 36px !important; max-height: 36px !important; max-width: 36px !important; min-height: 36px !important; min-width: 36px !important; padding: 0 !important; width: 36px !important; }
  @media (max-width: 900px) { .inspection-history-filter__content { align-items: stretch; flex-direction: column; }.history-desktop { display: none; }.history-mobile { display: grid; gap: 0; }.history-card { border-bottom: 1px solid #e2e3e9; padding: 18px; }.history-card:last-child { border-bottom: 0; }.history-card__top { align-items: center; display: flex; gap: 10px; justify-content: space-between; }.history-card__vehicle { color: #292b35; display: grid; font-size: .96rem; gap: 3px; margin-top: 14px; }.history-card__vehicle span { color: #676a76; font-size: .83rem; font-weight: 600; }.history-card__facts { display: grid; gap: 12px; margin-top: 16px; }.history-card__facts div { display: grid; gap: 3px; }.history-card__facts dt { color: #696c78; font-size: .72rem; font-weight: 700; }.history-card__facts dd { color: #2d303a; font-size: .84rem; font-weight: 700; margin: 0; overflow-wrap: anywhere; } }
  @media (max-width: 600px) { .vehicle-search-dialog__header, .vehicle-search-dialog__body { padding-inline: 16px; }.vehicle-search-result { align-items: flex-start; }.vehicle-search-dialog { border-radius: 14px; } }
  .inspection-history-heading p { font-size: .94rem; }
  .inspection-history-filter__label { color: #282a33; font-size: .94rem; }
  .selected-vehicle-summary strong { font-size: .96rem; }
  .selected-vehicle-summary span { font-size: .88rem; }
  .history-table-header { font-size: .88rem !important; font-weight: 600 !important; }
  .history-desktop :deep(td), .history-secondary { font-size: .94rem; }
  .inspection-history-view .history-desktop :deep(td:nth-child(2)),
  .inspection-history-view .history-date { color: #2a3472 !important; }
  .history-reference { font-size: .86rem; }
  .history-desktop :deep(.v-chip), .history-mobile :deep(.v-chip) { font-size: .84rem; }
  .all-vehicles-summary, .history-search-vehicle { font-size: .88rem; }
  .history-failure { font-size: .84rem; }
  .all-vehicles-summary { background: #293675 !important; color: #fff !important; }
  .history-search-vehicle { background: #fff !important; border: 1px solid #c5cada; border-radius: 12px; box-shadow: 0 4px 14px rgba(30, 43, 95, .06); color: #2a3472 !important; min-height: 54px; padding-inline: 20px; }
  .history-search-vehicle:hover { background: #f5f7ff !important; border-color: #2a3472; box-shadow: 0 7px 18px rgba(30, 43, 95, .1); }
  .inspection-history-filter__content { max-width: 540px; width: 100%; }
  .history-vehicle-search { width: 100%; }
  .history-vehicle-search :deep(.v-field) { background: #fff; border-radius: 12px; box-shadow: 0 4px 14px rgba(30, 43, 95, .06); min-height: 54px; transition: box-shadow .18s ease, transform .18s ease; }
  .history-vehicle-search :deep(.v-field__outline) { --v-field-border-opacity: 1; color: #c5cada; }
  .history-vehicle-search :deep(.v-field__input) { color: #202744; font-size: .94rem; min-height: 54px; padding-top: 0; }
  .history-vehicle-search :deep(input::placeholder) { color: #8b91a2; opacity: 1; }
  .history-vehicle-search :deep(.v-field__prepend-inner) { color: #2a3472; opacity: 1; padding-right: 10px; }
  .history-vehicle-search :deep(.v-list-item-title) { color: #282a33; font-size: .94rem; }
  .history-vehicle-search :deep(.v-list-item-subtitle) { font-size: .88rem; }
  .history-vehicle-search :deep(.v-autocomplete__menu-icon) { display: none; }
  .history-vehicle-search :deep(.v-field--focused) { box-shadow: 0 0 0 4px rgba(42, 52, 114, .12), 0 7px 18px rgba(30, 43, 95, .1); transform: translateY(-1px); }
  .history-vehicle-search :deep(.v-field--focused .v-field__outline) { color: #2a3472; }
  :global(.history-vehicle-search-menu .v-list-item-title) { color: #282a33; font-size: .9rem !important; overflow: visible; padding-inline-start: 2px; }
  :global(.history-vehicle-search-menu .v-list-item-subtitle) { font-size: .85rem !important; line-height: 1.45rem; overflow: visible; padding-inline-start: 2px; }
  .inspection-history-view .inspection-history-table .history-desktop :deep(th) { font-size: .85rem !important; font-weight: 400 !important; }
  .inspection-history-view .inspection-history-table .history-failure,
  .inspection-history-view .inspection-history-table .history-failure strong { font-size: .85rem !important; }
  .history-desktop :deep(.history-column-date) { width: 12%; }
  .history-desktop :deep(.history-column-reference) { width: 17%; }
  .history-desktop :deep(.history-column-vehicle) { width: 18%; }
  .history-desktop :deep(.history-column-plate) { width: 13%; }
  .history-desktop :deep(.history-column-station) { width: 25%; }
  .history-desktop :deep(.history-column-result) { width: 15%; }
  .history-plate { color: #535661; white-space: nowrap; }
  .history-back-action { font-size: .9rem; }
  .history-back-action--english { font-size: .84rem; letter-spacing: .03em; }
  @media (max-width: 600px) { .history-back-action { font-size: .84rem !important; } }
</style>
