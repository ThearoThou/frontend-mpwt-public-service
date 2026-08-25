<script setup lang="ts">
  import type { CurrentUser } from '../../auth/types/auth.types'
  import type { ApplicationDocument, ApplicationDocumentType, CitizenFeeEstimate, RenewalApplication } from '../applications/types/application.types'
  import type { Vehicle } from '../vehicles/types/vehicle.types'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { inspectionAuthService } from '../../auth/services/auth.service'
  import { inspectionApplicationService } from '../applications/services/application.service'
  import { inspectionVehicleService } from '../vehicles/services/vehicle.service'
  import RenewalDocumentUploadCard from './components/RenewalDocumentUploadCard.vue'

  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
  const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const mimeTypeByExtension: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
  }

  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const applicationId = computed(() => typeof route.query.applicationId === 'string' ? route.query.applicationId : '')
  const application = ref<RenewalApplication | null>(null)
  const citizen = ref<CurrentUser | null>(null)
  const vehicle = ref<Vehicle | null>(null)
  const documents = ref<ApplicationDocument[]>([])
  const feeEstimate = ref<CitizenFeeEstimate | null>(null)
  const loading = ref(true)
  const errorMessage = ref('')
  const documentErrors = ref<Partial<Record<ApplicationDocumentType, string>>>({})
  const uploadingDocumentTypes = ref<ApplicationDocumentType[]>([])
  const imagePreviewUrls = ref<Partial<Record<ApplicationDocumentType, string>>>({})
  const documentDefinitions: Array<{ type: ApplicationDocumentType, title: string }> = [
    { type: 'VEHICLE_REGISTRATION_CARD', title: 'inspection_document_vehicle_registration_card' },
    { type: 'PREVIOUS_INSPECTION_CERTIFICATE', title: 'inspection_document_previous_inspection_certificate' },
    { type: 'CITIZEN_ID_CARD', title: 'inspection_document_citizen_id_card' },
  ]

  const currentDocuments = computed(() => documents.value.filter(document => document.isCurrent))
  const canContinue = computed(() => documentDefinitions.every(item => currentDocument(item.type) !== undefined))
  const inspectionState = computed<'expired' | 'expiring' | 'valid'>(() => {
    if ((feeEstimate.value?.lateDays ?? 0) > 0) return 'expired'
    const inspectionExpiryDate = vehicle.value?.inspectionExpiryDate
    if (inspectionExpiryDate === undefined) return 'valid'

    const daysUntilExpiry = Math.ceil((new Date(inspectionExpiryDate).getTime() - Date.now()) / 86_400_000)
    if (daysUntilExpiry < 0) return 'expired'
    if (daysUntilExpiry <= 30) return 'expiring'
    return 'valid'
  })
  const inspectionStateTextClass = computed(() => ({
    expired: 'text-error',
    expiring: 'text-warning',
    valid: 'text-success',
  })[inspectionState.value])

  function currentDocument (type: ApplicationDocumentType): ApplicationDocument | undefined {
    return currentDocuments.value.find(document => document.documentType === type)
  }

  function documentError (type: ApplicationDocumentType): string {
    return documentErrors.value[type] ?? ''
  }

  function isUploading (type: ApplicationDocumentType): boolean {
    return uploadingDocumentTypes.value.includes(type)
  }

  function imagePreviewUrl (type: ApplicationDocumentType): string | null {
    return imagePreviewUrls.value[type] ?? null
  }

  function isImageDocument (document: ApplicationDocument): boolean {
    return document.mimeType === 'image/jpeg' || document.mimeType === 'image/png'
  }

  function releaseImagePreview (type: ApplicationDocumentType) {
    const previewUrl = imagePreviewUrls.value[type]
    if (previewUrl !== undefined) URL.revokeObjectURL(previewUrl)

    const { [type]: _releasedPreview, ...remainingPreviews } = imagePreviewUrls.value
    imagePreviewUrls.value = remainingPreviews
  }

  async function loadImagePreview (document: ApplicationDocument) {
    if (!application.value || !isImageDocument(document)) return

    try {
      const file = await inspectionApplicationService.downloadDocument(application.value.id, document.id)
      const previewUrl = URL.createObjectURL(file)

      if (currentDocument(document.documentType)?.id !== document.id) {
        URL.revokeObjectURL(previewUrl)
        return
      }

      releaseImagePreview(document.documentType)
      imagePreviewUrls.value = { ...imagePreviewUrls.value, [document.documentType]: previewUrl }
    } catch {
      // A missing preview does not block document upload or renewal progress.
    }
  }

  function isValidApplicationId (value: string): boolean {
    return UUID_V4_PATTERN.test(value)
  }

  function validateFile (file: File): string | null {
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    const expectedMimeType = mimeTypeByExtension[extension]

    if (expectedMimeType === undefined || (file.type && file.type !== expectedMimeType)) {
      return 'inspection_document_file_type_invalid'
    }

    if (file.size > MAX_FILE_SIZE_BYTES) return 'inspection_document_file_too_large'

    return null
  }

  function setDocumentError (type: ApplicationDocumentType, message: string) {
    documentErrors.value = { ...documentErrors.value, [type]: message }
  }

  function clearDocumentError (type: ApplicationDocumentType) {
    const { [type]: _clearedError, ...remainingErrors } = documentErrors.value
    documentErrors.value = remainingErrors
  }

  function formatDate (value: string | null): string {
    if (value === null) return '—'

    const [year = '', month = '', day = ''] = value.split('-')

    return `${day}/${month}/${year}`
  }

  function formatPhoneNumber (value: string | null | undefined): string {
    if (!value) return '—'

    const normalized = value.replace(/[\s-]/g, '')
    if (!normalized.startsWith('+855')) return value

    return `0${normalized.slice(4).replace(/^0/, '')}`
  }

  function formatPlateNumber (selectedVehicle: Vehicle): string {
    const displayLabel = selectedVehicle.plateDisplayLabelKh.trim()
    return displayLabel ? `${displayLabel} ${selectedVehicle.plateNumber}` : selectedVehicle.plateNumber
  }

  async function loadFeeEstimate (draftId: string) {
    try {
      feeEstimate.value = await inspectionApplicationService.getFeeEstimate(draftId)
    } catch {
      feeEstimate.value = null
    }
  }

  async function load () {
    if (!isValidApplicationId(applicationId.value)) {
      errorMessage.value = t('inspection_documents_invalid_application_link')
      loading.value = false
      return
    }

    try {
      const draft = await inspectionApplicationService.getById(applicationId.value)

      if (draft.status !== 'DRAFT') {
        errorMessage.value = t('inspection_documents_not_editable')
        return
      }

      application.value = draft

      const [me, selectedVehicle, listedDocuments] = await Promise.all([
        inspectionAuthService.getCurrentUser(),
        inspectionVehicleService.getById(draft.vehicleId),
        inspectionApplicationService.listDocuments(draft.id),
      ])

      citizen.value = me
      vehicle.value = selectedVehicle
      documents.value = listedDocuments.filter(document => document.isCurrent)
      void Promise.all(documents.value.map(document => loadImagePreview(document)))
      void loadFeeEstimate(draft.id)
    } catch {
      errorMessage.value = t('inspection_documents_load_error')
    } finally {
      loading.value = false
    }
  }

  async function upload (type: ApplicationDocumentType, file: File) {
    if (!file || !application.value || isUploading(type)) return

    const validationError = validateFile(file)
    if (validationError !== null) {
      setDocumentError(type, t(validationError))
      return
    }

    clearDocumentError(type)
    uploadingDocumentTypes.value = [...uploadingDocumentTypes.value, type]

    try {
      const document = await inspectionApplicationService.uploadDocument(application.value.id, type, file)
      releaseImagePreview(type)
      documents.value = [
        ...documents.value.filter(item => item.documentType !== type),
        document,
      ]
      void loadImagePreview(document)
    } catch {
      setDocumentError(type, t('inspection_document_upload_error'))
    } finally {
      uploadingDocumentTypes.value = uploadingDocumentTypes.value.filter(item => item !== type)
    }
  }

  async function next () {
    if (!application.value || !canContinue.value) return

    await router.push({
      path: '/services/inspection/renewal/scheduling',
      query: { applicationId: application.value.id },
    })
  }

  onMounted(load)
  onBeforeUnmount(() => {
    for (const type of Object.keys(imagePreviewUrls.value)) {
      releaseImagePreview(type as ApplicationDocumentType)
    }
  })
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <section class="renewal-documents mx-auto">
    <header class="renewal-documents__heading">
      <v-breadcrumbs class="renewal-breadcrumbs px-0 pb-5" density="compact">
        <v-breadcrumbs-item to="/services/inspection/dashboard">{{ $t('inspection_dashboard') }}</v-breadcrumbs-item>
        <v-breadcrumbs-divider icon="mdi-chevron-right" />
        <v-breadcrumbs-item active active-color="primary" class="renewal-breadcrumbs__current">{{ $t('inspection_documents_wizard_documents') }}</v-breadcrumbs-item>
      </v-breadcrumbs>
      <h1 class="text-h5 font-weight-bold mb-2">{{ $t('inspection_documents_title') }}</h1>
      <p class="text-medium-emphasis mb-0">{{ $t('inspection_documents_description') }}</p>
    </header>

    <v-alert v-if="errorMessage" class="mb-5" type="error">{{ errorMessage }}</v-alert>
    <v-progress-linear v-if="loading" color="primary" indeterminate />

    <template v-else-if="application && citizen && vehicle">
      <section :aria-label="$t('inspection_documents_wizard_label')" class="renewal-stepper mb-6">
        <div class="renewal-stepper__track">
          <span class="renewal-stepper__track-active" />
        </div>

        <div class="renewal-stepper__steps">
          <div class="renewal-stepper__step is-active">
            <span class="renewal-stepper__number">1</span>
            <span class="renewal-stepper__label">{{ $t('inspection_documents_wizard_documents') }}</span>
          </div>
          <div class="renewal-stepper__step">
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

      <v-row class="renewal-documents__layout">
        <v-col cols="12" md="8">
          <v-card border class="renewal-info-card mb-5 pa-5 pa-md-6" elevation="0" rounded="xl">
            <div class="d-flex align-center ga-3 mb-5">
              <v-avatar color="primary" size="42" variant="tonal">
                <v-icon icon="mdi-car-info" />
              </v-avatar>
              <div>
                <h2 class="text-h6 font-weight-bold mb-1">{{ $t('inspection_documents_applicant_vehicle') }}</h2>
                <p class="text-body-2 text-medium-emphasis mb-0">{{ $t('inspection_documents_info_helper') }}</p>
              </div>
            </div>

            <div class="renewal-info-card__grid">
              <div class="renewal-info-field">
                <span>{{ $t('inspection_documents_khmer_name') }}</span>
                <strong>{{ citizen.citizenProfile?.nameKh || '—' }}</strong>
              </div>
              <div class="renewal-info-field">
                <span>{{ $t('inspection_documents_plate_number') }}</span>
                <strong>{{ formatPlateNumber(vehicle) }}</strong>
              </div>
              <div class="renewal-info-field">
                <span>{{ $t('inspection_documents_national_id') }}</span>
                <strong>{{ citizen.citizenProfile?.nationalIdNumber || '—' }}</strong>
              </div>
              <div class="renewal-info-field">
                <span>{{ $t('inspection_documents_chassis_number') }}</span>
                <strong>{{ vehicle.chassisNumber }}</strong>
              </div>
              <div class="renewal-info-field">
                <span>{{ $t('inspection_documents_phone_number') }}</span>
                <strong>{{ formatPhoneNumber(citizen.user.phone) }}</strong>
              </div>
              <div class="renewal-info-field">
                <span>{{ $t('inspection_documents_first_registration_date') }}</span>
                <strong>{{ vehicle.firstRegistrationDate }}</strong>
              </div>
            </div>
          </v-card>

          <v-card border class="renewal-inspection-card mb-5 pa-5 pa-md-6" :class="`renewal-inspection-card--${inspectionState}`" elevation="0" rounded="xl">
            <div class="d-flex align-center ga-3 mb-5">
              <v-avatar color="primary" size="42" variant="tonal">
                <v-icon icon="mdi-car-cog" />
              </v-avatar>
              <div>
                <h2 class="text-h6 font-weight-bold mb-1">{{ $t('inspection_documents_inspection_information') }}</h2>
                <p class="text-body-2 text-medium-emphasis mb-0">{{ $t('inspection_documents_inspection_helper') }}</p>
              </div>
            </div>

            <div class="renewal-info-card__grid">
              <div class="renewal-info-field">
                <span>{{ $t('inspection_documents_registration_number') }}</span>
                <strong>{{ vehicle.registrationNumber }}</strong>
              </div>
              <div class="renewal-info-field">
                <span>{{ $t('inspection_documents_last_inspection_date') }}</span>
                <strong>{{ formatDate(vehicle.lastInspectionDate) }}</strong>
              </div>
              <div class="renewal-info-field">
                <span>{{ $t('inspection_documents_inspection_expiry_date') }}</span>
                <strong>{{ formatDate(vehicle.inspectionExpiryDate) }}</strong>
              </div>
              <div class="renewal-info-field">
                <span>{{ $t('inspection_documents_inspection_status') }}</span>
                <strong :class="inspectionStateTextClass">
                  {{ $t(`inspection_dashboard_${inspectionState}`) }}
                </strong>
              </div>
              <div class="renewal-info-field">
                <span>{{ $t('inspection_documents_overdue_days') }}</span>
                <strong :class="feeEstimate?.lateDays ? 'text-error' : ''">{{ feeEstimate?.lateDays ?? '—' }}</strong>
              </div>
              <div class="renewal-info-field">
                <span>{{ $t('inspection_documents_late_fee') }}</span>
                <strong :class="feeEstimate?.lateFee !== '0.00' ? 'text-error' : ''">
                  {{ feeEstimate ? `${feeEstimate.lateFee} ${feeEstimate.currency}` : '—' }}
                </strong>
              </div>
            </div>
          </v-card>

          <v-alert class="mb-5" density="comfortable" type="info" variant="tonal">
            {{ $t('inspection_documents_review_information_notice') }}
          </v-alert>

          <v-card border class="renewal-document-section pa-5 pa-md-6" elevation="0" rounded="xl">
            <div class="mb-5">
              <h2 class="text-h6 font-weight-bold mb-1">{{ $t('inspection_documents_required') }}</h2>
              <p class="text-body-2 text-medium-emphasis mb-0">{{ $t('inspection_document_file_requirements') }}</p>
            </div>

            <div class="d-flex flex-column ga-4">
              <RenewalDocumentUploadCard
                v-for="item in documentDefinitions"
                :key="item.type"
                :document="currentDocument(item.type)"
                :document-type="item.type"
                :error-message="documentError(item.type)"
                :preview-url="imagePreviewUrl(item.type)"
                :title="$t(item.title)"
                :uploading="isUploading(item.type)"
                @file-selected="upload(item.type, $event)"
              />
            </div>
          </v-card>

          <div class="d-flex justify-space-between mt-6">
            <v-btn to="/services/inspection/renewal" variant="outlined">{{ $t('inspection_documents_back') }}</v-btn>
            <v-btn append-icon="mdi-arrow-right" color="primary" :disabled="!canContinue" @click="next">
              {{ $t('inspection_documents_continue') }}
            </v-btn>
          </div>
        </v-col>

        <v-col cols="12" md="4">
          <aside class="d-flex flex-column ga-5">
            <v-card class="renewal-progress-card pa-5 text-white" elevation="0" rounded="xl">
              <p class="text-body-1 font-weight-medium mb-1">{{ $t('inspection_documents_application_progress') }}</p>
              <div class="text-h3 font-weight-bold">25<span class="text-h6">%</span></div>
              <v-progress-linear bg-color="white" class="mt-4" color="white" :model-value="25" rounded />
              <p class="text-body-2 mt-2 mb-0">{{ $t('inspection_documents_step_one_of_four') }}</p>
            </v-card>

            <v-card border class="renewal-help-card pa-5" elevation="0" rounded="xl">
              <div class="d-flex align-start ga-3">
                <v-icon color="primary" icon="mdi-headset" size="30" />
                <div>
                  <h2 class="text-subtitle-1 font-weight-bold mb-1">{{ $t('inspection_documents_need_help') }}</h2>
                  <p class="text-body-2 text-medium-emphasis mb-0">{{ $t('inspection_documents_help_copy') }}</p>
                </div>
              </div>
            </v-card>
          </aside>
        </v-col>
      </v-row>
    </template>
  </section>
