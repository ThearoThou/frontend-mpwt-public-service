<script setup lang="ts">
  import type { CurrentUser } from '../../auth/types/auth.types'
  import type {
    ApplicationDocument,
    ApplicationDocumentType,
    CitizenFeeEstimate,
    RenewalApplication,
  } from '../applications/types/application.types'
  import type { Vehicle } from '../vehicles/types/vehicle.types'
  import type { InspectionStation } from './services/scheduling.service'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { inspectionAuthService } from '../../auth/services/auth.service'
  import { inspectionApplicationService } from '../applications/services/application.service'
  import { inspectionVehicleService } from '../vehicles/services/vehicle.service'
  import { resolveInspectionCategoryLabel } from '../vehicles/utils/inspection-category-label'
  import { inspectionSchedulingService } from './services/scheduling.service'
  import { overdueDayBreakdown } from './utils/late-penalty-display'
  import { prefetchRenewalStep } from './utils/prefetch-renewal-step'

  const UUID_V4_PATTERN
    = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const requiredDocumentTypes: ApplicationDocumentType[] = [
    'VEHICLE_REGISTRATION_CARD',
    'PREVIOUS_INSPECTION_CERTIFICATE',
    'CITIZEN_ID_CARD',
  ]
  const documentTitleKeys: Record<ApplicationDocumentType, string> = {
    VEHICLE_REGISTRATION_CARD: 'inspection_document_vehicle_registration_card',
    PREVIOUS_INSPECTION_CERTIFICATE:
      'inspection_document_previous_inspection_certificate',
    CITIZEN_ID_CARD: 'inspection_document_citizen_id_card',
  }

  const { locale, t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const applicationId = computed(() =>
    typeof route.query.applicationId === 'string'
      ? route.query.applicationId
      : '',
  )
  const application = ref<RenewalApplication | null>(null)
  const citizen = ref<CurrentUser | null>(null)
  const vehicle = ref<Vehicle | null>(null)
  const documents = ref<ApplicationDocument[]>([])
  const imagePreviewUrls = ref<Partial<Record<ApplicationDocumentType, string>>>({})
  const feeEstimate = ref<CitizenFeeEstimate | null>(null)
  const station = ref<InspectionStation | null>(null)
  const schedulingAvailable = ref(false)
  const schedulingError = ref('')
  const loading = ref(true)
  const viewingDocumentId = ref<string | null>(null)
  const previewDocument = ref<ApplicationDocument | null>(null)
  const previewUrl = ref<string | null>(null)
  const previewDialogVisible = ref(false)
  const noStationConfirmationVisible = ref(false)
  const noStationAcknowledged = ref(false)
  const navigatingToPayment = ref(false)
  const errorMessage = ref('')

  const currentDocuments = computed(() =>
    documents.value.filter(document => document.isCurrent),
  )
  const documentsReady = computed(() =>
    requiredDocumentTypes.every(type => currentDocument(type) !== undefined),
  )
  const hasRejectedDocument = computed(() =>
    currentDocuments.value.some(
      document =>
        requiredDocumentTypes.includes(document.documentType)
        && document.status === 'REJECTED',
    ),
  )
  const hasSavedSchedulingPreference = computed(
    () => application.value?.preferredInspectionDate !== null,
  )
  const requirementsMessage = computed(() => {
    if (!documentsReady.value) return t('inspection_review_documents_missing')
    if (hasRejectedDocument.value)
      return t('inspection_review_documents_rejected')
    if (!hasSavedSchedulingPreference.value)
      return t('inspection_review_schedule_missing')
    if (!schedulingAvailable.value)
      return t('inspection_review_schedule_unavailable')
    return ''
  })
  const canContinueToPayment = computed(
    () =>
      application.value?.status === 'DRAFT' && requirementsMessage.value === '',
  )
  const previewIsPdf = computed(
    () => previewDocument.value?.mimeType === 'application/pdf',
  )
  const hasLateFee = computed(() => Number(feeEstimate.value?.lateFee ?? 0) > 0)
  const penaltyDays = computed(() => feeEstimate.value === null
    ? 0
    : overdueDayBreakdown(feeEstimate.value.lateDays).penaltyDays)

  function isValidApplicationId (value: string): boolean {
    return UUID_V4_PATTERN.test(value)
  }

  function currentDocument (
    type: ApplicationDocumentType,
  ): ApplicationDocument | undefined {
    return currentDocuments.value.find(
      document => document.documentType === type,
    )
  }

  function documentIsImage (document: ApplicationDocument): boolean {
    return document.mimeType.startsWith('image/')
  }

  function imagePreviewUrl (type: ApplicationDocumentType): string | null {
    return imagePreviewUrls.value[type] ?? null
  }

  function releaseImagePreviews () {
    for (const url of Object.values(imagePreviewUrls.value)) {
      if (url) URL.revokeObjectURL(url)
    }
    imagePreviewUrls.value = {}
  }

  async function loadImagePreview (document: ApplicationDocument) {
    if (!application.value || !documentIsImage(document)) return
    try {
      const file = await inspectionApplicationService.downloadDocument(
        application.value.id,
        document.id,
      )
      if (currentDocument(document.documentType)?.id !== document.id) return
      imagePreviewUrls.value = {
        ...imagePreviewUrls.value,
        [document.documentType]: URL.createObjectURL(
          new Blob([file], { type: document.mimeType }),
        ),
      }
    } catch {
      // A missing thumbnail does not block review or document preview.
    }
  }

  function stationName (value: InspectionStation): string {
    return (
      (locale.value === 'kh'
        ? value.nameKh || value.nameEn
        : value.nameEn || value.nameKh) || t('inspection_review_station_fallback')
    )
  }

  function formatDate (value: string | null): string {
    if (!value) return '—'
    const [year, month, day] = value.split('-').map(Number)
    if (!year || !month || !day) return value

    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
  }

  function formatCurrency (amount: string, _currency?: string): string {
    const [whole, fraction] = amount.split('.')
    const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/gu, ',')
    return `${fraction && !/^0+$/u.test(fraction) ? `${groupedWhole}.${fraction}` : groupedWhole} ៛`
  }

  function formatPhoneNumber (value: string | null | undefined): string {
    if (!value) return '—'
    const normalized = value.replace(/[\s-]/g, '')
    return normalized.startsWith('+855')
      ? `0${normalized.slice(4).replace(/^0/, '')}`
      : value
  }

  function formatPlateNumber (value: Vehicle): string {
    const displayLabel = value.plateDisplayLabelKh.trim()
    return displayLabel
      ? `${displayLabel} ${value.plateNumber}`
      : value.plateNumber
  }

  function vehicleSummary (value: Vehicle): string {
    const makeAndModel = `${value.make} ${value.model}`.trim()
    return value.manufactureYear === null
      ? makeAndModel
      : `${makeAndModel} · ${value.manufactureYear}`
  }

  async function loadSchedulingAvailability (
    draft: RenewalApplication,
    stations: InspectionStation[],
  ) {
    station.value
      = draft.preferredInspectionStationId === null
        ? null
        : (stations.find(
          item => item.id === draft.preferredInspectionStationId,
        ) ?? null)
    schedulingAvailable.value
      = draft.preferredInspectionDate !== null
        && (draft.preferredInspectionStationId === null || station.value !== null)
  }

  async function load () {
    if (!isValidApplicationId(applicationId.value)) {
      errorMessage.value = t('inspection_review_invalid_application_link')
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
      const [me, selectedVehicle, listedDocuments, estimate, stations]
        = await Promise.all([
          inspectionAuthService.getCurrentUser(),
          inspectionVehicleService.getById(draft.vehicleId),
          inspectionApplicationService.listDocuments(draft.id),
          inspectionApplicationService.getFeeEstimate(draft.id).catch(() => null),
          inspectionSchedulingService.listStations(),
        ])
      citizen.value = me
      vehicle.value = selectedVehicle
      documents.value = listedDocuments.filter(document => document.isCurrent)
      void Promise.all(documents.value.map(document => loadImagePreview(document)))
      feeEstimate.value = estimate
      await loadSchedulingAvailability(draft, stations)
    } catch {
      errorMessage.value = t('inspection_review_load_error')
    } finally {
      loading.value = false
    }
  }

  async function viewDocument (document: ApplicationDocument) {
    if (!application.value || viewingDocumentId.value !== null) return

    viewingDocumentId.value = document.id
    try {
      const file = await inspectionApplicationService.downloadDocument(
        application.value.id,
        document.id,
      )
      closeDocumentPreview()
      previewDocument.value = document
      previewUrl.value = URL.createObjectURL(
        new Blob([file], { type: document.mimeType }),
      )
      previewDialogVisible.value = true
    } catch {
      errorMessage.value = t('inspection_review_document_view_error')
    } finally {
      viewingDocumentId.value = null
    }
  }

  function closeDocumentPreview () {
    previewDialogVisible.value = false
    if (previewUrl.value !== null) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
    previewDocument.value = null
  }

  function updatePreviewDialog (visible: boolean) {
    if (!visible) closeDocumentPreview()
  }

  async function navigateToPayment () {
    if (!application.value || navigatingToPayment.value) return

    navigatingToPayment.value = true
    errorMessage.value = ''
    try {
      await router.push({
        path: '/services/inspection/renewal/payment',
        query: { applicationId: application.value.id },
      })
      noStationConfirmationVisible.value = false
      noStationAcknowledged.value = false
    } catch {
      errorMessage.value = t('inspection_payment_load_error')
    } finally {
      navigatingToPayment.value = false
    }
  }

  function continueToPayment () {
    if (!application.value) return
    if (!canContinueToPayment.value) {
      errorMessage.value = requirementsMessage.value
      return
    }

    noStationAcknowledged.value = false
    noStationConfirmationVisible.value = true
  }

  function updateNoStationConfirmation (visible: boolean) {
    noStationConfirmationVisible.value = visible
    if (!visible) noStationAcknowledged.value = false
  }

  function backToScheduling () {
    void router.push({
      path: '/services/inspection/renewal/scheduling',
      query: { applicationId: applicationId.value },
    })
  }

  function goToDocuments () {
    void router.push({
      path: '/services/inspection/renewal/documents',
      query: { applicationId: applicationId.value },
    })
  }

  function goToScheduling () {
    void router.push({
      path: '/services/inspection/renewal/scheduling',
      query: { applicationId: applicationId.value },
    })
  }

  function changeScheduling () {
    void router.push({
      path: '/services/inspection/renewal/scheduling',
      query: {
        applicationId: applicationId.value,
        focus: 'inspection-options',
      },
    })
  }

  onMounted(() => {
    prefetchRenewalStep('payment')
    void load()
  })
  onBeforeUnmount(() => {
    closeDocumentPreview()
    releaseImagePreviews()
  })
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <section class="renewal-review mx-auto">
    <header class="renewal-review__heading">
      <v-breadcrumbs
        :aria-label="$t('inspection_review_breadcrumb_label')"
        class="renewal-breadcrumbs px-0 pb-5"
        density="compact"
      >
        <v-breadcrumbs-item to="/services/inspection/dashboard">{{
          $t("inspection_dashboard")
        }}</v-breadcrumbs-item>
        <v-breadcrumbs-divider icon="mdi-chevron-right" />
        <v-breadcrumbs-item
          active
          active-color="primary"
          class="renewal-breadcrumbs__current"
        >{{ $t("inspection_documents_wizard_review") }}</v-breadcrumbs-item>
      </v-breadcrumbs>
      <h1 class="text-h5 font-weight-regular mb-2">
        {{ $t("inspection_review_title") }}
      </h1>
      <p class="renewal-review__supporting-copy text-medium-emphasis mb-0">
        {{ $t("inspection_review_description") }}
      </p>
    </header>

    <section
      :aria-label="$t('inspection_documents_wizard_label')"
      class="renewal-stepper mb-6"
    >
      <div class="renewal-stepper__track">
        <span class="renewal-stepper__track-active" />
      </div>
      <div class="renewal-stepper__steps">
        <button
          class="renewal-stepper__step is-complete is-clickable"
          type="button"
          @click="goToDocuments"
        >
          <span class="renewal-stepper__number"><v-icon icon="mdi-check" size="17" /></span><span class="renewal-stepper__label">{{
            $t("inspection_documents_wizard_documents")
          }}</span>
        </button>
        <button
          class="renewal-stepper__step is-complete is-clickable"
          type="button"
          @click="goToScheduling"
        >
          <span class="renewal-stepper__number"><v-icon icon="mdi-check" size="17" /></span><span class="renewal-stepper__label">{{
            $t("inspection_documents_wizard_service_fee")
          }}</span>
        </button>
        <div class="renewal-stepper__step is-active">
          <span class="renewal-stepper__number">3</span><span class="renewal-stepper__label">{{
            $t("inspection_documents_wizard_review")
          }}</span>
        </div>
        <div class="renewal-stepper__step">
          <span class="renewal-stepper__number">4</span><span class="renewal-stepper__label">{{
            $t("inspection_documents_wizard_payment")
          }}</span>
        </div>
      </div>
    </section>

    <v-alert v-if="errorMessage" class="mb-5" type="error">{{
      errorMessage
    }}</v-alert>
    <v-progress-linear v-if="loading" color="primary" indeterminate />

    <template v-else-if="application && citizen && vehicle">

      <v-row class="renewal-review__layout">
        <v-col cols="12" md="8">
          <v-card
            border
            class="review-card mb-5 pa-5 pa-md-6"
            elevation="0"
            rounded="xl"
          >
            <div class="d-flex align-center ga-3 mb-5">
              <v-avatar color="primary" size="42" variant="tonal"><v-icon icon="mdi-car-info" /></v-avatar>
              <div>
                <h2 class="text-h6 font-weight-regular mb-1">
                  {{ $t("inspection_documents_applicant_vehicle") }}
                </h2>
              </div>
            </div>
            <div class="review-info-grid">
              <div>
                <span>{{ $t("inspection_documents_khmer_name") }}</span><strong>{{ citizen.citizenProfile?.nameKh || "—" }}</strong>
              </div>
              <div>
                <span>{{ $t("inspection_documents_plate_number") }}</span><strong>{{ formatPlateNumber(vehicle) }}</strong>
              </div>
              <div>
                <span>{{ $t("inspection_documents_national_id") }}</span><strong>{{
                  citizen.citizenProfile?.nationalIdNumber || "—"
                }}</strong>
              </div>
              <div>
                <span>{{ $t("inspection_documents_chassis_number") }}</span><strong>{{ vehicle.chassisNumber }}</strong>
              </div>
              <div>
                <span>{{ $t("inspection_documents_phone_number") }}</span><strong>{{ formatPhoneNumber(citizen.user.phone) }}</strong>
              </div>
              <div>
                <span>{{
                  $t("inspection_documents_first_registration_date")
                }}</span><strong>{{
                  formatDate(vehicle.firstRegistrationDate)
                }}</strong>
              </div>
              <div>
                <span>{{ $t("inspection_make_and_model") }}</span><strong>{{ vehicleSummary(vehicle) }}</strong>
              </div>
              <div>
                <span>{{ $t("inspection_payment_inspection_category") }}</span><strong>{{
                  resolveInspectionCategoryLabel(vehicle.inspectionCategory, locale)
                }}</strong>
              </div>
            </div>
          </v-card>

          <v-card
            border
            class="review-card mb-5 pa-5 pa-md-6"
            elevation="0"
            rounded="xl"
          >
            <div class="d-flex align-center ga-3 mb-4">
              <v-avatar color="primary" size="42" variant="tonal"><v-icon icon="mdi-folder-outline" /></v-avatar>
              <div>
                <h2 class="text-h6 font-weight-regular mb-1">
                  {{ $t("inspection_review_uploaded_documents") }}
                </h2>
              </div>
            </div>
            <div class="review-document-list">
              <div
                v-for="type in requiredDocumentTypes"
                :key="type"
                class="review-document-row"
              >
                <div class="review-document-row__heading">
                  <v-avatar class="review-document-row__type-avatar" size="42">
                    <span v-if="type === 'VEHICLE_REGISTRATION_CARD'" class="review-document-row__vehicle-id-icons">
                      <v-icon icon="mdi-card-account-details-outline" size="24" />
                      <v-icon class="review-document-row__vehicle-id-car" icon="mdi-car-side" size="15" />
                    </span>
                    <span v-else-if="type === 'PREVIOUS_INSPECTION_CERTIFICATE'" class="review-document-row__certificate-icon">
                      <v-icon icon="mdi-card-text-outline" size="24" />
                      <v-icon class="review-document-row__certificate-check" icon="mdi-check-circle" size="13" />
                    </span>
                    <v-icon v-else icon="mdi-card-account-details-outline" size="24" />
                  </v-avatar>
                  <strong class="review-document-row__title text-body-2">{{ $t(documentTitleKeys[type]) }}</strong>
                </div>
                <div v-if="currentDocument(type)" class="review-document-row__file">
                  <button
                    v-if="imagePreviewUrl(type)"
                    :aria-label="$t('inspection_review_view_document')"
                    class="review-document-row__thumbnail"
                    type="button"
                    @click="viewDocument(currentDocument(type)!)"
                  >
                    <img :alt="currentDocument(type)!.originalFileName" :src="imagePreviewUrl(type)!">
                  </button>
                  <div v-else aria-hidden="true" class="review-document-row__file-icon">
                    <v-icon :icon="currentDocument(type)!.mimeType === 'application/pdf' ? 'mdi-file-pdf-box' : 'mdi-file-outline'" size="26" />
                  </div>
                  <span class="review-document-row__filename text-caption text-medium-emphasis text-truncate">{{ currentDocument(type)?.originalFileName }}</span>
                  <v-btn
                    :aria-label="$t('inspection_review_view_document')"
                    :disabled="viewingDocumentId !== null"
                    icon="mdi-eye-outline"
                    :loading="viewingDocumentId === currentDocument(type)?.id"
                    size="small"
                    variant="text"
                    @click="viewDocument(currentDocument(type)!)"
                  />
                </div>
                <span v-else class="text-caption text-error">{{ $t("inspection_document_not_uploaded") }}</span>
              </div>
            </div>
          </v-card>

          <v-card
            border
            class="review-card pa-5 pa-md-6"
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
            <template v-if="feeEstimate">
              <div class="review-fee-row review-fee-row--category">
                <span>{{ $t('inspection_payment_inspection_category') }}</span>
                <strong>{{ resolveInspectionCategoryLabel(vehicle.inspectionCategory, locale) }}</strong>
              </div>
              <div class="review-fee-row">
                <span>{{ $t("inspection_scheduling_inspection_fee") }}</span><strong>{{
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
                </span><strong :class="hasLateFee ? 'review-fee-amount--penalty' : ''">{{
                  formatCurrency(feeEstimate.lateFee, feeEstimate.currency)
                }}</strong>
              </div>
              <div class="review-fee-row review-fee-row--total">
                <span>{{ $t("inspection_scheduling_total") }}</span><strong :class="hasLateFee ? 'review-fee-amount--penalty' : ''">{{
                  formatCurrency(feeEstimate.totalAmount, feeEstimate.currency)
                }}</strong>
              </div>
            </template>
            <p v-else class="text-body-2 text-medium-emphasis mb-0">
              {{ $t("inspection_scheduling_fee_unavailable") }}
            </p>
          </v-card>

          <div class="renewal-review__actions d-flex justify-space-between mt-6">
            <v-btn
              prepend-icon="mdi-arrow-left"
              variant="outlined"
              @click="backToScheduling"
            >{{ $t("inspection_documents_back") }}</v-btn>
            <div class="review-submit-action">
              <v-btn
                append-icon="mdi-arrow-right"
                color="primary"
                :disabled="!canContinueToPayment"
                @click="continueToPayment"
              >{{ $t("inspection_review_continue_to_payment") }}</v-btn>
            </div>
          </div>
        </v-col>

        <v-col class="renewal-review__progress-column" cols="12" md="4">
          <aside class="d-flex flex-column ga-5 renewal-review__sidebar">
            <v-card
              class="renewal-progress-card pa-5 text-white"
              elevation="0"
              rounded="xl"
            ><p class="text-body-1 font-weight-medium mb-1">
               {{ $t("inspection_documents_application_progress") }}
             </p>
              <div class="text-h3 font-weight-bold">
                75<span class="text-h6">%</span>
              </div>
              <v-progress-linear
                bg-color="white"
                class="mt-4"
                color="white"
                :model-value="75"
                rounded
              />
              <p class="text-body-2 mt-2 mb-0">
                {{ $t("inspection_review_step_three_of_four") }}
              </p></v-card>
          <div class="d-flex flex-column ga-5">
            <v-card
              border
              class="review-card review-ready-card pa-5"
              elevation="0"
              rounded="xl"
            ><div class="d-flex align-center ga-3 mb-4">
               <v-avatar color="primary" size="38" variant="tonal"><v-icon icon="mdi-check-circle-outline" /></v-avatar>
               <h2 class="review-ready-card__title text-subtitle-1 font-weight-regular">
                 {{ $t("inspection_review_ready_to_submit") }}
               </h2>
             </div>
              <div class="review-checklist">
                <div
                  :class="{
                    'is-ready': documentsReady && !hasRejectedDocument,
                  }"
                >
                  <v-icon
                    :icon="
                      documentsReady && !hasRejectedDocument
                        ? 'mdi-check-circle'
                        : 'mdi-circle-outline'
                    "
                    size="18"
                  /><span>{{ $t("inspection_review_check_documents") }}</span>
                </div>
                <div :class="{ 'is-ready': schedulingAvailable }">
                  <v-icon
                    :icon="
                      schedulingAvailable
                        ? 'mdi-check-circle'
                        : 'mdi-circle-outline'
                    "
                    size="18"
                  /><span>{{ $t("inspection_review_check_schedule") }}</span>
                </div>
                <div :class="{ 'is-ready': feeEstimate !== null }">
                  <v-icon
                    :icon="
                      feeEstimate !== null
                        ? 'mdi-check-circle'
                        : 'mdi-circle-outline'
                    "
                    size="18"
                  /><span>{{ $t("inspection_review_check_fee") }}</span>
                </div>
              </div></v-card>
            <v-card
              border
              class="review-card review-schedule-card pa-4"
              elevation="0"
              rounded="xl"
            >
              <div class="d-flex align-center justify-space-between ga-2 mb-4">
                <div class="d-flex align-center ga-3">
                  <v-avatar color="primary" size="38" variant="tonal"><v-icon icon="mdi-calendar-check-outline" /></v-avatar>
                  <h2 class="review-schedule-card__title text-subtitle-1 font-weight-regular">
                    {{ $t("inspection_review_schedule_title") }}
                  </h2>
                </div>
                <v-btn
                  class="review-schedule-card__change"
                  color="primary"
                  size="small"
                  @click="changeScheduling"
                >{{ $t("inspection_review_change_schedule") }}</v-btn>
              </div>
              <template v-if="application.preferredInspectionDate">
                <template v-if="station">
                  <p class="review-schedule-card__station-name text-body-2 font-weight-regular mb-1">
                    {{ stationName(station) }}
                  </p>
                  <p class="review-schedule-card__any-station-copy text-body-2 text-medium-emphasis mb-2">
                    {{ station.province }} · {{ station.address }}
                  </p>
                </template>
                <template v-else>
                  <p class="review-schedule-card__no-preference-title text-body-2 font-weight-regular mb-1">
                    {{ $t('inspection_scheduling_no_station_preference') }}
                  </p>
                </template>
                <p class="review-schedule-card__date mb-0">
                  {{ formatDate(application.preferredInspectionDate) }}
                </p>
              </template>
              <p v-else class="text-body-2 text-error mb-0">
                {{ $t("inspection_review_schedule_missing") }}
              </p>
            </v-card>
            <v-alert
              v-if="schedulingError || requirementsMessage"
              density="comfortable"
              type="warning"
              variant="tonal"
            >{{ schedulingError || requirementsMessage }}</v-alert>
          </div>
          </aside>
        </v-col>
      </v-row>

      <v-dialog
        max-width="440"
        :model-value="noStationConfirmationVisible"
        @update:model-value="updateNoStationConfirmation"
      >
        <v-card class="no-station-confirmation pa-5 pa-sm-6" rounded="xl">
          <v-btn
            :aria-label="$t('inspection_document_close_preview')"
            class="no-station-confirmation__close"
            icon="mdi-close"
            size="small"
            variant="text"
            @click="updateNoStationConfirmation(false)"
          />

          <div class="no-station-confirmation__heading">
            <v-avatar class="no-station-confirmation__icon" size="56">
              <v-icon icon="mdi-calendar-clock-outline" size="30" />
            </v-avatar>
            <h2>{{ $t('inspection_review_no_station_confirmation_title') }}</h2>
          </div>

          <ul class="no-station-confirmation__message">
            <li v-if="station">
              {{ $t('inspection_review_confirmation_station') }}
              <strong>{{ stationName(station) }}</strong>
            </li>
            <li v-else>
              {{ $t('inspection_review_confirmation_any_station_label') }}
              <strong class="no-station-confirmation__any-station">
                {{ $t('inspection_review_confirmation_any_station_value') }}
              </strong>
            </li>
            <li>
              {{ $t('inspection_review_confirmation_date') }}
              <strong>{{ formatDate(application.preferredInspectionDate) }}</strong>
            </li>
            <li>
              {{ $t('inspection_review_confirmation_alternate_date') }}
            </li>
          </ul>

          <v-form @submit.prevent="navigateToPayment">
            <v-checkbox
              v-model="noStationAcknowledged"
              class="no-station-confirmation__acknowledgement"
              color="primary"
              density="compact"
              hide-details
              :label="$t('inspection_review_no_station_acknowledgement')"
            />

            <div class="no-station-confirmation__actions">
              <v-btn
                color="primary"
                :disabled="!noStationAcknowledged || navigatingToPayment"
                :loading="navigatingToPayment"
                type="submit"
              >
                {{ $t('inspection_review_confirmation_agree') }}
              </v-btn>
            </div>
          </v-form>
        </v-card>
      </v-dialog>

      <v-dialog
        max-width="1000"
        :model-value="previewDialogVisible"
        @update:model-value="updatePreviewDialog"
      >
        <v-card class="review-document-preview-card">
          <div class="d-flex align-center justify-space-between ga-3 pa-4">
            <p class="text-body-1 font-weight-bold text-truncate mb-0">
              {{ previewDocument?.originalFileName }}
            </p>
            <v-btn
              :aria-label="$t('inspection_document_close_preview')"
              icon="mdi-close"
              variant="text"
              @click="closeDocumentPreview"
            />
          </div>
          <div v-if="previewUrl" class="review-document-preview">
            <iframe
              v-if="previewIsPdf"
              class="review-document-preview__pdf"
              :src="previewUrl"
              :title="previewDocument?.originalFileName"
            /><v-img
              v-else
              :alt="previewDocument?.originalFileName"
              class="review-document-preview__image"
              contain
              :src="previewUrl"
            />
          </div>
        </v-card>
      </v-dialog>
    </template>
  </section>
</template>

<style scoped>
.renewal-review {
  max-width: 1120px;
  padding-bottom: 36px;
}
.renewal-review__heading {
  margin-bottom: 24px;
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
  padding: 4px 10px;
}
.renewal-stepper {
  padding: 12px 28px 10px;
  position: relative;
}
.renewal-stepper__track {
  display: none;
}
.renewal-stepper__track-active {
  display: none;
}
.renewal-stepper__steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  position: relative;
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
  content: "";
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
.renewal-stepper__step.is-complete {
  color: #7c8190;
  font-weight: 500;
}
.renewal-stepper__step.is-active .renewal-stepper__label {
  font-size: .94rem;
  font-weight: 800;
  line-height: 1.2;
}
.renewal-stepper__step.is-active .renewal-stepper__number,
.renewal-stepper__step.is-complete .renewal-stepper__number {
  background: rgb(var(--v-theme-primary));
  color: #fff;
}
.renewal-stepper__step.is-complete:not(.is-terminal)::after {
  background: rgb(var(--v-theme-primary));
}
.review-info-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.review-info-grid > div {
  background: transparent;
  border: 0;
  border-radius: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 11px 13px;
}
.review-info-grid span {
  color: #787e8d;
  font-size: .9rem !important;
}
.review-info-grid strong {
  color: #242834;
  font-size: .94rem !important;
  overflow-wrap: anywhere;
}
.renewal-review__heading > p {
  font-size: .94rem !important;
}
.review-card > .d-flex > div > p,
.review-schedule-card > p.text-body-2 {
  font-size: .94rem !important;
}
.renewal-review__supporting-copy {
  font-size: .94rem !important;
}
.review-card__supporting-copy {
  font-family: inherit !important;
  font-size: .94rem !important;
  font-weight: 400 !important;
  letter-spacing: normal !important;
  line-height: 1.5 !important;
}
.review-document-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.review-document-row {
  background: transparent;
  border: 0;
  border-radius: 0;
  display: grid;
  gap: 14px;
  padding: 14px 10px;
}
.review-document-row__heading {
  align-items: center;
  display: flex;
  gap: 12px;
  min-width: 0;
}
.review-document-row__type-avatar {
  background: #e7e9f1;
  color: #172d73;
  flex: 0 0 auto;
}
.review-document-row__vehicle-id-icons,
.review-document-row__certificate-icon {
  display: inline-flex;
  position: relative;
}
.review-document-row__vehicle-id-car {
  background: #e7e9f1;
  border-radius: 4px;
  bottom: -5px;
  position: absolute;
  right: -6px;
}
.review-document-row__certificate-check {
  background: #e7e9f1;
  border-radius: 50%;
  bottom: -2px;
  position: absolute;
  right: -4px;
}
.review-document-row__file {
  align-items: center;
  display: flex;
  gap: 12px;
  min-width: 0;
  padding-inline-start: 18px;
}
.review-document-row__thumbnail,
.review-document-row__file-icon {
  align-items: center;
  background: #eef1f7;
  border: 0;
  border-radius: 8px;
  color: #172d73;
  display: flex;
  flex: 0 0 56px;
  height: 56px;
  justify-content: center;
  overflow: hidden;
  padding: 0;
  width: 56px;
}
.review-document-row__thumbnail {
  cursor: zoom-in;
}
.review-document-row__thumbnail img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}
.review-document-row__title {
  font-size: .94rem !important;
}
.review-document-row__filename {
  flex: 1 1 auto;
  font-size: 0.85rem !important;
  min-width: 0;
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
  font-size: .94rem !important;
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
.renewal-progress-card {
  background: #2c3678;
}
.renewal-progress-card :deep(*) {
  font-weight: 400 !important;
}
.renewal-progress-card :deep(.text-body-1) { font-size: .95rem !important; }
.renewal-progress-card :deep(.text-h3) { font-size: 2.15rem !important; }
.renewal-progress-card :deep(.text-body-2) { font-size: .85rem !important; }
.renewal-review__actions :deep(.v-btn),
.renewal-review__actions :deep(.v-btn__content) { font-size: .85rem !important; }
.renewal-progress-card :deep(.v-progress-linear__background) {
  opacity: 0.28;
}
.review-checklist {
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.review-checklist > div {
  align-items: center;
  color: #7c8190;
  display: flex;
  font-size: 0.85rem !important;
  gap: 8px;
}
.review-checklist > div.is-ready {
  color: #26783d;
  font-weight: 400;
}
.review-checklist :deep(.v-icon) {
  color: currentColor;
}
.review-ready-card__title { font-size: .9rem !important; }
.review-schedule-card__date {
  color: #202746;
  font-size: 0.95rem !important;
  font-weight: 800;
}
.review-schedule-card__title { font-size: .9rem !important; }
.review-schedule-card > p.review-schedule-card__station-name { font-size: .875rem !important; }
.review-schedule-card > p.review-schedule-card__no-preference-title { font-size: .85rem !important; }
.review-schedule-card > p.review-schedule-card__any-station-copy { font-size: .85rem !important; }
.review-schedule-card__change {
  font-size: 0.85rem !important;
}
.review-submit-action {
  max-width: 310px;
  text-align: right;
}
.no-station-confirmation {
  position: relative;
}
.no-station-confirmation__close {
  position: absolute;
  right: 10px;
  top: 10px;
}
.no-station-confirmation__heading {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-inline: 32px;
  text-align: center;
}
.no-station-confirmation__heading h2 {
  color: #b66a28;
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0;
}
.no-station-confirmation__icon {
  background: #fff4e8 !important;
  color: #b66a28 !important;
}
.no-station-confirmation__message {
  color: #555d70;
  font-size: .93rem;
  line-height: 1.6;
  margin: 20px 0;
  padding-inline-start: 22px;
}
.no-station-confirmation__message li + li {
  margin-top: 12px;
}
.no-station-confirmation__message strong {
  color: #b66a28;
  font-weight: 700;
}
.no-station-confirmation__any-station {
  white-space: nowrap;
}
.no-station-confirmation__actions {
  display: flex;
  margin-top: 16px;
}
.no-station-confirmation__actions :deep(.v-btn) {
  width: 100%;
}
.no-station-confirmation__actions :deep(.v-btn__content),
.no-station-confirmation__acknowledgement :deep(.v-label) {
  font-size: .85rem;
}
.renewal-review__sidebar {
  align-self: flex-start;
  height: fit-content;
  position: sticky;
  top: 92px;
}
.renewal-review__progress-column { align-self: stretch; }
.review-document-preview {
  align-items: center;
  background: #f5f6fa;
  display: flex;
  justify-content: center;
  min-height: 380px;
}
.review-document-preview__image {
  background: #16181f;
  max-height: 72vh;
  width: 100%;
}
.review-document-preview__pdf {
  border: 0;
  display: block;
  height: 72vh;
  width: 100%;
}
@media (max-width: 959px) {
  .renewal-review {
    max-width: 760px;
  }
  .renewal-review__sidebar {
    display: none !important;
  }
}
.review-card {
  min-width: 0;
}
@media (max-width: 599px) {
  .renewal-review {
    padding-bottom: 24px;
  }
  .renewal-stepper {
    padding: 12px 8px 10px;
  }
  .renewal-stepper__label {
    font-size: .86rem;
    line-height: 1.2;
  }
  .renewal-stepper__step.is-active .renewal-stepper__label {
    font-size: .94rem;
  }
  .review-info-grid {
    grid-template-columns: 1fr;
  }
  .review-submit-action {
    text-align: right;
  }
}
</style>
