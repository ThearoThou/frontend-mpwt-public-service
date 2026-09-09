<script setup lang="ts">
  import type { ApplicationDocument, ApplicationDocumentType, ApplicationStatus, RenewalApplicationDetail, RenewalApplicationVehicleSnapshot } from './types/application.types'
  import { isAxiosError } from 'axios'
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
  const application = ref<RenewalApplicationDetail | null>(null)
  const documents = ref<ApplicationDocument[]>([])
  const activeTab = ref<DetailsTab>(tabFromRoute(route.query.tab))
  const initialLoading = ref(true)
  const refreshing = ref(false)
  const loadError = ref(false)
  const pageMessageKey = ref('')
  const pageMessageType = ref<'error' | 'success'>('error')
  const uploadingTypes = ref<ApplicationDocumentType[]>([])
  const downloadingDocumentId = ref<string | null>(null)
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

  function formatDate (value: string | null): string {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.valueOf())) return '—'
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Phnom_Penh' }).format(date)
  }

  function snapshotValue (value: string | number | null): string {
    return value === null || value === '' ? '—' : String(value)
  }

  function vehicleMakeModel (vehicle: RenewalApplicationVehicleSnapshot): string {
    return [vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'
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
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <section class="application-details citizen-auth-type-scale mx-auto">
    <v-btn class="mb-4" prepend-icon="mdi-arrow-left" to="/services/inspection/applications" variant="text">{{ $t('inspection_application_details_back') }}</v-btn>
    <div v-if="initialLoading" class="application-details__loading"><v-progress-circular color="primary" indeterminate /><span>{{ $t('loading') }}</span></div>
    <v-alert v-else-if="loadError" type="error" variant="tonal"><div class="d-flex flex-wrap align-center justify-space-between ga-3"><span>{{ $t('inspection_application_details_load_error') }}</span><v-btn :loading="refreshing" variant="outlined" @click="retry">{{ $t('retry') }}</v-btn></div></v-alert>
    <template v-else-if="application">
      <header class="application-details__header"><div><p class="application-details__eyebrow">{{ $t('inspection_application_details_reference') }}</p><h1>{{ application.referenceNumber ?? '—' }}</h1><p>{{ $t('inspection_application_details_submitted') }}: {{ formatDate(application.submittedAt) }}</p></div><v-chip :color="applicationStatusColor(application.status)" size="large" variant="tonal">{{ $t(applicationStatusKey(application.status)) }}</v-chip></header>
      <v-alert v-if="pageMessageKey" class="mb-5" :type="pageMessageType" variant="tonal">{{ $t(pageMessageKey) }}</v-alert>
      <v-alert v-if="application.status === 'EXPIRED'" class="mb-5" icon="mdi-calendar-remove-outline" type="error" variant="tonal"><div class="d-flex flex-wrap align-center justify-space-between ga-3"><div><strong>{{ $t('inspection_application_correction_application_expired') }}</strong><p class="mb-0 mt-1">{{ $t('inspection_application_correction_expired_description') }}</p></div><v-btn color="error" :loading="renewing" variant="outlined" @click="renewAgain">{{ $t('inspection_renewal_renew_again') }}</v-btn></div></v-alert>
      <v-card class="application-details__content" elevation="0">
        <v-tabs :model-value="activeTab" show-arrows @update:model-value="changeTab"><v-tab value="progress">{{ $t('inspection_application_details_tab_progress') }}</v-tab><v-tab value="documents">{{ $t('inspection_application_details_tab_documents') }}</v-tab><v-tab value="invoice">{{ $t('inspection_application_details_tab_invoice') }}</v-tab></v-tabs><v-divider />
        <v-window :model-value="activeTab">
          <v-window-item value="progress"><div class="application-details__panel"><div class="application-details__placeholder application-details__placeholder--progress"><v-icon color="primary" icon="mdi-progress-clock" size="38" /><h2>{{ $t('inspection_application_details_tab_progress') }}</h2><p>{{ $t('inspection_application_details_progress_deferred') }}</p></div><TechnicalInspectionCertificateCard :application-id="application.id" /></div></v-window-item>
          <v-window-item value="documents"><div class="application-details__panel">
            <v-alert v-if="isCorrectionRequired" class="mb-6" icon="mdi-file-alert-outline" type="warning" variant="tonal"><h2 class="text-subtitle-1 font-weight-bold mb-1">{{ $t('inspection_application_correction_banner_title') }}</h2><p class="mb-1">{{ $t('inspection_application_correction_banner_description') }}</p><p class="mb-0 text-caption">{{ $t('inspection_application_correction_same_application_notice') }}</p></v-alert>
            <section class="mb-7"><h2 class="application-details__section-title">{{ $t('inspection_application_details_vehicle_title') }}</h2><dl v-if="application.vehicleSnapshot" class="vehicle-summary"><div><dt>{{ $t('inspection_registration_number') }}</dt><dd>{{ snapshotValue(application.vehicleSnapshot.registrationNumber) }}</dd></div><div><dt>{{ $t('inspection_plate_number') }}</dt><dd>{{ snapshotValue(application.vehicleSnapshot.plateNumber) }}</dd></div><div><dt>{{ $t('inspection_make_and_model') }}</dt><dd>{{ vehicleMakeModel(application.vehicleSnapshot) }}</dd></div><div><dt>{{ $t('inspection_manufacture_year') }}</dt><dd>{{ snapshotValue(application.vehicleSnapshot.manufactureYear) }}</dd></div><div><dt>{{ $t('inspection_chassis_number') }}</dt><dd>{{ snapshotValue(application.vehicleSnapshot.chassisNumber) }}</dd></div><div><dt>{{ $t('inspection_vehicle_class') }}</dt><dd>{{ snapshotValue(application.vehicleSnapshot.vehicleClass) }}</dd></div></dl><p v-else class="text-medium-emphasis">{{ $t('inspection_application_details_vehicle_unavailable') }}</p></section>
            <section><div class="application-details__documents-heading"><div><h2 class="application-details__section-title mb-1">{{ $t('inspection_application_details_documents_title') }}</h2><p v-if="isCorrectionRequired" class="text-medium-emphasis mb-0">{{ $t('inspection_application_correction_documents_description') }}</p></div><v-chip v-if="isCorrectionRequired" color="warning" variant="tonal">{{ remainingRejectedDocuments.length }} {{ $t('inspection_application_correction_remaining') }}</v-chip></div>
              <div class="document-grid"><article v-for="type in DOCUMENT_TYPES" :key="type" class="document-card" :class="{ 'document-card--rejected': documentFor(type)?.status === 'REJECTED' }"><template v-if="documentFor(type)"><div class="document-card__heading"><div class="document-card__icon"><v-icon icon="mdi-file-document-outline" /></div><div class="min-width-0"><h3>{{ $t(documentTitleKey(type)) }}</h3><p>{{ $t('inspection_application_document_version', { version: documentFor(type)!.versionNumber }) }}</p></div><v-chip :color="documentStatusColor(documentFor(type)!.status)" size="small" variant="tonal">{{ $t(documentStatusKey(documentFor(type)!.status)) }}</v-chip></div><p class="document-card__filename">{{ documentFor(type)!.originalFileName }}</p>
                <v-alert v-if="documentFor(type)!.status === 'REJECTED'" class="mb-4" density="compact" type="error" variant="tonal"><strong>{{ $t('inspection_application_correction_rejection_reason') }}</strong><p class="mb-0 mt-1">{{ documentFor(type)!.rejectionReason ?? $t('inspection_application_correction_reason_unavailable') }}</p></v-alert>
                <v-alert v-if="uploadedReplacementTypes.includes(type) && documentFor(type)!.status === 'PENDING'" class="mb-4" density="compact" type="success" variant="tonal">{{ $t('inspection_application_correction_replacement_uploaded') }}</v-alert>
                <v-alert v-if="documentErrorKeys[type]" class="mb-4" density="compact" type="error" variant="tonal">{{ $t(documentErrorKeys[type]!) }}</v-alert>
                <div class="document-card__actions"><v-btn :loading="downloadingDocumentId === documentFor(type)!.id" prepend-icon="mdi-download-outline" variant="outlined" @click="downloadDocument(documentFor(type)!)">{{ $t('inspection_application_document_download') }}</v-btn><v-btn v-if="isCorrectionRequired && documentFor(type)!.status === 'REJECTED'" color="primary" :loading="uploadingTypes.includes(type)" prepend-icon="mdi-upload-outline" @click="chooseReplacement(type)">{{ $t('inspection_application_correction_upload') }}</v-btn></div><input :id="replacementInputId(type)" accept=".pdf,.jpg,.jpeg,.png" class="d-none" :disabled="uploadingTypes.includes(type)" type="file" @change="replacementSelected(type, $event)"></template><p v-else class="text-medium-emphasis mb-0">{{ $t('inspection_application_document_missing') }}</p></article></div>
              <div v-if="isCorrectionRequired" class="correction-submit"><div><strong>{{ $t('inspection_application_correction_resubmit_title') }}</strong><p class="mb-0 text-medium-emphasis">{{ canResubmit ? $t('inspection_application_correction_ready') : $t('inspection_application_correction_documents_remaining') }}</p></div><v-btn color="primary" :disabled="!canResubmit || uploadingTypes.length > 0" :loading="resubmitting" @click="resubmit">{{ $t('inspection_application_correction_resubmit') }}</v-btn></div>
            </section>
          </div></v-window-item>
          <v-window-item value="invoice"><div class="application-details__placeholder"><v-icon color="primary" icon="mdi-receipt-text-outline" size="38" /><h2>{{ $t('inspection_application_details_tab_invoice') }}</h2><p>{{ $t('inspection_application_details_invoice_deferred') }}</p></div></v-window-item>
        </v-window>
      </v-card>
    </template>
  </section>
</template>

<style scoped>
  .application-details { max-width: 1120px; padding-bottom: 36px; }.application-details__loading { align-items: center; display: flex; flex-direction: column; gap: 14px; justify-content: center; min-height: 360px; }.application-details__header { align-items: center; background: linear-gradient(112deg, #33447f, #27366f); border-radius: 18px; color: #fff; display: flex; gap: 24px; justify-content: space-between; margin-bottom: 24px; padding: 28px 34px; }.application-details__header h1 { font-size: clamp(1.5rem, 3vw, 2.15rem); overflow-wrap: anywhere; }.application-details__header p { color: rgba(255, 255, 255, .82); margin: 6px 0 0; }.application-details__eyebrow { font-size: .78rem; letter-spacing: .08em; text-transform: uppercase; }.application-details__content { border: 1px solid #dfe2e9; border-radius: 16px; overflow: hidden; }.application-details__panel { padding: 28px; }.application-details__placeholder { align-items: center; display: flex; flex-direction: column; justify-content: center; min-height: 280px; padding: 32px; text-align: center; }.application-details__placeholder--progress { background: #f7f8fb; border-radius: 14px; min-height: 190px; }.application-details__placeholder h2 { font-size: 1.12rem; margin-top: 12px; }.application-details__placeholder p { color: #666c7b; margin: 6px 0 0; }.application-details__section-title { font-size: 1.12rem; font-weight: 700; margin-bottom: 16px; }.application-details__documents-heading { align-items: center; display: flex; gap: 20px; justify-content: space-between; margin-bottom: 18px; }.vehicle-summary { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); }.vehicle-summary > div { background: #f7f8fb; border-radius: 11px; min-width: 0; padding: 13px 15px; }.vehicle-summary dt { color: #686e7d; font-size: .8rem; }.vehicle-summary dd { font-weight: 600; margin: 4px 0 0; overflow-wrap: anywhere; }.document-grid { display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); }.document-card { border: 1px solid #dfe2e9; border-radius: 14px; min-width: 0; padding: 18px; }.document-card--rejected { background: #fff9f8; border-color: #e9a7a0; }.document-card__heading { align-items: flex-start; display: grid; gap: 11px; grid-template-columns: auto minmax(0, 1fr) auto; }.document-card__heading h3 { font-size: .96rem; overflow-wrap: anywhere; }.document-card__heading p { color: #737887; font-size: .78rem; margin: 3px 0 0; }.document-card__icon { align-items: center; background: #eef0fb; border-radius: 9px; color: #33447f; display: flex; height: 38px; justify-content: center; width: 38px; }.document-card__filename { background: #f5f6f9; border-radius: 8px; font-size: .86rem; margin: 14px 0; overflow-wrap: anywhere; padding: 10px 12px; }.document-card__actions { display: flex; flex-wrap: wrap; gap: 10px; }.correction-submit { align-items: center; background: #f4f5fb; border-radius: 13px; display: flex; gap: 20px; justify-content: space-between; margin-top: 22px; padding: 18px; }
  @media (max-width: 759px) { .application-details__header { align-items: flex-start; flex-direction: column; padding: 24px; }.application-details__panel { padding: 18px; }.vehicle-summary, .document-grid { grid-template-columns: 1fr; }.application-details__documents-heading, .correction-submit { align-items: stretch; flex-direction: column; }.correction-submit :deep(.v-btn) { min-height: 44px; width: 100%; }.document-card__actions :deep(.v-btn) { flex: 1 1 180px; min-height: 44px; } }
</style>
