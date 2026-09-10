<script setup lang="ts">
  import type { ApplicationDocument, ApplicationDocumentType, ApplicationStatus, RenewalApplicationDetail, RenewalApplicationVehicleSnapshot } from './types/application.types'
  import { isAxiosError } from 'axios'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import TechnicalInspectionCertificateCard from './components/TechnicalInspectionCertificateCard.vue'
  import { inspectionApplicationService } from './services/application.service'

  type DetailsTab = 'progress' | 'documents' | 'invoice'
  type ApiErrorResponse = { code?: string, message?: string }

  const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
  const DETAILS_TABS: Set<DetailsTab> = new Set(['progress', 'documents', 'invoice'])
  const DOCUMENT_TYPES: ApplicationDocumentType[] = ['VEHICLE_REGISTRATION_CARD', 'PREVIOUS_INSPECTION_CERTIFICATE', 'CITIZEN_ID_CARD']
  const MIME_TYPE_BY_EXTENSION: Record<string, string> = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }

  const route = useRoute()
  const router = useRouter()
  const { locale, t } = useI18n()
  const application = ref<RenewalApplicationDetail | null>(null)
  const documents = ref<ApplicationDocument[]>([])
  const activeTab = ref<DetailsTab>(tabFromRoute(route.query.tab))
  const initialLoading = ref(true)
  const refreshing = ref(false)
  const loadError = ref(false)
  const pageMessageKey = ref('')
  const pageMessageType = ref<'error' | 'success'>('error')
  const uploadingTypes = ref<ApplicationDocumentType[]>([])
  const viewingDocumentId = ref<string | null>(null)
  const downloadingDocumentId = ref<string | null>(null)
  const previewDocument = ref<ApplicationDocument | null>(null)
  const previewUrl = ref<string | null>(null)
  const previewDialogVisible = ref(false)
  const uploadedReplacementTypes = ref<ApplicationDocumentType[]>([])
  const documentErrorKeys = ref<Partial<Record<ApplicationDocumentType, string>>>({})
  const resubmitting = ref(false)
  const renewing = ref(false)

  const applicationId = computed(() => {
    const id = (route.params as Record<string, string | string[]>).id
    return typeof id === 'string' ? id : ''
  })
  const isCorrectionRequired = computed(() => application.value?.status === 'CORRECTION_REQUIRED')
  const currentDocuments = computed(() => documents.value.filter(document => document.isCurrent))
  const remainingRejectedDocuments = computed(() => currentDocuments.value.filter(document => document.status === 'REJECTED'))
  const canResubmit = computed(() => isCorrectionRequired.value && currentDocuments.value.length > 0 && remainingRejectedDocuments.value.length === 0)
  const previewIsPdf = computed(() => previewDocument.value?.mimeType === 'application/pdf')
  const headerMakeModel = computed(() => application.value?.vehicleSnapshot ? vehicleMakeModel(application.value.vehicleSnapshot) : '—')
  const headerPlate = computed(() => application.value?.vehicleSnapshot ? formattedPlate(application.value.vehicleSnapshot) : '—')

  watch(() => route.query.tab, value => {
    activeTab.value = tabFromRoute(value)
  })

  function tabFromRoute (value: unknown): DetailsTab {
    return typeof value === 'string' && DETAILS_TABS.has(value as DetailsTab) ? value as DetailsTab : 'progress'
  }

  async function changeTab (value: unknown) {
    const tab = tabFromRoute(value)
    activeTab.value = tab
    await router.replace({ query: { ...route.query, tab } })
  }

  function documentFor (type: ApplicationDocumentType) {
    return currentDocuments.value.find(document => document.documentType === type)
  }

  function documentTitleKey (type: ApplicationDocumentType): string {
    return { VEHICLE_REGISTRATION_CARD: 'inspection_document_vehicle_registration_card', PREVIOUS_INSPECTION_CERTIFICATE: 'inspection_document_previous_inspection_certificate', CITIZEN_ID_CARD: 'inspection_document_citizen_id_card' }[type]
  }

  function documentStatusKey (status: ApplicationDocument['status']): string {
    return { APPROVED: 'inspection_application_document_status_approved', PENDING: 'inspection_application_document_status_pending', REJECTED: 'inspection_application_document_status_rejected' }[status]
  }

  function documentStatusColor (status: ApplicationDocument['status']): string {
    return { APPROVED: 'success', PENDING: 'info', REJECTED: 'error' }[status]
  }

  function applicationStatusKey (status: ApplicationStatus): string {
    return {
      DRAFT: 'inspection_application_status_draft', SUBMITTED: 'inspection_application_status_under_review', UNDER_REVIEW: 'inspection_application_status_under_review', CORRECTION_REQUIRED: 'inspection_application_status_correction_required', APPOINTMENT_SELECTION_REQUIRED: 'inspection_application_status_appointment_selection_required', APPROVED: 'inspection_application_status_approved', REJECTED: 'inspection_application_status_rejected', REINSPECTION_REQUIRED: 'inspection_application_status_reinspection_required', INSPECTION_FAILED: 'inspection_application_status_inspection_failed', EXPIRED: 'inspection_application_status_expired', CANCELLED: 'inspection_application_status_cancelled', COMPLETED: 'inspection_application_status_completed',
    }[status]
  }

  function applicationStatusColor (status: ApplicationStatus): string {
    if (status === 'COMPLETED' || status === 'APPROVED') return 'success'
    if (status === 'CORRECTION_REQUIRED') return 'warning'
    if (['REJECTED', 'INSPECTION_FAILED', 'EXPIRED'].includes(status)) return 'error'
    return 'info'
  }

  function applicationStatusIcon (status: ApplicationStatus): string {
    if (status === 'COMPLETED' || status === 'APPROVED') return 'mdi-check-circle-outline'
    if (status === 'CORRECTION_REQUIRED') return 'mdi-alert-circle-outline'
    if (['REJECTED', 'INSPECTION_FAILED', 'EXPIRED'].includes(status)) return 'mdi-close-circle-outline'
    return 'mdi-progress-clock'
  }

  function formatDate (value: string | null): string {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.valueOf())) return '—'
    return new Intl.DateTimeFormat(locale.value === 'kh' ? 'km-KH' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Phnom_Penh' }).format(date)
  }

  function snapshotValue (value: string | number | null): string {
    return value ? String(value) : '—'
  }

  function vehicleMakeModel (vehicle: RenewalApplicationVehicleSnapshot): string {
    return [vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'
  }

  function formattedPlate (vehicle: RenewalApplicationVehicleSnapshot): string {
    const plateNumber = vehicle.plateNumber?.trim() ?? ''
    let plateLabel = vehicle.plateProvince?.trim() ?? ''

    if (vehicle.plateCategory === 'PERSONALIZED_CAMBODIA') plateLabel = t('inspection_plate_cambodia')
    else if (plateLabel === 'ភ្នំពេញ' || plateLabel.toLowerCase() === 'phnom penh') plateLabel = t('inspection_plate_phnom_penh')

    return [plateLabel, plateNumber].filter(Boolean).join(' ') || '—'
  }

  function engineDisplacement (value: number | null | undefined): string {
    return value ? `${value} cc` : '—'
  }

  function documentMetadata (documentItem: ApplicationDocument): string {
    return documentItem.originalFileName
  }

  async function load () {
    if (!UUID_V4_PATTERN.test(applicationId.value)) {
      loadError.value = true
      initialLoading.value = false
      return
    }
    loadError.value = false
    try {
      const [loadedApplication, loadedDocuments] = await Promise.all([inspectionApplicationService.getById(applicationId.value), inspectionApplicationService.listDocuments(applicationId.value)])
      application.value = loadedApplication
      documents.value = loadedDocuments
    } catch {
      loadError.value = true
    } finally {
      initialLoading.value = false
      refreshing.value = false
    }
  }

  async function retry () {
    if (refreshing.value) return
    refreshing.value = true
    await load()
  }

  function validationErrorKey (file: File): string | null {
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    const expectedMimeType = MIME_TYPE_BY_EXTENSION[extension]
    if (expectedMimeType === undefined || (file.type && file.type !== expectedMimeType)) return 'inspection_document_file_type_invalid'
    if (file.size > MAX_FILE_SIZE_BYTES) return 'inspection_document_file_too_large'
    return null
  }

  function replacementInputId (type: ApplicationDocumentType) {
    return `correction-replacement-${type.toLowerCase()}`
  }

  function chooseReplacement (type: ApplicationDocumentType) {
    if (!uploadingTypes.value.includes(type)) document.querySelector<HTMLElement>(`#${replacementInputId(type)}`)?.click()
  }

  async function replacementSelected (type: ApplicationDocumentType, event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file) await uploadReplacement(type, file)
  }

  async function uploadReplacement (type: ApplicationDocumentType, file: File) {
    const current = documentFor(type)
    if (!isCorrectionRequired.value || current?.status !== 'REJECTED' || uploadingTypes.value.includes(type)) return
    const validationKey = validationErrorKey(file)
    if (validationKey) {
      documentErrorKeys.value = { ...documentErrorKeys.value, [type]: validationKey }
      return
    }
    uploadingTypes.value = [...uploadingTypes.value, type]
    documentErrorKeys.value = { ...documentErrorKeys.value, [type]: undefined }
    try {
      await inspectionApplicationService.uploadDocument(applicationId.value, type, file)
      documents.value = await inspectionApplicationService.listDocuments(applicationId.value)
      uploadedReplacementTypes.value = [...new Set([...uploadedReplacementTypes.value, type])]
    } catch (error) {
      if (!await refreshIfExpired(error)) documentErrorKeys.value = { ...documentErrorKeys.value, [type]: 'inspection_application_correction_upload_error' }
    } finally {
      uploadingTypes.value = uploadingTypes.value.filter(value => value !== type)
    }
  }

  async function downloadDocument (documentItem: ApplicationDocument) {
    if (downloadingDocumentId.value !== null) return
    downloadingDocumentId.value = documentItem.id
    documentErrorKeys.value = { ...documentErrorKeys.value, [documentItem.documentType]: undefined }
    try {
      const blob = await inspectionApplicationService.downloadDocument(applicationId.value, documentItem.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = documentItem.originalFileName
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      documentErrorKeys.value = { ...documentErrorKeys.value, [documentItem.documentType]: 'inspection_application_document_download_error' }
    } finally {
      downloadingDocumentId.value = null
    }
  }

  async function viewDocument (documentItem: ApplicationDocument) {
    if (viewingDocumentId.value !== null) return
    viewingDocumentId.value = documentItem.id
    documentErrorKeys.value = { ...documentErrorKeys.value, [documentItem.documentType]: undefined }
    try {
      const blob = await inspectionApplicationService.downloadDocument(applicationId.value, documentItem.id)
      closeDocumentPreview()
      previewDocument.value = documentItem
      previewUrl.value = URL.createObjectURL(new Blob([blob], { type: documentItem.mimeType }))
      previewDialogVisible.value = true
    } catch {
      documentErrorKeys.value = { ...documentErrorKeys.value, [documentItem.documentType]: 'inspection_application_document_view_error' }
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

  async function resubmit () {
    if (!application.value || !canResubmit.value || resubmitting.value) return
    resubmitting.value = true
    pageMessageKey.value = ''
    try {
      await inspectionApplicationService.resubmit(application.value.id)
      application.value = await inspectionApplicationService.getById(application.value.id)
      documents.value = await inspectionApplicationService.listDocuments(application.value.id)
      pageMessageType.value = 'success'
      pageMessageKey.value = 'inspection_application_correction_resubmitted'
      await changeTab('progress')
    } catch (error) {
      if (!await refreshIfExpired(error)) {
        pageMessageType.value = 'error'
        pageMessageKey.value = resubmitErrorKey(error)
      }
    } finally {
      resubmitting.value = false
    }
  }

  async function refreshIfExpired (error: unknown): Promise<boolean> {
    if (!isExpiryError(error)) return false
    try {
      const [refreshedApplication, refreshedDocuments] = await Promise.all([inspectionApplicationService.getById(applicationId.value), inspectionApplicationService.listDocuments(applicationId.value)])
      application.value = refreshedApplication
      documents.value = refreshedDocuments
      if (refreshedApplication.status === 'EXPIRED') {
        pageMessageType.value = 'error'
        pageMessageKey.value = 'inspection_application_correction_expired'
        return true
      }
    } catch { /* Preserve the mutation error if refresh fails. */ }
    return false
  }

  function isExpiryError (error: unknown): boolean {
    return isAxiosError<ApiErrorResponse>(error) && error.response?.data?.code === 'APPLICATION_INVALID_TRANSITION' && error.response.data.message?.toLowerCase().includes('expired') === true
  }

  function resubmitErrorKey (error: unknown): string {
    return isAxiosError<ApiErrorResponse>(error) && error.response?.data?.code === 'REQUIRED_DOCUMENTS_NOT_READY' ? 'inspection_application_correction_documents_remaining' : 'inspection_application_correction_resubmit_error'
  }

  async function renewAgain () {
    if (application.value?.status !== 'EXPIRED' || renewing.value) return
    renewing.value = true
    pageMessageKey.value = ''
    try {
      const draft = await inspectionApplicationService.renewAgain(application.value.id)
      await router.push({ path: '/services/inspection/renewal/documents', query: { applicationId: draft.id } })
    } catch {
      pageMessageType.value = 'error'
      pageMessageKey.value = 'inspection_draft_creation_error'
    } finally {
      renewing.value = false
    }
  }

  onMounted(() => {
    void load()
  })

  onBeforeUnmount(closeDocumentPreview)
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <section class="application-details citizen-auth-type-scale mx-auto">
    <div class="application-details__topline"><v-breadcrumbs class="application-details__breadcrumbs px-0" density="compact"><v-breadcrumbs-item to="/services/inspection/applications">{{ $t('inspection_my_applications') }}</v-breadcrumbs-item><v-breadcrumbs-divider icon="mdi-chevron-right" /><v-breadcrumbs-item active active-color="primary" class="application-details__breadcrumbs-current">{{ application?.referenceNumber ?? '—' }}</v-breadcrumbs-item></v-breadcrumbs><v-btn class="application-details__back" prepend-icon="mdi-arrow-left" to="/services/inspection/applications" variant="text">{{ $t('inspection_application_details_back') }}</v-btn></div>
    <div v-if="initialLoading" class="application-details__loading"><v-progress-circular color="primary" indeterminate /><span>{{ $t('loading') }}</span></div>
    <v-alert v-else-if="loadError" type="error" variant="tonal"><div class="d-flex flex-wrap align-center justify-space-between ga-3"><span>{{ $t('inspection_application_details_load_error') }}</span><v-btn :loading="refreshing" variant="outlined" @click="retry">{{ $t('retry') }}</v-btn></div></v-alert>
    <template v-else-if="application">
      <header class="application-details__header"><div class="application-details__heading-copy"><h1>{{ $t('inspection_application_details_title') }}</h1><p class="application-details__reference"><span>{{ $t('inspection_application_details_reference') }}</span>{{ application.referenceNumber ?? '—' }}</p><div class="application-details__metadata"><span><v-icon icon="mdi-card-text-outline" size="17" />{{ headerPlate }}</span><span><v-icon icon="mdi-car-outline" size="17" />{{ headerMakeModel }}</span><span><v-icon icon="mdi-calendar-blank-outline" size="17" />{{ $t('inspection_application_details_submitted') }}: {{ formatDate(application.submittedAt) }}</span></div></div><v-chip class="application-details__status" :color="applicationStatusColor(application.status)" :prepend-icon="applicationStatusIcon(application.status)" size="small" variant="tonal">{{ $t(applicationStatusKey(application.status)) }}</v-chip></header>
      <v-alert v-if="pageMessageKey" class="mb-5" :type="pageMessageType" variant="tonal">{{ $t(pageMessageKey) }}</v-alert>
      <v-alert v-if="application.status === 'EXPIRED'" class="mb-5" icon="mdi-calendar-remove-outline" type="error" variant="tonal"><div class="d-flex flex-wrap align-center justify-space-between ga-3"><div><strong>{{ $t('inspection_application_correction_application_expired') }}</strong><p class="mb-0 mt-1">{{ $t('inspection_application_correction_expired_description') }}</p></div><v-btn color="error" :loading="renewing" variant="outlined" @click="renewAgain">{{ $t('inspection_renewal_renew_again') }}</v-btn></div></v-alert>
      <v-card class="application-details__content" elevation="0">
        <div :class="['application-details__tabs', `application-details__tabs--${activeTab}`]"><v-tabs color="primary" :model-value="activeTab" show-arrows @update:model-value="changeTab"><v-tab :class="{ 'application-details__tab--active': activeTab === 'progress' }" value="progress">{{ $t('inspection_application_details_tab_progress') }}</v-tab><v-tab :class="{ 'application-details__tab--active': activeTab === 'documents' }" value="documents">{{ $t('inspection_application_details_tab_documents') }}</v-tab><v-tab :class="{ 'application-details__tab--active': activeTab === 'invoice' }" value="invoice">{{ $t('inspection_application_details_tab_invoice') }}</v-tab></v-tabs><span aria-hidden="true" class="application-details__active-tab-bar" /></div><v-divider />
        <v-window :model-value="activeTab">
          <v-window-item value="progress"><div class="application-details__panel"><div class="application-details__placeholder application-details__placeholder--progress"><v-icon color="primary" icon="mdi-progress-clock" size="38" /><h2>{{ $t('inspection_application_details_tab_progress') }}</h2><p>{{ $t('inspection_application_details_progress_deferred') }}</p></div><TechnicalInspectionCertificateCard :application-id="application.id" /></div></v-window-item>
          <v-window-item value="documents"><div class="application-details__panel">
            <v-alert v-if="isCorrectionRequired" class="mb-6" icon="mdi-file-alert-outline" type="warning" variant="tonal"><h2 class="text-subtitle-1 font-weight-bold mb-1">{{ $t('inspection_application_correction_banner_title') }}</h2><p class="mb-1">{{ $t('inspection_application_correction_banner_description') }}</p><p class="mb-0 text-caption">{{ $t('inspection_application_correction_same_application_notice') }}</p></v-alert>
            <section class="vehicle-section mb-8"><h2 class="application-details__section-title">{{ $t('inspection_application_details_vehicle_section_title') }}</h2><div v-if="application.vehicleSnapshot" class="vehicle-card-grid">
              <article aria-labelledby="vehicle-information-heading" class="vehicle-info-card"><h3 id="vehicle-information-heading" class="vehicle-info-card__title"><v-icon icon="mdi-car-outline" size="24" />{{ $t('inspection_application_details_vehicle_title') }}</h3><dl class="vehicle-info-list"><div><dt>{{ $t('inspection_plate_number') }}</dt><dd>{{ formattedPlate(application.vehicleSnapshot) }}</dd></div><div><dt>{{ $t('inspection_vehicle_type') }}</dt><dd>{{ snapshotValue(application.vehicleSnapshot.vehicleType) }}</dd></div><div><dt>{{ $t('inspection_make_and_model') }}</dt><dd>{{ vehicleMakeModel(application.vehicleSnapshot) }}</dd></div><div><dt>{{ $t('inspection_manufacture_year') }}</dt><dd>{{ snapshotValue(application.vehicleSnapshot.manufactureYear) }}</dd></div><div><dt>{{ $t('inspection_colour') }}</dt><dd>{{ snapshotValue(application.vehicleSnapshot.colour ?? null) }}</dd></div></dl></article>
              <article aria-labelledby="technical-information-heading" class="vehicle-info-card"><h3 id="technical-information-heading" class="vehicle-info-card__title"><v-icon icon="mdi-cog-outline" size="24" />{{ $t('inspection_application_details_technical_title') }}</h3><dl class="vehicle-info-list"><div><dt>{{ $t('inspection_engine_number') }}</dt><dd>{{ snapshotValue(application.vehicleSnapshot.engineNumber ?? null) }}</dd></div><div><dt>{{ $t('inspection_chassis_number') }}</dt><dd>{{ snapshotValue(application.vehicleSnapshot.chassisNumber) }}</dd></div><div><dt>{{ $t('inspection_engine_displacement') }}</dt><dd>{{ engineDisplacement(application.vehicleSnapshot.engineDisplacementCc) }}</dd></div><div><dt>{{ $t('inspection_engine_power') }}</dt><dd>{{ snapshotValue(application.vehicleSnapshot.enginePowerHp ?? null) }}</dd></div><div><dt>{{ $t('inspection_fuel_type') }}</dt><dd>{{ snapshotValue(application.vehicleSnapshot.fuelType ?? null) }}</dd></div></dl></article>
            </div><p v-else class="text-medium-emphasis">{{ $t('inspection_application_details_vehicle_unavailable') }}</p></section>
            <section><div class="application-details__documents-heading"><div><h2 class="application-details__section-title mb-1">{{ $t('inspection_application_details_documents_title') }}</h2><p v-if="isCorrectionRequired" class="text-medium-emphasis mb-0">{{ $t('inspection_application_correction_documents_description') }}</p></div><v-chip v-if="isCorrectionRequired" color="warning" variant="tonal">{{ remainingRejectedDocuments.length }} {{ $t('inspection_application_correction_remaining') }}</v-chip></div>
              <div class="document-list"><article v-for="type in DOCUMENT_TYPES" :key="type" class="document-row" :class="{ 'document-row--rejected': documentFor(type)?.status === 'REJECTED' }"><template v-if="documentFor(type)"><div class="document-row__main"><div aria-hidden="true" class="document-row__icon"><v-icon :icon="documentFor(type)!.mimeType === 'application/pdf' ? 'mdi-file-pdf-box' : 'mdi-file-image-outline'" /></div><div class="document-row__copy"><h3>{{ $t(documentTitleKey(type)) }}</h3><p>{{ documentMetadata(documentFor(type)!) }}</p></div></div><v-chip class="document-row__status" :color="documentStatusColor(documentFor(type)!.status)" size="small" variant="tonal">{{ $t(documentStatusKey(documentFor(type)!.status)) }}</v-chip><div class="document-row__actions"><v-btn :aria-label="$t('inspection_application_document_view_accessible', { document: $t(documentTitleKey(type)) })" class="document-row__view-button" icon="mdi-eye-outline" :loading="viewingDocumentId === documentFor(type)!.id" size="small" variant="text" @click="viewDocument(documentFor(type)!)" /><v-btn :aria-label="$t('inspection_application_document_download_accessible', { document: $t(documentTitleKey(type)) })" class="document-row__download-button" :loading="downloadingDocumentId === documentFor(type)!.id" prepend-icon="mdi-download-outline" size="small" variant="outlined" @click="downloadDocument(documentFor(type)!)">{{ $t('inspection_application_document_download_pdf') }}</v-btn></div>
                <v-alert v-if="documentFor(type)!.status === 'REJECTED'" class="mb-4" density="compact" type="error" variant="tonal"><strong>{{ $t('inspection_application_correction_rejection_reason') }}</strong><p class="mb-0 mt-1">{{ documentFor(type)!.rejectionReason ?? $t('inspection_application_correction_reason_unavailable') }}</p></v-alert>
                <v-alert v-if="uploadedReplacementTypes.includes(type) && documentFor(type)!.status === 'PENDING'" class="mb-4" density="compact" type="success" variant="tonal">{{ $t('inspection_application_correction_replacement_uploaded') }}</v-alert>
                <v-alert v-if="documentErrorKeys[type]" class="mb-4" density="compact" type="error" variant="tonal">{{ $t(documentErrorKeys[type]!) }}</v-alert>
                <div v-if="isCorrectionRequired && documentFor(type)!.status === 'REJECTED'" class="document-row__correction-action"><v-btn color="primary" :loading="uploadingTypes.includes(type)" prepend-icon="mdi-upload-outline" @click="chooseReplacement(type)">{{ $t('inspection_application_correction_upload') }}</v-btn></div><input :id="replacementInputId(type)" accept=".pdf,.jpg,.jpeg,.png" class="d-none" :disabled="uploadingTypes.includes(type)" type="file" @change="replacementSelected(type, $event)"></template><p v-else class="text-medium-emphasis mb-0">{{ $t('inspection_application_document_missing') }}</p></article></div>
              <div v-if="isCorrectionRequired" class="correction-submit"><div><strong>{{ $t('inspection_application_correction_resubmit_title') }}</strong><p class="mb-0 text-medium-emphasis">{{ canResubmit ? $t('inspection_application_correction_ready') : $t('inspection_application_correction_documents_remaining') }}</p></div><v-btn color="primary" :disabled="!canResubmit || uploadingTypes.length > 0" :loading="resubmitting" @click="resubmit">{{ $t('inspection_application_correction_resubmit') }}</v-btn></div>
            </section>
          </div></v-window-item>
          <v-window-item value="invoice"><div class="application-details__placeholder"><v-icon color="primary" icon="mdi-receipt-text-outline" size="38" /><h2>{{ $t('inspection_application_details_tab_invoice') }}</h2><p>{{ $t('inspection_application_details_invoice_deferred') }}</p></div></v-window-item>
        </v-window>
      </v-card>
      <v-dialog max-width="1000" :model-value="previewDialogVisible" @update:model-value="updatePreviewDialog"><v-card class="application-document-preview-card"><div class="application-document-preview__header"><p>{{ previewDocument?.originalFileName }}</p><v-btn :aria-label="$t('inspection_document_close_preview')" icon="mdi-close" variant="text" @click="closeDocumentPreview" /></div><div v-if="previewUrl" class="application-document-preview"><iframe v-if="previewIsPdf" class="application-document-preview__pdf" :src="previewUrl" :title="previewDocument?.originalFileName" /><v-img v-else :alt="previewDocument?.originalFileName" class="application-document-preview__image" contain :src="previewUrl" /></div></v-card></v-dialog>
    </template>
  </section>
</template>

<style scoped>
  .application-details { max-width: 1120px; padding-bottom: 36px; }
  .application-details__topline { align-items: center; display: flex; justify-content: space-between; min-height: 32px; }
  .application-details__breadcrumbs :deep(.v-breadcrumbs-item--link) { color: #697080; }
  .application-details__breadcrumbs :deep(.application-details__breadcrumbs-current) { background: #d8def8; border-radius: 999px; color: #2a3472; font-weight: 700; padding: 4px 10px; }
  .application-details__back { color: #2a3472; font-weight: 700; }
  .application-details__loading { align-items: center; display: flex; flex-direction: column; gap: 14px; justify-content: center; min-height: 360px; }
  .application-details__header { align-items: flex-start; background: linear-gradient(125deg, #fff 0%, #f8f9ff 66%, #f1f4ff 100%); border: 1px solid #dde3f2; border-left: 4px solid #2a3d80; border-radius: 14px; box-shadow: 0 8px 22px rgba(26, 39, 87, .055); display: flex; gap: 28px; justify-content: space-between; margin: 12px 0 24px; min-height: 0; overflow: hidden; padding: 20px 26px; position: relative; }
  .application-details__header::after { background: radial-gradient(circle, rgba(104, 128, 205, .12), rgba(104, 128, 205, 0) 68%); border-radius: 50%; content: ''; height: 210px; pointer-events: none; position: absolute; right: -70px; top: -105px; width: 210px; }
  .application-details__header > * { position: relative; z-index: 1; }
  .application-details__heading-copy { min-width: 0; }
  .application-details__header h1 { color: #102652; font-size: clamp(1.55rem, 2.2vw, 2rem); font-weight: 800; letter-spacing: -.01em; line-height: 1.2; }
  .application-details__reference { color: #26366d; font-size: .88rem; font-weight: 700; margin: 7px 0 0; overflow-wrap: anywhere; }
  .application-details__reference span { color: #68718a; font-weight: 500; margin-inline-end: 8px; }
  .application-details__metadata { align-items: center; color: #4f5669; display: flex; flex-wrap: wrap; font-size: .8rem; gap: 8px; margin-top: 13px; }
  .application-details__metadata span { align-items: center; background: rgba(255, 255, 255, .78); border: 1px solid #e0e5f2; border-radius: 8px; box-shadow: 0 2px 6px rgba(37, 49, 94, .03); display: inline-flex; gap: 6px; min-height: 30px; padding: 4px 9px; }
  .application-details__metadata :deep(.v-icon) { color: #42558f; }
  .application-details__status { box-shadow: 0 5px 14px rgba(32, 38, 71, .09); flex: 0 0 auto; font-weight: 800; margin-top: 4px; }
  .application-details__content { background: #fff; border: 1px solid #dfe3ec; border-radius: 14px; box-shadow: 0 12px 32px rgba(25, 35, 71, .045); overflow: hidden; }
  .application-details__tabs { background: #f8f8fb; position: relative; }
  .application-details__content :deep(.v-tabs) { background: transparent; }
  .application-details__content :deep(.v-tab) { color: #5e6370; flex: 1 1 0; font-size: 1.05rem; font-weight: 600; min-height: 68px; padding-bottom: 9px; position: relative; }
  .application-details__content :deep(.v-tab--selected),
  .application-details__content :deep(.application-details__tab--active) { background: #fff; color: #263575; font-weight: 600; }
  .application-details__content :deep(.v-tab__slider) { display: none !important; }
  .application-details__active-tab-bar { background: #2a3d80; bottom: 0; height: 3px; left: 0; pointer-events: none; position: absolute; transform: translateX(0); transition: transform .2s ease; width: 33.333333%; z-index: 3; }
  .application-details__tabs--documents .application-details__active-tab-bar { transform: translateX(100%); }
  .application-details__tabs--invoice .application-details__active-tab-bar { transform: translateX(200%); }
  .application-details__panel { padding: 32px 28px 40px; }
  .application-details__placeholder { align-items: center; display: flex; flex-direction: column; justify-content: center; min-height: 280px; padding: 32px; text-align: center; }
  .application-details__placeholder--progress { background: #f7f8fb; border-radius: 14px; min-height: 190px; }
  .application-details__placeholder h2 { font-size: 1.12rem; margin-top: 12px; }
  .application-details__placeholder p { color: #666c7b; margin: 6px 0 0; }
  .application-details__section-title { align-items: center; color: #102652; display: flex; font-size: 1.08rem; font-weight: 800; gap: 9px; margin-bottom: 18px; }
  .application-details__section-title::before { background: linear-gradient(#334b91, #7891dd); border-radius: 999px; content: ''; height: 20px; width: 4px; }
  .vehicle-section { width: 100%; }
  .vehicle-card-grid { align-items: start; display: grid; gap: 20px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-inline: auto; max-width: 800px; }
  .vehicle-info-card { background: linear-gradient(150deg, #fff, #f9faff); border: 1px solid #d7dce9; border-radius: 13px; box-shadow: 0 7px 20px rgba(31, 43, 89, .055); min-width: 0; overflow: hidden; padding: 20px 24px; position: relative; }
  .vehicle-info-card::before { background: linear-gradient(90deg, #2c3f82, #8095d8); content: ''; height: 3px; inset: 0 0 auto; position: absolute; }
  .vehicle-info-card__title { align-items: center; color: #24356f; display: flex; font-size: 1rem; font-weight: 800; gap: 9px; margin-bottom: 10px; }
  .vehicle-info-card__title :deep(.v-icon) { background: #e8edff; border-radius: 9px; height: 34px; padding: 7px; width: 34px; }
  .vehicle-info-list > div { align-items: start; border-top: 1px solid #dcdee5; display: grid; gap: 16px; grid-template-columns: minmax(108px, .85fr) minmax(0, 1.25fr); padding: 12px 0; }
  .vehicle-info-list > div:first-child { border-top: 0; }
  .application-details.citizen-auth-type-scale .vehicle-info-list dt { color: #666b7a; font-size: .85rem !important; }
  .application-details.citizen-auth-type-scale .vehicle-info-list dd { color: #252833; font-size: .95rem !important; font-weight: 650; margin: 0; overflow-wrap: anywhere; }
  .application-details__documents-heading { align-items: center; display: flex; gap: 20px; justify-content: space-between; margin-bottom: 16px; }
  .document-list { display: grid; gap: 12px; }
  .document-row { align-items: center; background: #fff; border: 1px solid #dce0e9; border-radius: 12px; box-shadow: 0 4px 13px rgba(32, 38, 71, .04); display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr) auto auto; min-width: 0; padding: 15px 18px; transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease; }
  .document-row:hover { border-color: #c3cbe1; box-shadow: 0 8px 20px rgba(32, 44, 92, .08); transform: translateY(-1px); }
  .document-row--rejected { background: #fff9f8; border-color: #e9a7a0; }
  .document-row__main { align-items: center; display: flex; gap: 13px; min-width: 0; }
  .document-row__icon { align-items: center; background: linear-gradient(145deg, #e7edff, #d5e0ff); border: 1px solid #ced9fa; border-radius: 10px; color: #334b88; display: flex; flex: 0 0 44px; height: 44px; justify-content: center; width: 44px; }
  .document-row__copy { min-width: 0; }
  .document-row__copy h3 { color: #242936; font-size: .94rem; overflow-wrap: anywhere; }
  .application-details.citizen-auth-type-scale .document-row__copy p { color: #6f7481; font-size: .85rem !important; margin: 3px 0 0; overflow-wrap: anywhere; }
  .application-details.citizen-auth-type-scale .document-row__status { box-shadow: 0 2px 7px rgba(32, 38, 71, .05); font-size: .85rem !important; font-weight: 800; justify-self: start; }
  .document-row__actions { align-items: center; display: flex; gap: 6px; justify-self: end; }
  .document-row__actions :deep(.v-btn) { border-radius: 9px; color: #263575; font-size: .76rem; font-weight: 800; letter-spacing: 0; }
  .document-row__view-button { background: transparent; height: 36px; min-width: 36px; width: 36px; }
  .document-row__view-button:hover { background: #eef2ff; }
  .document-row__download-button { background: #edf1ff; min-height: 36px; padding-inline: 12px; }
  .document-row__download-button { border-color: #9aa9d1; }
  .document-row > .v-alert, .document-row__correction-action { grid-column: 1 / -1; }
  .document-row__correction-action { display: flex; justify-content: flex-end; }
  .correction-submit { align-items: center; background: #f4f5fb; border-radius: 12px; display: flex; gap: 20px; justify-content: space-between; margin-top: 20px; padding: 18px; }
  .application-document-preview__header { align-items: center; display: flex; gap: 12px; justify-content: space-between; padding: 16px; }
  .application-document-preview__header p { font-weight: 700; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .application-document-preview { align-items: center; background: #f5f6fa; display: flex; justify-content: center; min-height: 380px; }
  .application-document-preview__image { background: #16181f; max-height: 72vh; width: 100%; }
  .application-document-preview__pdf { border: 0; display: block; height: 72vh; width: 100%; }

  @media (max-width: 900px) {
    .document-row { align-items: start; grid-template-columns: minmax(0, 1fr) auto; }
    .document-row__actions { grid-column: 1 / -1; justify-self: end; }
  }

  @media (max-width: 759px) {
    .application-details__topline { align-items: flex-start; flex-direction: column; gap: 4px; }
    .application-details__back { align-self: flex-end; }
    .application-details__header { flex-direction: column; gap: 14px; min-height: 0; padding: 20px; }
    .application-details__metadata { margin-top: 12px; }
    .application-details__metadata span { width: 100%; }
    .application-details__content :deep(.v-tab) { min-height: 60px; padding-bottom: 7px; }
    .application-details__panel { padding: 24px 18px 30px; }
    .vehicle-card-grid { grid-template-columns: 1fr; }
    .vehicle-info-card { padding: 18px 20px; }
    .document-row { grid-template-columns: minmax(0, 1fr); }
    .document-row__status, .document-row__actions { grid-column: auto; justify-self: start; }
    .document-row__actions { flex-wrap: wrap; width: 100%; }
    .document-row__actions :deep(.v-btn) { min-height: 42px; }
    .application-details__documents-heading, .correction-submit { align-items: stretch; flex-direction: column; }
    .correction-submit :deep(.v-btn), .document-row__correction-action :deep(.v-btn) { min-height: 44px; width: 100%; }
  }
</style>
