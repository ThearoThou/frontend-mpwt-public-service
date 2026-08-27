<script setup lang="ts">
  import type {
    CitizenFeeEstimate,
    RenewalApplication,
  } from '../applications/types/application.types'
  import type { InspectionStation } from './services/scheduling.service'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { inspectionApplicationService } from '../applications/services/application.service'
  import { cambodiaToday } from '../vehicles/utils/inspection-expiry-status'
  import { inspectionSchedulingService } from './services/scheduling.service'

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
  const feeEstimate = ref<CitizenFeeEstimate | null>(null)
  const stations = ref<InspectionStation[]>([])
  const selectedStationSelection = ref<StationSelection>(NO_STATION_PREFERENCE)
  const selectedDate = ref<string | null>(null)
  const dateMenu = ref(false)
  const loading = ref(true)
  const saving = ref(false)
  const errorMessage = ref('')
  const savedPreferenceNotice = ref('')
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
  const todayInspectionServiceClosed = computed(() =>
    isCambodiaAtOrAfterInspectionCutoff(currentCambodiaNow.value)
    && isWeekdayDate(todayKh.value)
    && !activeHolidayDateSet.value.has(todayKh.value),
  )
  const stationPreferenceHint = computed(() =>
    selectedStation.value === null
      ? t('inspection_scheduling_no_station_preference_hint')
      : t('inspection_scheduling_selected_station_hint'),
  )
  const displayedDate = computed(() =>
    selectedDate.value === null ? '' : formatDateInput(selectedDate.value),
  )
  const hasLateFee = computed(() => Number(feeEstimate.value?.lateFee ?? 0) > 0)

  function stationName (station: InspectionStation): string {
    return (
      (locale.value === 'kh'
        ? station.nameKh || station.nameEn
        : station.nameEn || station.nameKh)
      || t('inspection_scheduling_station_unnamed')
    )
  }

  function formatCurrency (amount: string, currency: string): string {
    return `${Number(amount).toLocaleString(locale.value === 'kh' ? 'km-KH' : 'en-GB')} ${currency}`
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
    errorMessage.value = ''
    dateMenu.value = false
  }

  async function load () {
    if (!UUID_V4_PATTERN.test(applicationId.value)) {
      errorMessage.value = t('inspection_scheduling_invalid_application_link')
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
      const [loadedStations, estimate, closures] = await Promise.all([
        inspectionSchedulingService.listStations(),
        inspectionApplicationService.getFeeEstimate(draft.id).catch(() => null),
        inspectionSchedulingService.listClosures(todayKh.value, maxPreferredDate.value),
      ])
      stations.value = loadedStations
      feeEstimate.value = estimate
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
      errorMessage.value = t('inspection_scheduling_load_error')
    } finally {
      loading.value = false
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
        errorMessage.value = t('inspection_scheduling_load_error')
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
    if (selectedDate.value === null || selectedDate.value === '') {
      errorMessage.value = t('inspection_scheduling_date_required')
      return
    }
    saving.value = true
    errorMessage.value = ''
    try {
      application.value = await inspectionSchedulingService.savePreference(
        application.value.id,
        selectedDate.value,
        selectedStationId.value,
      )
      await router.push({
        path: '/services/inspection/renewal/review',
        query: { applicationId: application.value.id },
      })
    } catch {
      errorMessage.value = t('inspection_scheduling_save_error')
    } finally {
      saving.value = false
    }
  }

  function backToDocuments () {
    void router.push({
      path: '/services/inspection/renewal/documents',
      query: { applicationId: applicationId.value },
    })
  }

  onMounted(load)
</script>

<template>
  <section class="renewal-scheduling mx-auto">
    <header class="mb-6">
      <h1 class="text-h5 font-weight-bold mb-2">
        {{ $t("inspection_scheduling_title") }}
      </h1>

      <p class="text-medium-emphasis mb-0">
        {{ $t("inspection_scheduling_description") }}
      </p>
    </header>

    <v-alert v-if="errorMessage" class="mb-5" type="error">{{
      errorMessage
    }}</v-alert>

    <v-progress-linear v-if="loading" color="primary" indeterminate />

    <template v-else-if="application">
      <section
        :aria-label="$t('inspection_documents_wizard_label')"
        class="renewal-stepper mb-6"
      >
        <div class="renewal-stepper__steps">
          <button
            class="renewal-stepper__step is-complete is-clickable"
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

      <v-row>
        <v-col cols="12" md="8">
          <v-card border class="mb-5 pa-5 pa-md-6" elevation="0" rounded="xl">
            <h2 class="text-h6 font-weight-bold mb-4">
              {{ $t("inspection_scheduling_preference_title") }}
            </h2>

            <p class="scheduling-preference-description text-body-2 mb-5">
              {{ $t("inspection_scheduling_preference_description") }}
            </p>

            <v-menu v-model="dateMenu" :close-on-content-click="false" min-width="320">
              <template #activator="{ props }">
                <v-text-field
                  append-inner-icon="mdi-calendar"
                  class="scheduling-field"
                  :label="$t('inspection_scheduling_date_label')"
                  :model-value="displayedDate"
                  readonly
                  variant="outlined"
                  v-bind="props"
                >
                  <template #label>
                    {{ $t('inspection_scheduling_date_label') }}
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

            <p class="text-caption text-medium-emphasis mt-n3 mb-5">
              {{ $t("inspection_scheduling_dates_hint") }}
            </p>

            <v-alert
              v-if="todayInspectionServiceClosed"
              class="scheduling-info-notice mb-5"
              density="comfortable"
              icon="mdi-information-outline"
              type="info"
              variant="tonal"
            >{{ $t('inspection_scheduling_today_closed') }}</v-alert>

            <v-select
              v-model="selectedStationSelection"
              class="scheduling-field"
              :items="stationOptions"
              :label="$t('inspection_scheduling_station_label')"
              :no-data-text="$t('inspection_scheduling_no_stations')"
              prepend-inner-icon="mdi-map-marker"
              variant="outlined"
            >
              <template #item="{ props, item }">
                <v-list-item
                  v-bind="props"
                  :prepend-icon="item.raw.isNoPreference ? 'mdi-map-marker-off-outline' : 'mdi-map-marker-outline'"
                  :subtitle="item.raw.subtitle"
                  :title="item.raw.title"
                />

                <v-divider v-if="item.raw.isNoPreference" class="my-1" />
              </template>
            </v-select>

            <p class="text-caption text-medium-emphasis mt-n3 mb-5">
              {{ stationPreferenceHint }}
            </p>

            <v-alert
              v-if="savedPreferenceNotice"
              class="mb-4"
              density="comfortable"
              type="warning"
              variant="tonal"
            >{{ savedPreferenceNotice }}</v-alert>

            <div v-if="selectedStation" class="station-summary mb-5">
              <span class="station-summary__label">{{ $t('inspection_scheduling_selected_station_label') }}</span>
              <strong>{{ stationName(selectedStation) }}</strong>

              <span>{{ selectedStation.province }} ·
                {{ selectedStation.address }}</span>

              <span v-if="selectedStation.phone">{{
                selectedStation.phone
              }}</span>
            </div>

            <v-alert
              class="scheduling-info-notice"
              density="comfortable"
              icon="mdi-information-outline"
              type="info"
              variant="tonal"
            >{{ $t("inspection_scheduling_reservation_notice") }}</v-alert>
          </v-card>

          <v-card
            v-if="feeEstimate"
            border
            class="mt-5 pa-5 pa-md-6"
            elevation="0"
            rounded="xl"
          >
            <div class="d-flex align-center ga-3 mb-4">
              <v-avatar color="primary" size="42" variant="tonal"><v-icon icon="mdi-cash-multiple" /></v-avatar>

              <div>
                <h2 class="text-h6 font-weight-bold mb-1">
                  {{ $t("inspection_review_estimated_fee_title") }}
                </h2>

                <p class="text-body-2 text-medium-emphasis mb-0">
                  {{ $t("inspection_review_fee_copy") }}
                </p>
              </div>
            </div>

            <div class="fee-row">
              <span>{{ $t("inspection_scheduling_inspection_fee") }}</span>

              <strong>{{
                formatCurrency(
                  feeEstimate.inspectionFeeKhr,
                  feeEstimate.currency,
                )
              }}</strong>
            </div>

            <div class="fee-row">
              <span>{{ $t("inspection_scheduling_service_fee") }}</span>

              <strong>{{
                formatCurrency(feeEstimate.serviceFeeKhr, feeEstimate.currency)
              }}</strong>
            </div>

            <div class="fee-row">
              <span>{{ $t("inspection_scheduling_late_fee") }}</span>

              <strong :class="hasLateFee ? 'text-error' : ''">{{
                formatCurrency(feeEstimate.lateFee, feeEstimate.currency)
              }}</strong>
            </div>

            <div class="fee-row fee-row--total">
              <span>{{ $t("inspection_scheduling_estimated_total") }}</span>

              <strong>{{
                formatCurrency(feeEstimate.totalAmount, feeEstimate.currency)
              }}</strong>
            </div>
          </v-card>

          <div class="d-flex justify-space-between mt-6">
            <v-btn
              prepend-icon="mdi-arrow-left"
              variant="outlined"
              @click="backToDocuments"
            >{{ $t("inspection_documents_back") }}</v-btn>

            <v-btn
              append-icon="mdi-arrow-right"
              color="primary"
              :disabled="selectedDate === null || selectedDate === ''"
              :loading="saving"
              @click="continueToReview"
            >{{ $t("inspection_documents_continue") }}</v-btn>
          </div>
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
.renewal-stepper {
  background: #fff;
  border: 1px solid #e3e5eb;
  border-radius: 14px;
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
  font-size: 0.78rem;
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
  font: inherit;
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
  font-size: 0.95rem;
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
.station-summary {
  background: #f8f9fb;
  border-left: 3px solid rgb(var(--v-theme-primary));
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  gap: 3px;
  padding: 11px 13px;
}
.station-summary span {
  color: #626979;
}
.station-summary__label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}
.fee-row {
  align-items: center;
  border-bottom: 1px dashed #dfe2e8;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 12px 0;
}
.fee-row:first-child {
  padding-top: 0;
}
.fee-row:last-child {
  border-bottom: 0;
  color: #202746;
  font-size: 1.05rem;
  padding-bottom: 0;
}
.inspection-date-picker-panel {
  position: relative;
}
.inspection-date-picker {
  width: 360px;
}
.inspection-date-picker__close {
  color: #fff;
  position: absolute;
  right: 10px;
  top: 10px;
  z-index: 1;
}
.scheduling-field :deep(.v-field-label) {
  color: #323849;
  font-weight: 600;
  opacity: 1;
}
.scheduling-preference-description {
  color: #4a5263;
  font-weight: 500;
}
.scheduling-info-notice :deep(.v-alert__content) {
  font-size: 0.9rem;
  line-height: 1.5;
}
@media (max-width: 599px) {
  .renewal-stepper {
    padding: 12px 8px 10px;
  }
  .renewal-stepper__label {
    font-size: 0.72rem;
    line-height: 1.2;
  }
  .inspection-date-picker {
    width: min(360px, calc(100vw - 32px));
  }
}
</style>
