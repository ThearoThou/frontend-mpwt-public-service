<script setup lang="ts">
  import type {
    CitizenFeeEstimate,
    RenewalApplication,
  } from '../applications/types/application.types'
  import type { Vehicle } from '../vehicles/types/vehicle.types'
  import type { InspectionStation } from './services/scheduling.service'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { inspectionApplicationService } from '../applications/services/application.service'
  import { inspectionVehicleService } from '../vehicles/services/vehicle.service'
  import { resolveInspectionCategoryLabel } from '../vehicles/utils/inspection-category-label'
  import { cambodiaToday } from '../vehicles/utils/inspection-expiry-status'
  import { inspectionSchedulingService } from './services/scheduling.service'
  import { overdueDayBreakdown } from './utils/late-penalty-display'
  import { prefetchRenewalStep } from './utils/prefetch-renewal-step'

  const UUID_V4_PATTERN
    = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const NO_STATION_PREFERENCE = Symbol('no-station-preference')
  const PREFERRED_DATE_RANGE_DAYS = 30
  type StationSelection = string | typeof NO_STATION_PREFERENCE

  const { locale, t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const applicationId = computed(() =>
    typeof route.query.applicationId === 'string'
      ? route.query.applicationId
      : '',
  )
  const application = ref<RenewalApplication | null>(null)
  const vehicle = ref<Vehicle | null>(null)
  const feeEstimate = ref<CitizenFeeEstimate | null>(null)
  const stations = ref<InspectionStation[]>([])
  const selectedStationSelection = ref<StationSelection>(NO_STATION_PREFERENCE)
  const selectedDate = ref<string | null>(null)
  const selectedOptionalService = ref(false)
  const dateMenu = ref(false)
  const loading = ref(true)
  const saving = ref(false)
  const errorMessageKey = ref('')
  const errorAlert = ref<HTMLElement | null>(null)
  const savedPreferenceNotice = ref('')
  const sameDaySelectionNotice = ref<HTMLElement | null>(null)
  const activeHolidayDateSet = ref<Set<string>>(new Set())
  const currentCambodiaNow = ref(new Date())
  let clockTimer: ReturnType<typeof setInterval> | undefined

  const stationOptions = computed(() => [
    {
      title: t('inspection_scheduling_no_station_preference'),
      subtitle: t('inspection_scheduling_no_station_preference_hint'),
      value: NO_STATION_PREFERENCE,
      isNoPreference: true,
    },
    ...stations.value.map(station => ({
      title: stationName(station),
      subtitle: `${station.province} · ${station.address}`,
      value: station.id,
      isNoPreference: false,
    })),
  ])
  const selectedStationId = computed<string | null>(() =>
    selectedStationSelection.value === NO_STATION_PREFERENCE
      ? null
      : selectedStationSelection.value,
  )
  const selectedStation = computed(
    () =>
      stations.value.find(station => station.id === selectedStationId.value)
      ?? null,
  )
  const todayKh = computed(() => cambodiaToday(currentCambodiaNow.value))
  const maxPreferredDate = computed(() =>
    addCalendarDays(todayKh.value, PREFERRED_DATE_RANGE_DAYS - 1),
  )
  const sameDaySelectionClosed = computed(() =>
    isCambodiaAtOrAfterInspectionCutoff(currentCambodiaNow.value)
    && isWeekdayDate(todayKh.value)
    && !activeHolidayDateSet.value.has(todayKh.value),
  )
  const showSameDaySelectionNotice = computed(() =>
    sameDaySelectionClosed.value && selectedDate.value === todayKh.value,
  )
  const displayedDate = computed(() =>
    selectedDate.value === null ? '' : formatDateInput(selectedDate.value),
  )
  const hasLateFee = computed(() => Number(feeEstimate.value?.lateFee ?? 0) > 0)
  const penaltyDays = computed(() => feeEstimate.value === null
    ? 0
    : overdueDayBreakdown(feeEstimate.value.lateDays).penaltyDays)
  const displayedServiceFee = computed(() =>
    selectedOptionalService.value
      ? Number(feeEstimate.value?.optionalServiceFeeKhr ?? 0)
      : 0,
  )
  const displayedTotal = computed(() =>
    Number(feeEstimate.value?.inspectionFeeKhr ?? 0)
    + Number(feeEstimate.value?.lateFee ?? 0)
    + displayedServiceFee.value,
  )

  function stationName (station: InspectionStation): string {
    return (
      (locale.value === 'kh'
        ? station.nameKh || station.nameEn
        : station.nameEn || station.nameKh)
      || t('inspection_scheduling_station_unnamed')
    )
  }

  function formatCurrency (amount: string | number, _currency?: string): string {
    return `${Number(amount).toLocaleString(locale.value === 'kh' ? 'km-KH' : 'en-GB')} ៛`
  }

  function formatDateInput (value: string): string {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))

    if (
      !year
      || !month
      || !day
      || Number.isNaN(date.valueOf())
      || date.toISOString().slice(0, 10) !== value
    ) {
      return value
    }

    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
  }

  function dateKey (value: unknown): string | null {
    if (typeof value === 'string') {
      return /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : null
    }
    if (value instanceof Date) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    }
    return null
  }

  function addCalendarDays (value: string, days: number): string {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setDate(date.getDate() + days)

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  function isWithinPreferredDateRange (value: unknown): boolean {
    const date = dateKey(value)
    return date !== null && date >= todayKh.value && date <= maxPreferredDate.value
  }

  function isWeekdayDate (value: unknown): boolean {
    const date = dateKey(value)
    if (date === null) return false

    // VDatePicker passes a local Date. Keep its local calendar date so that a
    // Cambodia-local Monday is not converted to the preceding UTC Sunday.
    const [year, month, day] = date.split('-').map(Number)
    const weekday = new Date(year, month - 1, day).getDay()
    return weekday >= 1 && weekday <= 5
  }

  function isAllowedPreferredDate (value: unknown): boolean {
    const date = dateKey(value)
    return date !== null
      && isWithinPreferredDateRange(date)
      && isWeekdayDate(date)
      && !activeHolidayDateSet.value.has(date)
      && !(date === todayKh.value && isCambodiaAtOrAfterInspectionCutoff(currentCambodiaNow.value))
  }

  function isCambodiaAtOrAfterInspectionCutoff (now: Date): boolean {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Phnom_Penh',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now).find(part => part.type === 'hour')?.value
    return Number(hour ?? 0) >= 17
  }

  function onDateSelected (value: unknown) {
    const preferredDate = dateKey(value)
    if (preferredDate === null || !isAllowedPreferredDate(preferredDate)) return

    selectedDate.value = preferredDate
    errorMessageKey.value = ''
    dateMenu.value = false
  }

  async function load () {
    if (!UUID_V4_PATTERN.test(applicationId.value)) {
      errorMessageKey.value = 'inspection_scheduling_invalid_application_link'
      loading.value = false
      return
    }
    try {
      const draft = await inspectionApplicationService.getById(
        applicationId.value,
      )
      if (draft.status !== 'DRAFT') {
        await router.replace({
          path: `/services/inspection/applications/${draft.id}`,
        })
        return
      }
      application.value = draft
      const [loadedStations, selectedVehicle, estimate, closures] = await Promise.all([
        inspectionSchedulingService.listStations(),
        inspectionVehicleService.getById(draft.vehicleId),
        inspectionApplicationService.getFeeEstimate(draft.id).catch(() => null),
        inspectionSchedulingService.listClosures(todayKh.value, maxPreferredDate.value),
      ])
      stations.value = loadedStations
      vehicle.value = selectedVehicle
      feeEstimate.value = estimate
      selectedOptionalService.value
        = estimate?.optionalServiceEligible === true
          && draft.optionalOversizeServiceSelected
      activeHolidayDateSet.value = new Set(closures.map(closure => closure.closureDate))
      selectedDate.value = draft.preferredInspectionDate
      if (
        draft.preferredInspectionStationId !== null
        && loadedStations.some(
          station => station.id === draft.preferredInspectionStationId,
        )
      ) {
        selectedStationSelection.value = draft.preferredInspectionStationId
      } else if (draft.preferredInspectionStationId !== null) {
        savedPreferenceNotice.value = t(
          'inspection_scheduling_saved_station_unavailable',
        )
      }
    } catch {
      errorMessageKey.value = 'inspection_scheduling_load_error'
    } finally {
      loading.value = false
    }
    if (route.query.focus === 'inspection-options') {
      await nextTick()
      document.querySelector('#inspection-options')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }

  async function refreshHolidayDates (): Promise<void> {
    const closures = await inspectionSchedulingService.listClosures(
      todayKh.value,
      maxPreferredDate.value,
    )
    activeHolidayDateSet.value = new Set(closures.map(closure => closure.closureDate))
  }

  watch(todayKh, (today, previousToday) => {
    if (previousToday !== undefined && today !== previousToday) {
      void refreshHolidayDates().catch(() => {
        errorMessageKey.value = 'inspection_scheduling_load_error'
      })
    }
  })

  onMounted(() => {
    clockTimer = setInterval(() => {
      currentCambodiaNow.value = new Date()
    }, 30_000)
  })

  onBeforeUnmount(() => {
    if (clockTimer !== undefined) clearInterval(clockTimer)
  })

  async function continueToReview () {
    if (!application.value || saving.value) return
    currentCambodiaNow.value = new Date()
    if (
      selectedDate.value === todayKh.value
      && sameDaySelectionClosed.value
    ) {
      await nextTick()
      sameDaySelectionNotice.value?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      return
    }
    if (selectedDate.value === null || selectedDate.value === '') {
      errorMessageKey.value = 'inspection_scheduling_date_required'
      await scrollToErrorAlert()
      return
    }
    if (!isAllowedPreferredDate(selectedDate.value)) {
      errorMessageKey.value = 'inspection_scheduling_date_unavailable'
      await scrollToErrorAlert()
      return
    }
    saving.value = true
    errorMessageKey.value = ''
    await nextTick()
    try {
      application.value = await inspectionSchedulingService.savePreference(
        application.value.id,
        selectedDate.value,
        selectedStationId.value,
        selectedOptionalService.value,
      )
      await router.push({
        path: '/services/inspection/renewal/review',
        query: { applicationId: application.value.id },
      })
    } catch {
      errorMessageKey.value = 'inspection_scheduling_save_error'
      await scrollToErrorAlert()
    } finally {
      saving.value = false
    }
  }

  async function scrollToErrorAlert (): Promise<void> {
    await nextTick()
    errorAlert.value?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }

  function backToDocuments () {
    if (saving.value) return

    void router.push({
      path: '/services/inspection/renewal/documents',
      query: { applicationId: applicationId.value },
    })
  }

  onMounted(() => {
    prefetchRenewalStep('review')
    void load()
  })
</script>

<template>
  <section class="renewal-scheduling mx-auto">
    <header class="renewal-scheduling__heading mb-6">
      <v-breadcrumbs class="renewal-breadcrumbs px-0 pb-5" density="compact">
        <v-breadcrumbs-item to="/services/inspection/dashboard">{{ $t('inspection_dashboard') }}</v-breadcrumbs-item>
        <v-breadcrumbs-divider icon="mdi-chevron-right" />
        <v-breadcrumbs-item active active-color="primary" class="renewal-breadcrumbs__current">{{ $t('inspection_documents_wizard_service_fee') }}</v-breadcrumbs-item>
      </v-breadcrumbs>

      <h1 class="text-h5 font-weight-regular mb-2">
        {{ $t("inspection_scheduling_title") }}
      </h1>

      <p class="text-medium-emphasis mb-0">
        {{ $t("inspection_scheduling_description") }}
      </p>
    </header>

    <section
      :aria-label="$t('inspection_documents_wizard_label')"
      class="renewal-stepper mb-6"
    >
      <div class="renewal-stepper__steps">
        <button
          class="renewal-stepper__step is-complete is-clickable"
          :disabled="saving"
          type="button"
          @click="backToDocuments"
        >
          <span class="renewal-stepper__number"><v-icon icon="mdi-check" size="17" /></span>
          <span class="renewal-stepper__label">{{ $t('inspection_documents_wizard_documents') }}</span>
        </button>

        <div class="renewal-stepper__step is-active">
          <span class="renewal-stepper__number">2</span>
          <span class="renewal-stepper__label">{{ $t('inspection_documents_wizard_service_fee') }}</span>
        </div>

        <div class="renewal-stepper__step">
          <span class="renewal-stepper__number">3</span>
          <span class="renewal-stepper__label">{{ $t('inspection_documents_wizard_review') }}</span>
        </div>

        <div class="renewal-stepper__step">
          <span class="renewal-stepper__number">4</span>
          <span class="renewal-stepper__label">{{ $t('inspection_documents_wizard_payment') }}</span>
        </div>
      </div>
    </section>

    <div v-if="errorMessageKey" ref="errorAlert">
      <v-alert
        :class="['mb-5', { 'scheduling-date-unavailable-alert': errorMessageKey === 'inspection_scheduling_date_unavailable' }]"
        type="error"
      >{{ $t(errorMessageKey) }}</v-alert>
    </div>

    <v-progress-linear v-if="loading" color="primary" indeterminate />

    <template v-else-if="application">

      <v-row>
        <v-col cols="12" md="8">
          <v-card
            v-if="feeEstimate && vehicle"
            border
            class="review-card mb-5 pa-5 pa-md-6"
            elevation="0"
            rounded="xl"
          >
            <div class="d-flex align-center ga-3 mb-4">
              <v-avatar color="primary" size="42" variant="tonal"><v-icon icon="mdi-cash-multiple" /></v-avatar>

              <div>
                <h2 class="text-h6 font-weight-regular mb-1">
                  {{ $t("inspection_scheduling_fee_title") }}
                </h2>
              </div>
            </div>

            <div class="review-fee-row review-fee-row--category">
              <span>{{ $t('inspection_payment_inspection_category') }}</span>
              <strong>{{ resolveInspectionCategoryLabel(vehicle.inspectionCategory, locale) }}</strong>
            </div>

            <div class="review-fee-row">
              <span>{{ $t("inspection_scheduling_inspection_fee") }}</span>

              <strong>{{
                formatCurrency(
                  feeEstimate.inspectionFeeKhr,
                  feeEstimate.currency,
                )
              }}</strong>
            </div>

            <div class="review-fee-row review-fee-row--late">
              <span>
                {{ $t("inspection_scheduling_late_fee") }}
                <span v-if="hasLateFee" class="text-error">{{ $t('inspection_late_penalty_days', { days: penaltyDays }) }}</span>
              </span>

              <strong :class="hasLateFee ? 'review-fee-amount--penalty' : ''">{{
                formatCurrency(feeEstimate.lateFee, feeEstimate.currency)
              }}</strong>
            </div>

            <div
              v-if="feeEstimate.optionalServiceEligible"
              class="optional-service mb-4 mt-3"
            >
              <v-checkbox
                v-model="selectedOptionalService"
                color="primary"
                hide-details
              >
                <template #label>
                  <span>{{ $t('inspection_optional_oversize_service') }}</span>
                </template>
              </v-checkbox>

              <p class="text-body-2 text-medium-emphasis ml-10 mb-1">
                {{ $t('inspection_optional_oversize_service_description') }}
              </p>

              <strong class="ml-10">{{ formatCurrency(feeEstimate.optionalServiceFeeKhr) }}</strong>
            </div>

            <div
              v-if="feeEstimate.optionalServiceEligible && selectedOptionalService"
              class="review-fee-row"
            >
              <span>{{ $t('inspection_scheduling_service_fee') }}</span>
              <strong>{{ formatCurrency(displayedServiceFee) }}</strong>
            </div>

            <div class="review-fee-row review-fee-row--total">
              <span>{{ $t("inspection_scheduling_total") }}</span>

              <strong :class="hasLateFee ? 'review-fee-amount--penalty' : ''">{{
                formatCurrency(displayedTotal, feeEstimate.currency)
              }}</strong>
            </div>
          </v-card>

          <v-card
            id="inspection-options"
            border
            class="inspection-options-card mb-5 pa-5 pa-md-6"
            elevation="0"
            rounded="xl"
          >
            <h2 class="text-h6 font-weight-regular mb-4">
              {{ $t("inspection_scheduling_preference_title") }}
            </h2>

            <v-menu v-model="dateMenu" :close-on-content-click="false" max-width="400" min-width="0">
              <template #activator="{ props }">
                <v-text-field
                  append-inner-icon="mdi-calendar"
                  class="scheduling-field scheduling-date-field"
                  :label="$t('inspection_scheduling_date_input_label')"
                  :model-value="displayedDate"
                  readonly
                  variant="outlined"
                  v-bind="props"
                >
                  <template #label>
                    {{ $t('inspection_scheduling_date_input_label') }}
                    <span class="text-error">*</span>
                  </template>
                </v-text-field>
              </template>

              <div class="inspection-date-picker-panel">
                <v-btn
                  class="inspection-date-picker__close"
                  icon="mdi-close"
                  size="small"
                  variant="text"
                  @click="dateMenu = false"
                />

                <v-locale-provider locale="en">
                  <v-date-picker
                    :allowed-dates="isAllowedPreferredDate"
                    class="inspection-date-picker"
                    color="primary"
                    :max="maxPreferredDate"
                    :min="todayKh"
                    :model-value="selectedDate ?? undefined"
                    :title="$t('$vuetify.datePicker.title')"
                    @update:model-value="onDateSelected"
                  />
                </v-locale-provider>
              </div>
            </v-menu>

            <div
              v-if="showSameDaySelectionNotice"
              ref="sameDaySelectionNotice"
            >
              <v-alert
                class="scheduling-info-notice scheduling-pending-notice mb-5"
                density="comfortable"
                icon="mdi-information-outline"
                type="warning"
                variant="tonal"
              >{{ $t('inspection_scheduling_today_selection_closed') }}</v-alert>
            </div>

            <v-select
              v-model="selectedStationSelection"
              class="scheduling-field"
              :items="stationOptions"
              :label="$t('inspection_scheduling_station_label')"
              :menu-props="{ contentClass: 'scheduling-station-menu', maxHeight: 320 }"
              :no-data-text="$t('inspection_scheduling_no_stations')"
              prepend-inner-icon="mdi-map-marker"
              variant="outlined"
            >
              <template #item="{ props, item }">
                <v-list-item
                  v-bind="props"
                  :class="{ 'scheduling-station-menu__no-preference': item.raw.isNoPreference }"
                  :prepend-icon="item.raw.isNoPreference ? 'mdi-map-marker-off-outline' : 'mdi-map-marker-outline'"
                  :subtitle="item.raw.subtitle"
                  :title="item.raw.title"
                />

                <v-divider v-if="item.raw.isNoPreference" class="my-1" />
              </template>
            </v-select>

            <v-alert
              v-if="savedPreferenceNotice"
              class="mb-4"
              density="comfortable"
              type="warning"
              variant="tonal"
            >{{ savedPreferenceNotice }}</v-alert>

            <div v-if="selectedStation" class="station-summary">
              <span class="station-summary__label">
                {{ $t('inspection_scheduling_selected_station_label') }}
              </span>

              <strong>{{ stationName(selectedStation) }}</strong>

              <span>{{ selectedStation.province }} ·
                {{ selectedStation.address }}</span>

              <span v-if="selectedStation.phone">{{
                selectedStation.phone
              }}</span>
            </div>

          </v-card>

          <div class="renewal-scheduling__actions d-flex justify-space-between mt-6">
            <v-btn
              :disabled="saving"
              prepend-icon="mdi-arrow-left"
              variant="outlined"
              @click="backToDocuments"
            >{{ $t("inspection_documents_back") }}</v-btn>

            <v-btn
              append-icon="mdi-arrow-right"
              color="primary"
              :disabled="saving || selectedDate === null || selectedDate === ''"
              :loading="saving"
              @click="continueToReview"
            >{{ $t("inspection_documents_continue") }}</v-btn>
          </div>
        </v-col>

        <v-col class="renewal-scheduling__progress-column" cols="12" md="4">
          <aside class="d-flex flex-column ga-5 renewal-scheduling__sidebar">
            <v-card class="renewal-progress-card pa-5 text-white" elevation="0" rounded="xl">
              <p class="text-body-1 font-weight-medium mb-1">{{ $t('inspection_documents_application_progress') }}</p>
              <div class="text-h3 font-weight-bold">50<span class="text-h6">%</span></div>

              <v-progress-linear
                bg-color="white"
                class="mt-4"
                color="white"
                :model-value="50"
                rounded
              />

              <p class="text-body-2 mt-2 mb-0">{{ $t('inspection_documents_step_two_of_four') }}</p>
            </v-card>
          </aside>
        </v-col>
      </v-row>
    </template>
  </section>
</template>

<style scoped>
.renewal-scheduling {
  max-width: 1120px;
  padding-bottom: 36px;
}
.renewal-breadcrumbs :deep(.v-breadcrumbs-item--link) {
  color: #697080;
}
.renewal-breadcrumbs :deep(.v-breadcrumbs-item) {
  font-size: 0.94rem;
}
.renewal-breadcrumbs :deep(.renewal-breadcrumbs__current) {
  background: #d8def8;
  border-radius: 999px;
  color: #2a3472;
  font-weight: 700;
  opacity: 1;
  padding: 4px 10px;
}
.renewal-scheduling__heading > p {
  font-size: .94rem;
}
.renewal-stepper {
  padding: 12px 28px 10px;
}
.renewal-stepper__steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.renewal-stepper__step {
  align-items: center;
  color: #7c8190;
  display: flex;
  flex-direction: column;
  font-size: .86rem;
  gap: 4px;
  position: relative;
  text-align: center;
}
.renewal-stepper__step:not(:last-child)::after {
  background: #e5e7ed;
  content: '';
  height: 2px;
  left: 50%;
  position: absolute;
  right: -50%;
  top: 13px;
  z-index: 0;
}
.renewal-stepper__step.is-clickable {
  background: transparent;
  border: 0;
  cursor: pointer;
  font-family: inherit;
  padding: 0;
}
.renewal-stepper__number {
  align-items: center;
  background: #ebedf2;
  border-radius: 50%;
  display: inline-flex;
  font-weight: 700;
  height: 26px;
  justify-content: center;
  position: relative;
  width: 26px;
  z-index: 1;
}
.renewal-stepper__step.is-active {
  color: #202746;
  font-weight: 700;
}
.renewal-stepper__step.is-active .renewal-stepper__label {
  font-size: .94rem;
  font-weight: 800;
}
.renewal-stepper__step.is-active .renewal-stepper__number,
.renewal-stepper__step.is-complete .renewal-stepper__number {
  background: rgb(var(--v-theme-primary));
  color: #fff;
}
.renewal-stepper__step.is-complete:not(:last-child)::after {
  background: rgb(var(--v-theme-primary));
}
.renewal-progress-card {
  background: #2c3678;
}
.renewal-scheduling__sidebar {
  align-self: flex-start;
  height: fit-content;
  position: sticky;
  top: 92px;
}
.renewal-scheduling__progress-column { align-self: stretch; }
.renewal-progress-card :deep(*) {
  font-weight: 400 !important;
}
.renewal-progress-card :deep(.text-body-1) { font-size: .95rem !important; }
.renewal-progress-card :deep(.text-h3) { font-size: 2.15rem !important; }
.renewal-progress-card :deep(.text-body-2) { font-size: .85rem !important; }
.renewal-scheduling__actions :deep(.v-btn),
.renewal-scheduling__actions :deep(.v-btn__content) { font-size: .85rem !important; }
.renewal-progress-card :deep(.v-progress-linear__background) {
  opacity: 0.28;
}
.station-summary {
  background: #f6f7fb;
  border: 1px solid #e2e5ef;
  border-left: 3px solid rgb(var(--v-theme-primary));
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  font-size: .94rem;
  gap: 3px;
  padding: 9px 12px;
}
.station-summary span {
  color: #626979;
}
.station-summary__label {
  font-size: .85rem;
  font-weight: 700;
  text-transform: uppercase;
}
.review-fee-row {
  align-items: center;
  border-bottom: 1px dashed #dfe2e8;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 12px 0;
}
.review-fee-row > span {
  font-size: .95rem !important;
}
.review-fee-row:not(.review-fee-row--total) > strong {
  font-size: .94rem;
}
.review-fee-row--category > strong {
  max-width: 68%;
  text-align: right;
}
.review-fee-amount--penalty {
  color: rgb(var(--v-theme-error)) !important;
}
.review-fee-row:first-of-type {
  padding-top: 0;
}
.review-fee-row--total {
  border-bottom: 0;
  color: #202746;
  font-size: 1.05rem;
  padding-bottom: 0;
}
.inspection-options-card { scroll-margin-top: 92px; }
.inspection-date-picker-panel {
  max-width: min(376px, calc(100vw - 32px));
  position: relative;
  width: 376px;
}
.inspection-date-picker {
  max-width: 100%;
  width: 376px;
}
.inspection-date-picker :deep(.v-date-picker-header) {
  height: 52px;
  padding: 8px 48px 8px 18px;
}
.inspection-date-picker :deep(.v-date-picker-header__content) {
  font-size: 1.35rem;
  line-height: 36px;
}
.inspection-date-picker :deep(.v-date-picker-controls) {
  height: 48px;
  padding: 0 8px;
}
.inspection-date-picker :deep(.v-date-picker-month) {
  padding: 0 8px 8px;
}
.inspection-date-picker :deep(.v-date-picker-month__day) {
  height: 36px;
  width: 36px;
}
.inspection-date-picker__close {
  color: #fff;
  position: absolute;
  right: 10px;
  top: 5px;
  z-index: 1;
}
:global(.scheduling-station-menu .v-list) {
  max-height: 320px;
  overflow-y: auto;
  padding-block: 4px;
}
:global(.scheduling-station-menu .v-list-item) {
  min-height: 58px;
  padding-block: 4px;
}
:global(.scheduling-station-menu .v-list-item__content) {
  overflow: visible;
}
:global(.scheduling-station-menu .v-list-item-title) {
  font-size: .94rem;
  line-height: 1.5;
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
}
:global(.scheduling-station-menu .v-list-item-subtitle) {
  font-size: .82rem;
  line-height: 1.4;
  overflow: visible;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
}
:global(.scheduling-station-menu .scheduling-station-menu__no-preference) {
  min-height: 80px;
  padding-block: 6px;
}
:global(.scheduling-station-menu .scheduling-station-menu__no-preference .v-list-item__content) {
  overflow: visible;
}
:global(.scheduling-station-menu .scheduling-station-menu__no-preference .v-list-item-subtitle) {
  -webkit-line-clamp: 3;
  overflow: visible;
  text-overflow: clip;
}
:global(.scheduling-station-menu .v-list-item--active) {
  background: #eef0fb;
  color: #202746;
}
:global(.scheduling-station-menu .v-list-item--active > .v-list-item__overlay) {
  opacity: 0;
}
.scheduling-field :deep(.v-field-label) {
  color: #323849;
  font-size: .85rem !important;
  font-weight: 600;
  opacity: 1;
}
.scheduling-field :deep(.v-field__input),
.scheduling-field :deep(.v-select__selection-text) {
  font-size: .94rem !important;
}
.scheduling-field :deep(.v-field--focused .v-field__outline) {
  color: rgb(var(--v-theme-primary));
}
.scheduling-date-field :deep(input) {
  font-weight: 600;
}
.scheduling-info-notice :deep(.v-alert__content) {
  font-size: .88rem !important;
  line-height: 1.5;
}
.scheduling-date-unavailable-alert :deep(.v-alert__content) { font-size: .9rem !important; }
.scheduling-pending-notice {
  background: #fff1cf !important;
  color: #8a4b00 !important;
}
.scheduling-pending-notice :deep(.v-alert__icon) {
  color: #8a4b00 !important;
}
@media (max-width: 959px) {
  .renewal-scheduling__sidebar {
    display: none !important;
  }
}
@media (max-width: 599px) {
  .renewal-stepper {
    padding: 12px 8px 10px;
  }
  .renewal-stepper__label {
    font-size: .86rem;
    line-height: 1.2;
  }
  .inspection-date-picker {
    width: 100%;
  }
}
</style>
