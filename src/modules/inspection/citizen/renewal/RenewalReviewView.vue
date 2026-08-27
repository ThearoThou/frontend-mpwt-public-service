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
  import { formatVehicleType } from '../vehicles/utils/vehicle-type-label'
  import { inspectionSchedulingService } from './services/scheduling.service'

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
  const feeEstimate = ref<CitizenFeeEstimate | null>(null)
  const station = ref<InspectionStation | null>(null)
  const schedulingAvailable = ref(false)
  const schedulingError = ref('')
  const loading = ref(true)
  const viewingDocumentId = ref<string | null>(null)
  const previewDocument = ref<ApplicationDocument | null>(null)
  const previewUrl = ref<string | null>(null)
  const previewDialogVisible = ref(false)
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

  function documentIcon (type: ApplicationDocumentType): string {
    return {
      VEHICLE_REGISTRATION_CARD: 'mdi-card-account-details-outline',
      PREVIOUS_INSPECTION_CERTIFICATE: 'mdi-certificate-outline',
      CITIZEN_ID_CARD: 'mdi-card-account-details-outline',
    }[type]
  }

  function documentStatusColor (status: ApplicationDocument['status']): string {
    return { PENDING: 'warning', APPROVED: 'success', REJECTED: 'error' }[status]
  }

  function documentStatusText (status: ApplicationDocument['status']): string {
    if (status === 'PENDING')
      return t('inspection_review_document_uploaded_pending')
    return t(`inspection_review_document_${status.toLowerCase()}`)
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

  function formatCurrency (amount: string, currency: string): string {
    const [whole, fraction] = amount.split('.')
    const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/gu, ',')
    return `${fraction && !/^0+$/u.test(fraction) ? `${groupedWhole}.${fraction}` : groupedWhole} ${currency}`
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

  function continueToPayment () {
    if (!application.value) return
    if (!canContinueToPayment.value) {
      errorMessage.value = requirementsMessage.value
      return
    }

    void router.push({
      path: '/services/inspection/renewal/payment',
      query: { applicationId: application.value.id },
    })
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

  onMounted(load)
  onBeforeUnmount(closeDocumentPreview)
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
      <h1 class="text-h5 font-weight-bold mb-2">
        {{ $t("inspection_review_title") }}
      </h1>
      <p class="text-medium-emphasis mb-0">
        {{ $t("inspection_review_description") }}
      </p>
    </header>

    <v-alert v-if="errorMessage" class="mb-5" type="error">{{
      errorMessage
    }}</v-alert>
    <v-progress-linear v-if="loading" color="primary" indeterminate />

    <template v-else-if="application && citizen && vehicle">
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
                <h2 class="text-h6 font-weight-bold mb-1">
                  {{ $t("inspection_documents_applicant_vehicle") }}
                </h2>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  {{ $t("inspection_review_information_copy") }}
                </p>
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
                <span>{{ $t("inspection_vehicle_type") }}</span><strong>{{
                  formatVehicleType(vehicle.vehicleType, t)
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
                <h2 class="text-h6 font-weight-bold mb-1">
                  {{ $t("inspection_documents_required") }}
                </h2>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  {{ $t("inspection_review_documents_copy") }}
                </p>
              </div>
            </div>
            <div class="review-document-list">
              <div
                v-for="type in requiredDocumentTypes"
                :key="type"
                class="review-document-row"
              >
                <v-icon color="primary" :icon="documentIcon(type)" size="21" />
                <div class="flex-grow-1 min-width-0">
                  <strong class="text-body-2">{{
                    $t(documentTitleKeys[type])
                  }}</strong><span
                    v-if="currentDocument(type)"
                    class="text-caption text-medium-emphasis text-truncate"
                  >{{ currentDocument(type)?.originalFileName }}</span><span v-else class="text-caption text-error">{{
                    $t("inspection_document_not_uploaded")
                  }}</span>
                </div>
                <v-chip
                  v-if="currentDocument(type)"
                  :color="documentStatusColor(currentDocument(type)!.status)"
                  size="x-small"
                  variant="tonal"
                >{{
                  documentStatusText(currentDocument(type)!.status)
                }}</v-chip>
                <v-btn
                  v-if="currentDocument(type)"
                  :aria-label="$t('inspection_review_view_document')"
                  icon="mdi-eye-outline"
                  :loading="viewingDocumentId === currentDocument(type)?.id"
                  size="small"
                  variant="text"
                  @click="viewDocument(currentDocument(type)!)"
                />
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
                <h2 class="text-h6 font-weight-bold mb-1">
                  {{ $t("inspection_review_estimated_fee_title") }}
                </h2>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  {{ $t("inspection_review_fee_copy") }}
                </p>
              </div>
            </div>
            <template v-if="feeEstimate">
              <div class="review-fee-row">
                <span>{{ $t("inspection_scheduling_inspection_fee") }}</span><strong>{{
                  formatCurrency(
                    feeEstimate.inspectionFeeKhr,
                    feeEstimate.currency,
                  )
                }}</strong>
              </div>
              <div class="review-fee-row">
                <span>{{ $t("inspection_scheduling_service_fee") }}</span><strong>{{
                  formatCurrency(
                    feeEstimate.serviceFeeKhr,
                    feeEstimate.currency,
                  )
                }}</strong>
              </div>
              <div class="review-fee-row">
                <span>{{ $t("inspection_scheduling_late_fee") }}</span><strong :class="hasLateFee ? 'text-error' : ''">{{
                  formatCurrency(feeEstimate.lateFee, feeEstimate.currency)
                }}</strong>
              </div>
              <div class="review-fee-row review-fee-row--total">
                <span>{{ $t("inspection_scheduling_estimated_total") }}</span><strong>{{
                  formatCurrency(feeEstimate.totalAmount, feeEstimate.currency)
                }}</strong>
              </div>
            </template>
            <p v-else class="text-body-2 text-medium-emphasis mb-0">
              {{ $t("inspection_scheduling_fee_unavailable") }}
            </p>
          </v-card>

          <div class="d-flex justify-space-between mt-6">
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
              <p class="text-caption text-medium-emphasis mt-2 mb-0">
                {{ $t("inspection_review_continue_payment_copy") }}
              </p>
            </div>
          </div>
        </v-col>

        <v-col cols="12" md="4">
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
            <v-card
              border
              class="review-card review-ready-card pa-5"
              elevation="0"
              rounded="xl"
            ><div class="d-flex align-center ga-3 mb-4">
               <v-avatar color="primary" size="38" variant="tonal"><v-icon icon="mdi-check-circle-outline" /></v-avatar>
               <h2 class="text-subtitle-1 font-weight-bold">
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
                  <h2 class="text-subtitle-1 font-weight-bold">
                    {{ $t("inspection_review_schedule_title") }}
                  </h2>
                </div>
                <v-btn
                  color="primary"
                  size="small"
                  variant="text"
                  @click="goToScheduling"
                >{{ $t("inspection_review_change_schedule") }}</v-btn>
              </div>
              <template v-if="application.preferredInspectionDate">
                <template v-if="station">
                  <p class="text-body-2 font-weight-medium mb-1">
                    {{ stationName(station) }}
                  </p>
                  <p class="text-body-2 text-medium-emphasis mb-2">
                    {{ station.province }} · {{ station.address }}
                  </p>
                </template>
                <template v-else>
                  <p class="text-body-2 font-weight-medium mb-1">
                    {{ $t('inspection_scheduling_no_station_preference') }}
                  </p>
                  <p class="text-body-2 text-medium-emphasis mb-2">
                    {{ $t('inspection_scheduling_no_station_preference_hint') }}
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
          </aside>
        </v-col>
      </v-row>

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
.renewal-breadcrumbs :deep(.renewal-breadcrumbs__current) {
  background: #e9ebf8;
  border-radius: 999px;
  color: #2a3472;
  font-weight: 700;
  padding: 4px 10px;
}
.renewal-stepper {
  background: #fff;
  border: 1px solid #e3e5eb;
  border-radius: 14px;
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
  font-size: 0.78rem;
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
.renewal-stepper__step.is-complete {
  color: #7c8190;
  font-weight: 500;
}
.renewal-stepper__step.is-active .renewal-stepper__label {
  font-size: 0.95rem;
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
  background: #f8f9fb;
  border: 1px solid #e4e6ec;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 11px 13px;
}
.review-info-grid span {
  color: #787e8d;
  font-size: 0.76rem;
}
.review-info-grid strong {
  color: #242834;
  font-size: 0.91rem;
  overflow-wrap: anywhere;
}
.review-document-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.review-document-row {
  align-items: center;
  background: #fafaff;
  border: 1px solid #ececf4;
  border-radius: 9px;
  display: flex;
  gap: 11px;
  min-height: 52px;
  padding: 9px 10px;
}
.review-document-row .flex-grow-1 {
  display: flex;
  flex-direction: column;
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
  font-size: 0.84rem;
  gap: 8px;
}
.review-checklist > div.is-ready {
  color: #26783d;
  font-weight: 700;
}
.review-checklist :deep(.v-icon) {
  color: currentColor;
}
.review-schedule-card__date {
  color: #202746;
  font-size: 0.92rem;
  font-weight: 800;
}
.review-submit-action {
  max-width: 310px;
  text-align: right;
}
.renewal-review__sidebar {
  position: sticky;
  top: 24px;
}
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
}
.review-card {
  min-width: 0;
}
@media (max-width: 959px) {
  .renewal-review__sidebar {
    position: static;
  }
}
@media (max-width: 599px) {
  .renewal-review {
    padding-bottom: 24px;
  }
  .renewal-stepper {
    padding: 12px 8px 10px;
  }
  .renewal-stepper__label {
    font-size: 0.72rem;
    line-height: 1.2;
  }
  .review-info-grid {
    grid-template-columns: 1fr;
  }
  .review-submit-action {
    text-align: right;
  }
}
</style>
