<script setup lang="ts">
  import type { CitizenFeeEstimate, RenewalApplication } from '../applications/types/application.types'
  import type { AvailableInspectionDate, InspectionStation } from './services/scheduling.service'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { inspectionApplicationService } from '../applications/services/application.service'
  import { inspectionSchedulingService } from './services/scheduling.service'

  const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  const { locale, t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const applicationId = computed(() => typeof route.query.applicationId === 'string' ? route.query.applicationId : '')
  const application = ref<RenewalApplication | null>(null)
  const feeEstimate = ref<CitizenFeeEstimate | null>(null)
  const stations = ref<InspectionStation[]>([])
  const availableDates = ref<AvailableInspectionDate[]>([])
  const selectedStationId = ref<string | null>(null)
  const selectedDate = ref<string | null>(null)
  const loading = ref(true)
  const loadingDates = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')
  const savedPreferenceNotice = ref('')
  const dateMenu = ref(false)

  const stationOptions = computed(() => stations.value.map(station => ({
    title: stationName(station),
    subtitle: station.province,
    value: station.id,
  })))
  const selectedStation = computed(() => stations.value.find(station => station.id === selectedStationId.value) ?? null)
  const dateIsAvailable = computed(() => selectedDate.value !== null && availableDates.value.some(date => date.capacityDate === selectedDate.value))
  const dateSelectionDisabled = computed(() => selectedStationId.value === null || loadingDates.value || availableDates.value.length === 0)
  const noAvailableDates = computed(() => selectedStationId.value !== null && !loadingDates.value && availableDates.value.length === 0)
  const dateFieldPlaceholder = computed(() => {
    if (selectedStationId.value === null) return t('inspection_scheduling_select_station_first')
    if (loadingDates.value) return t('inspection_scheduling_loading_dates')
    if (noAvailableDates.value) return t('inspection_scheduling_no_dates')
    return t('inspection_scheduling_select_date')
  })

  function validApplicationId (value: string): boolean {
    return UUID_V4_PATTERN.test(value)
  }

  function stationName (station: InspectionStation): string {
    const prefersKhmer = locale.value === 'kh'
    return (prefersKhmer ? station.nameKh || station.nameEn : station.nameEn || station.nameKh) || t('inspection_scheduling_station_unnamed')
  }

  function formatCurrency (amount: string, currency: string): string {
    const [whole, fraction] = amount.split('.')
    const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/gu, ',')
    const displayAmount = fraction && !/^0+$/u.test(fraction) ? `${groupedWhole}.${fraction}` : groupedWhole
    return `${displayAmount} ${currency}`
  }

  function formatDateInput (value: string): string {
    const [year, month, day] = value.split('-').map(Number)
    return year && month && day ? `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}` : value
  }

  function dateKey (value: unknown): string | null {
    if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : null
    if (value instanceof Date) {
      const year = value.getFullYear()
      const month = String(value.getMonth() + 1).padStart(2, '0')
      const day = String(value.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    return null
  }

  function isAvailableDate (value: unknown): boolean {
    const capacityDate = dateKey(value)
    return capacityDate !== null && availableDates.value.some(date => date.capacityDate === capacityDate)
  }

  function onDateSelected (value: unknown) {
    const capacityDate = dateKey(value)
    if (capacityDate === null || !isAvailableDate(capacityDate)) {
      errorMessage.value = t('inspection_scheduling_date_unavailable')
      return
    }

    selectedDate.value = capacityDate
    errorMessage.value = ''
    dateMenu.value = false
  }

  async function loadDates (stationId: string, savedDate: string | null = null) {
    loadingDates.value = true
    availableDates.value = []
    try {
      const dates = await inspectionSchedulingService.listPreferredDates(stationId)
      if (selectedStationId.value !== stationId) return

      availableDates.value = dates
      if (savedDate !== null) {
        if (dates.some(date => date.capacityDate === savedDate)) selectedDate.value = savedDate
        else {
          selectedDate.value = null
          savedPreferenceNotice.value = t('inspection_scheduling_saved_date_unavailable')
        }
      }
    } catch {
      if (selectedStationId.value === stationId) errorMessage.value = t('inspection_scheduling_dates_load_error')
    } finally {
      if (selectedStationId.value === stationId) loadingDates.value = false
    }
  }

  async function onStationChange (stationId: string | null) {
    selectedStationId.value = stationId
    selectedDate.value = null
    availableDates.value = []
    savedPreferenceNotice.value = ''
    errorMessage.value = ''
    dateMenu.value = false
    if (stationId !== null) await loadDates(stationId)
  }

  async function load () {
    if (!validApplicationId(applicationId.value)) {
      errorMessage.value = t('inspection_scheduling_invalid_application_link')
      loading.value = false
      return
    }

    try {
      const draft = await inspectionApplicationService.getById(applicationId.value)
      if (draft.status !== 'DRAFT') {
        errorMessage.value = t('inspection_scheduling_not_editable')
        return
      }

      application.value = draft
      const [loadedStations, estimate] = await Promise.all([
        inspectionSchedulingService.listStations(),
        inspectionApplicationService.getFeeEstimate(draft.id).catch(() => null),
      ])
      stations.value = loadedStations
      feeEstimate.value = estimate
      if (draft.preferredInspectionStationId === null) return

      if (!loadedStations.some(station => station.id === draft.preferredInspectionStationId)) {
        savedPreferenceNotice.value = t('inspection_scheduling_saved_station_unavailable')
        return
      }

      selectedStationId.value = draft.preferredInspectionStationId
      await loadDates(draft.preferredInspectionStationId, draft.preferredInspectionDate)
    } catch {
      errorMessage.value = t('inspection_scheduling_load_error')
    } finally {
      loading.value = false
    }
  }

  async function continueToReview () {
    if (!application.value || saving.value) return
    if (selectedStationId.value === null) {
      errorMessage.value = t('inspection_scheduling_station_required')
      return
    }
    if (selectedDate.value === null) {
      errorMessage.value = t('inspection_scheduling_date_required')
      return
    }
    if (!dateIsAvailable.value) {
      errorMessage.value = t('inspection_scheduling_date_unavailable')
      return
    }

    saving.value = true
    errorMessage.value = ''
    try {
      application.value = await inspectionSchedulingService.savePreference(application.value.id, selectedStationId.value, selectedDate.value)
      await router.push({ path: '/services/inspection/renewal/review', query: { applicationId: application.value.id } })
    } catch {
      errorMessage.value = t('inspection_scheduling_save_error')
    } finally {
      saving.value = false
    }
  }

  function backToDocuments () {
    void router.push({ path: '/services/inspection/renewal/documents', query: { applicationId: applicationId.value } })
  }

  function goToDocuments () {
    void router.push({ path: '/services/inspection/renewal/documents', query: { applicationId: applicationId.value } })
  }

  onMounted(load)
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <section class="renewal-scheduling mx-auto">
    <header class="renewal-scheduling__heading">
      <v-breadcrumbs :aria-label="$t('inspection_scheduling_breadcrumb_label')" class="renewal-breadcrumbs px-0 pb-5" density="compact">
        <v-breadcrumbs-item to="/services/inspection/dashboard">{{ $t('inspection_dashboard') }}</v-breadcrumbs-item>
        <v-breadcrumbs-divider icon="mdi-chevron-right" />
        <v-breadcrumbs-item active active-color="primary" class="renewal-breadcrumbs__current">{{ $t('inspection_documents_wizard_scheduling') }}</v-breadcrumbs-item>
      </v-breadcrumbs>
      <h1 class="text-h5 font-weight-bold mb-2">{{ $t('inspection_scheduling_title') }}</h1>
      <p class="text-medium-emphasis mb-0">{{ $t('inspection_scheduling_description') }}</p>
    </header>

    <v-alert v-if="errorMessage" class="mb-5" type="error">{{ errorMessage }}</v-alert>
    <v-progress-linear v-if="loading" color="primary" indeterminate />

    <template v-else-if="application">
      <section :aria-label="$t('inspection_documents_wizard_label')" class="renewal-stepper mb-6">
        <div class="renewal-stepper__track"><span class="renewal-stepper__track-active" /></div>
        <div class="renewal-stepper__steps">
          <button class="renewal-stepper__step is-complete is-clickable" type="button" @click="goToDocuments"><span class="renewal-stepper__number"><v-icon icon="mdi-check" size="17" /></span><span class="renewal-stepper__label">{{ $t('inspection_documents_wizard_documents') }}</span></button>
          <div class="renewal-stepper__step is-active"><span class="renewal-stepper__number">2</span><span class="renewal-stepper__label">{{ $t('inspection_documents_wizard_service_fee') }}</span></div>
          <div class="renewal-stepper__step"><span class="renewal-stepper__number">3</span><span class="renewal-stepper__label">{{ $t('inspection_documents_wizard_review') }}</span></div>
          <div class="renewal-stepper__step"><span class="renewal-stepper__number">4</span><span class="renewal-stepper__label">{{ $t('inspection_documents_wizard_payment') }}</span></div>
        </div>
      </section>

      <v-row class="renewal-scheduling__layout">
        <v-col cols="12" md="8">
          <v-card border class="renewal-fee-card mb-5 pa-5 pa-md-6" elevation="0" rounded="xl">
            <div class="d-flex align-center ga-3 mb-5"><v-avatar color="primary" size="42" variant="tonal"><v-icon icon="mdi-cash-multiple" /></v-avatar><div><h2 class="text-h6 font-weight-bold mb-1">{{ $t('inspection_scheduling_fee_title') }}</h2><p class="text-body-2 text-medium-emphasis mb-0">{{ $t('inspection_scheduling_fee_description') }}</p></div></div>
            <template v-if="feeEstimate">
              <div class="fee-row"><span>{{ $t('inspection_scheduling_inspection_fee') }}</span><strong>{{ formatCurrency(feeEstimate.inspectionFeeKhr, feeEstimate.currency) }}</strong></div>
              <div class="fee-row"><span>{{ $t('inspection_scheduling_service_fee') }}</span><strong>{{ formatCurrency(feeEstimate.serviceFeeKhr, feeEstimate.currency) }}</strong></div>
              <div class="fee-row"><span>{{ $t('inspection_scheduling_late_fee') }}<small v-if="feeEstimate.lateDays"> ({{ feeEstimate.lateDays }} {{ $t('inspection_scheduling_days') }})</small></span><strong :class="feeEstimate.lateDays ? 'text-error' : ''">{{ formatCurrency(feeEstimate.lateFee, feeEstimate.currency) }}</strong></div>
              <div class="fee-row fee-row--total"><span>{{ $t('inspection_scheduling_estimated_total') }}</span><strong>{{ formatCurrency(feeEstimate.totalAmount, feeEstimate.currency) }}</strong></div>
            </template>
            <p v-else class="text-body-2 text-medium-emphasis mb-0">{{ $t('inspection_scheduling_fee_unavailable') }}</p>
          </v-card>

          <v-card border class="renewal-selection-card pa-5 pa-md-6" elevation="0" rounded="xl">
            <div class="d-flex align-center ga-3 mb-5"><v-avatar color="primary" size="42" variant="tonal"><v-icon icon="mdi-calendar-check-outline" /></v-avatar><div><h2 class="text-h6 font-weight-bold mb-1">{{ $t('inspection_scheduling_preference_title') }}</h2><p class="text-body-2 text-medium-emphasis mb-0">{{ $t('inspection_scheduling_preference_description') }}</p></div></div>
            <v-alert v-if="savedPreferenceNotice" class="mb-4" density="comfortable" type="warning" variant="tonal">{{ savedPreferenceNotice }}</v-alert>
            <v-select v-model="selectedStationId" :items="stationOptions" :label="$t('inspection_scheduling_station_label')" :no-data-text="$t('inspection_scheduling_no_stations')" prepend-inner-icon="mdi-map-marker" variant="outlined" @update:model-value="onStationChange">
              <template #item="{ props, item }"><v-list-item v-bind="props" :subtitle="item.raw.subtitle" :title="item.raw.title" /></template>
            </v-select>
            <div v-if="selectedStation" class="station-summary mb-5"><strong>{{ stationName(selectedStation) }}</strong><span>{{ selectedStation.province }} · {{ selectedStation.address }}</span><span v-if="selectedStation.phone">{{ selectedStation.phone }}</span></div>
            <v-menu v-model="dateMenu" :close-on-content-click="false" :disabled="dateSelectionDisabled" min-width="320">
              <template #activator="{ props }"><v-text-field append-inner-icon="mdi-calendar" :disabled="dateSelectionDisabled" :label="$t('inspection_scheduling_date_label')" :loading="loadingDates" :model-value="selectedDate ? formatDateInput(selectedDate) : ''" :placeholder="dateFieldPlaceholder" readonly variant="outlined" v-bind="props" /></template>
              <div class="inspection-date-picker-panel"><v-btn class="inspection-date-picker__close" icon="mdi-close" size="small" variant="text" @click="dateMenu = false" /><v-date-picker class="inspection-date-picker" :allowed-dates="isAvailableDate" color="primary" :model-value="selectedDate ?? undefined" @update:model-value="onDateSelected" /></div>
            </v-menu>
            <v-alert v-if="noAvailableDates" class="mt-3" density="comfortable" type="info" variant="tonal">{{ $t('inspection_scheduling_no_dates_guidance') }}</v-alert>
            <p v-else class="text-caption text-medium-emphasis mb-0">{{ $t('inspection_scheduling_dates_hint') }}</p>
            <v-alert class="renewal-scheduling__notice mt-4" density="comfortable" icon="mdi-information-outline" type="warning" variant="tonal">{{ $t('inspection_scheduling_reservation_notice') }}</v-alert>
          </v-card>

          <div class="d-flex justify-space-between mt-6">
            <v-btn prepend-icon="mdi-arrow-left" variant="outlined" @click="backToDocuments">{{ $t('inspection_documents_back') }}</v-btn>
            <v-btn append-icon="mdi-arrow-right" color="primary" :disabled="selectedStationId === null || !dateIsAvailable" :loading="saving" @click="continueToReview">{{ $t('inspection_documents_continue') }}</v-btn>
          </div>
        </v-col>

        <v-col cols="12" md="4">
          <aside class="d-flex flex-column ga-5">
            <v-card class="renewal-progress-card pa-5 text-white" elevation="0" rounded="xl"><p class="text-body-1 font-weight-medium mb-1">{{ $t('inspection_documents_application_progress') }}</p><div class="text-h3 font-weight-bold">50<span class="text-h6">%</span></div><v-progress-linear bg-color="white" class="mt-4" color="white" :model-value="50" rounded /><p class="text-body-2 mt-2 mb-0">{{ $t('inspection_documents_step_two_of_four') }}</p></v-card>
          </aside>
        </v-col>
      </v-row>

    </template>
  </section>
</template>

<style scoped>
  .renewal-scheduling { max-width: 1120px; padding-bottom: 36px; }
  .renewal-scheduling__heading { margin-bottom: 24px; }
  .renewal-breadcrumbs :deep(.v-breadcrumbs-item--link) { color: #697080; }
  .renewal-breadcrumbs :deep(.renewal-breadcrumbs__current) { background: #e9ebf8; border-radius: 999px; color: #2a3472; font-weight: 700; padding: 4px 10px; }
  .renewal-stepper { background: #fff; border: 1px solid #e3e5eb; border-radius: 14px; padding: 12px 28px 10px; position: relative; }
  .renewal-stepper__track { display: none; }
  .renewal-stepper__track-active { display: none; }
  .renewal-stepper__steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); position: relative; }
  .renewal-stepper__step { align-items: center; color: #7c8190; display: flex; flex-direction: column; font-size: .78rem; gap: 4px; position: relative; text-align: center; }
  .renewal-stepper__step:not(:last-child)::after { background: #e5e7ed; content: ''; height: 2px; left: 50%; position: absolute; right: -50%; top: 13px; z-index: 0; }
  .renewal-stepper__step.is-clickable { background: transparent; border: 0; cursor: pointer; font: inherit; padding: 0; }
  .renewal-stepper__number { align-items: center; background: #ebedf2; border-radius: 50%; display: inline-flex; font-weight: 700; height: 26px; justify-content: center; position: relative; width: 26px; z-index: 1; }
  .renewal-stepper__step.is-active { color: #202746; font-weight: 700; }
  .renewal-stepper__step.is-complete { color: #7c8190; font-weight: 500; }
  .renewal-stepper__step.is-active .renewal-stepper__label { font-size: .95rem; font-weight: 800; line-height: 1.2; }
  .renewal-stepper__step.is-active .renewal-stepper__number, .renewal-stepper__step.is-complete .renewal-stepper__number { background: rgb(var(--v-theme-primary)); color: #fff; }
  .renewal-stepper__step.is-complete:not(.is-terminal)::after { background: rgb(var(--v-theme-primary)); }
  .fee-row { align-items: center; border-bottom: 1px dashed #dfe2e8; display: flex; gap: 16px; justify-content: space-between; padding: 13px 0; }
  .fee-row:first-of-type { padding-top: 0; }
  .fee-row small { color: #777d8d; font-size: .78rem; }
  .fee-row--total { border-bottom: 0; color: #202746; font-size: 1.05rem; padding-bottom: 0; }
  .station-summary { background: #f8f9fb; border-left: 3px solid rgb(var(--v-theme-primary)); border-radius: 8px; display: flex; flex-direction: column; font-size: .85rem; gap: 3px; padding: 11px 13px; }
  .station-summary span { color: #626979; }
  .renewal-progress-card { background: #2c3678; }
  .renewal-progress-card :deep(.v-progress-linear__background) { opacity: .28; }
  .renewal-scheduling__notice { border: 1px solid #e7b100; }
  .inspection-date-picker-panel { position: relative; }.inspection-date-picker { width: 360px; }.inspection-date-picker__close { color: #fff; position: absolute; right: 10px; top: 10px; z-index: 1; }
  @media (max-width: 959px) { .renewal-scheduling { max-width: 760px; } }
  @media (max-width: 599px) { .renewal-scheduling { padding-bottom: 24px; } .renewal-stepper { padding: 12px 8px 10px; } .renewal-stepper__track { top: 25px; } .renewal-stepper__label { font-size: .72rem; line-height: 1.2; } .inspection-date-picker { width: min(360px, calc(100vw - 32px)); } }
</style>