</template>

<style scoped>
  .renewal-documents {
    max-width: 1120px;
    padding-bottom: 36px;
  }

  .renewal-documents__heading {
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
    opacity: 1;
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
    background: transparent;
    display: block;
    height: 100%;
    width: 0;
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
    content: '';
    height: 2px;
    left: 50%;
    position: absolute;
    right: -50%;
    top: 13px;
    z-index: 0;
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

  .renewal-info-card__grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .renewal-info-field {
    background: #f8f9fb;
    border: 1px solid #e3e5eb;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-height: 74px;
    padding: 12px 14px;
  }

  .renewal-info-field span {
    color: #7c8190;
    font-size: 0.78rem;
  }

  .renewal-info-field strong {
    color: #303746;
    font-size: 0.95rem;
    overflow-wrap: anywhere;
  }

  .renewal-progress-card {
    background: #2c3678;
  }

  .renewal-inspection-card {
    border-top: 4px solid #ef3838 !important;
  }

  .renewal-inspection-card--expiring {
    border-top-color: #f0a300 !important;
  }

  .renewal-inspection-card--valid {
    border-top-color: #43a047 !important;
  }

  .renewal-progress-card :deep(.v-progress-linear__background) {
    opacity: 0.28;
  }

  .renewal-help-card {
    border-style: dashed !important;
  }

  @media (max-width: 959px) {
    .renewal-documents {
      max-width: 760px;
    }
  }

  @media (max-width: 599px) {
    .renewal-documents {
      padding-bottom: 24px;
    }

    .renewal-stepper {
      padding: 12px 8px 10px;
    }

    .renewal-stepper__track {
      top: 25px;
    }

    .renewal-stepper__number {
      height: 26px;
      width: 26px;
    }

    .renewal-stepper__label {
      font-size: 0.72rem;
      line-height: 1.2;
    }

    .renewal-info-card__grid {
      grid-template-columns: 1fr;
    }
  }
</style>
