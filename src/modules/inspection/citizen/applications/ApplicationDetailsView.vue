<script setup lang="ts">
  import type { Vehicle } from '../vehicles/types/vehicle.types'
  import type { ApplicationDocument, ApplicationDocumentType, RenewalApplicationDetail, RenewalApplicationListItem, RenewalApplicationVehicleSnapshot } from './types/application.types'
  import { isAxiosError } from 'axios'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { formatDisplayDate } from '@/modules/inspection/shared/utils/display-date'
  import RenewalStartConfirmationDialog from '../renewal/components/RenewalStartConfirmationDialog.vue'
  import { useRenewalEntryFlow } from '../renewal/composables/use-renewal-entry-flow'
  import { findUnfinishedApplication, renewalEntryAction } from '../renewal/utils/renewal-entry-action'
  import { inspectionVehicleService } from '../vehicles/services/vehicle.service'
  import { formatProvince } from '../vehicles/utils/province-label'
  import { formatVehicleEnum, resolveVehicleColorLabel } from '../vehicles/utils/vehicle-enum-label'
  import { getVehicleTypeIcon } from '../vehicles/utils/vehicle-type-icon'
  import ApplicationPaymentTab from './components/ApplicationPaymentTab.vue'
  import ApplicationProgressTab from './components/ApplicationProgressTab.vue'
  import { inspectionApplicationService } from './services/application.service'
  import { type CitizenApplicationDetailedStatusFacts, resolveCitizenApplicationStatus } from './utils/citizen-application-status'
  import { correctionRejectionReason, isPendingReplacementOfRejectedDocument } from './utils/correction-document'
  import { localizedCorrectionReason } from './utils/correction-reason'

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
  const associatedVehicle = ref<Vehicle | null>(null)
  const citizenApplications = ref<RenewalApplicationListItem[]>([])
  const documents = ref<ApplicationDocument[]>([])
  const documentHistories = ref<Partial<Record<ApplicationDocumentType, ApplicationDocument[]>>>({})
  const imagePreviewUrls = ref<Partial<Record<ApplicationDocumentType, string>>>({})
  const thumbnailLoadingTypes = ref<ApplicationDocumentType[]>([])
  const thumbnailFailedTypes = ref<ApplicationDocumentType[]>([])
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
  const submittedDocumentsRef = ref<HTMLElement | null>(null)
  const resubmitting = ref(false)
  const renewing = ref(false)
  const detailedStatusFacts = ref<CitizenApplicationDetailedStatusFacts>({ certificate: null, inspection: null, payment: null, sticker: null, timelineEvents: null })
  const { confirmationLoading, confirmationOpen, confirmRenewal, isRenewingVehicle, startOrContinueRenewal } = useRenewalEntryFlow({
    onApplicationsLoaded: loaded => citizenApplications.value = loaded,
    onError: messageKey => {
      pageMessageType.value = 'error'
      pageMessageKey.value = messageKey
    },
  })

  const applicationId = computed(() => {
    const id = (route.params as Record<string, string | string[]>).id
    return typeof id === 'string' ? id : ''
  })
  const isCorrectionRequired = computed(() => application.value?.status === 'CORRECTION_REQUIRED')
  const isDraft = computed(() => application.value?.status === 'DRAFT')
  const currentDocuments = computed(() => documents.value.filter(document => document.isCurrent))
  const remainingRejectedDocuments = computed(() => currentDocuments.value.filter(document => document.status === 'REJECTED'))
  const canResubmit = computed(() => isCorrectionRequired.value && currentDocuments.value.length > 0 && remainingRejectedDocuments.value.length === 0)
  const previewIsPdf = computed(() => previewDocument.value?.mimeType === 'application/pdf')
  const headerMakeModel = computed(() => {
    const vehicle = application.value?.vehicleSnapshot
    return vehicle ? [vehicleMakeModel(vehicle), vehicle.manufactureYear].filter(Boolean).join(' ') : '—'
  })
  const headerPlate = computed(() => application.value?.vehicleSnapshot ? formattedPlate(application.value.vehicleSnapshot) : '—')
  const headerVehicleIcon = computed(() => getVehicleTypeIcon(application.value?.vehicleSnapshot?.vehicleType))
  const headerStatus = computed(() => resolveCitizenApplicationStatus(application.value ?? undefined, detailedStatusFacts.value))
  const completedActiveRenewal = computed(() => application.value === null
    ? undefined
    : findUnfinishedApplication(citizenApplications.value, application.value.vehicleId))
  const completedRenewalAction = computed(() => completedActiveRenewal.value === undefined
    ? { icon: 'mdi-refresh', labelKey: 'inspection_renewal_renew_again' }
    : renewalEntryAction(completedActiveRenewal.value))

  watch(() => route.query.tab, value => {
    activeTab.value = tabFromRoute(value)
  })

  watch(() => route.query.focus, value => {
    if (value === 'correction' && application.value !== null) void openCorrectionArea(false)
  })

  function tabFromRoute (value: unknown): DetailsTab {
    return typeof value === 'string' && DETAILS_TABS.has(value as DetailsTab) ? value as DetailsTab : 'progress'
  }

  async function changeTab (value: unknown) {
    const tab = tabFromRoute(value)
    activeTab.value = tab
    const query = { ...route.query, tab, focus: tab === 'documents' ? route.query.focus : undefined }
    await router.replace({ query })
  }

  function correctionDocumentId (type: ApplicationDocumentType): string {
    return `correction-document-${type.toLowerCase()}`
  }

  async function openCorrectionArea (updateRoute = true) {
    activeTab.value = 'documents'
    if (updateRoute) {
      await router.replace({ query: { ...route.query, tab: 'documents', focus: 'correction' } })
    }
    await nextTick()
    await nextTick()
    const firstRejected = remainingRejectedDocuments.value[0]
    const target = firstRejected === undefined
      ? submittedDocumentsRef.value
      : document.querySelector<HTMLElement>(`#${correctionDocumentId(firstRejected.documentType)}`)
    target?.scrollIntoView({ behavior: 'auto', block: 'start' })
    if (firstRejected !== undefined) target?.focus({ preventScroll: true })
  }

  function documentFor (type: ApplicationDocumentType) {
    return currentDocuments.value.find(document => document.documentType === type)
  }

  function canReplaceDocument (type: ApplicationDocumentType): boolean {
    const current = documentFor(type)
    if (current === undefined) return false
    if (isDraft.value) return true
    return isCorrectionRequired.value && (
      current.status === 'REJECTED' || isPendingReplacementOfRejectedDocument(current, documentHistoryFor(type))
    )
  }

  function documentHistoryFor (type: ApplicationDocumentType): ApplicationDocument[] {
    return documentHistories.value[type] ?? []
  }

  function correctionReasonFor (type: ApplicationDocumentType): string | null {
    const current = documentFor(type)
    return current === undefined ? null : correctionRejectionReason(current, documentHistoryFor(type))
  }

  function correctionReasonLabelKey (type: ApplicationDocumentType): string {
    return documentFor(type)?.status === 'REJECTED'
      ? 'inspection_application_correction_rejection_reason'
      : 'inspection_application_correction_reason'
  }

  function replacementActionLabelKey (documentItem: ApplicationDocument): string {
    return documentItem.mimeType.startsWith('image/')
      ? 'inspection_application_correction_change_image'
      : 'inspection_application_correction_replace_file'
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

  function documentStatusClass (status: ApplicationDocument['status']): string {
    return `document-row__status--${status.toLowerCase()}`
  }

  function correctionReason (reason: string | null): string {
    return localizedCorrectionReason(reason, locale.value, t) ?? t('inspection_application_correction_reason_unavailable')
  }

  function formatDate (value: string | null): string {
    return formatDisplayDate(value)
  }

  function snapshotValue (value: string | number | null): string {
    return value ? String(value) : '—'
  }

  function vehicleMakeModel (vehicle: RenewalApplicationVehicleSnapshot): string {
    return [vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'
  }

  function formattedPlate (vehicle: RenewalApplicationVehicleSnapshot): string {
    const plateNumber = vehicle.plateNumber?.trim() ?? ''
    let plateLabel = formatProvince(vehicle.plateProvince, locale.value)

    if (vehicle.plateCategory === 'PERSONALIZED_CAMBODIA') plateLabel = t('inspection_plate_cambodia')
    return [plateLabel, plateNumber].filter(Boolean).join(' ') || '—'
  }

  function engineDisplacement (value: number | null | undefined): string {
    return value ? `${value} cc` : '—'
  }

  function applicationInspectionCategoryLabel (): string {
    const category = application.value?.vehicleSnapshot?.inspectionCategory
    if (category === null || category === undefined) return '—'
    return locale.value === 'kh'
      ? category.nameKh || category.nameEn || '—'
      : category.nameEn || category.nameKh || '—'
  }

  function documentMetadata (documentItem: ApplicationDocument): string {
    return documentItem.originalFileName
  }

  type FilePresentation = 'IMAGE' | 'PDF' | 'GENERIC'

  function filePresentation (documentItem: ApplicationDocument): FilePresentation {
    if (documentItem.mimeType.startsWith('image/')) return 'IMAGE'
    if (documentItem.mimeType === 'application/pdf') return 'PDF'
    return 'GENERIC'
  }

  function isImageDocument (documentItem: ApplicationDocument): boolean {
    return filePresentation(documentItem) === 'IMAGE'
  }

  function documentIcon (documentItem: ApplicationDocument): string {
    return filePresentation(documentItem) === 'PDF' ? 'mdi-file-pdf-box' : 'mdi-file-outline'
  }

  function imagePreviewUrl (type: ApplicationDocumentType): string | null {
    return imagePreviewUrls.value[type] ?? null
  }

  function thumbnailLoading (type: ApplicationDocumentType): boolean {
    return thumbnailLoadingTypes.value.includes(type)
  }

  function thumbnailFailed (type: ApplicationDocumentType): boolean {
    return thumbnailFailedTypes.value.includes(type)
  }

  function downloadLabelKey (documentItem: ApplicationDocument): string {
    if (filePresentation(documentItem) === 'IMAGE') return 'inspection_application_document_download_image'
    if (filePresentation(documentItem) === 'PDF') return 'inspection_application_document_download_pdf'
    return 'inspection_application_document_download_file'
  }

  function releaseImagePreview (type: ApplicationDocumentType) {
    const url = imagePreviewUrls.value[type]
    if (url !== undefined) URL.revokeObjectURL(url)
    const { [type]: _released, ...remaining } = imagePreviewUrls.value
    imagePreviewUrls.value = remaining
  }

  async function loadImagePreview (documentItem: ApplicationDocument) {
    if (!isImageDocument(documentItem)) return
    const type = documentItem.documentType
    thumbnailLoadingTypes.value = [...new Set([...thumbnailLoadingTypes.value, type])]
    thumbnailFailedTypes.value = thumbnailFailedTypes.value.filter(value => value !== type)
    try {
      const blob = await inspectionApplicationService.downloadDocument(applicationId.value, documentItem.id)
      const url = URL.createObjectURL(blob)
      if (documentFor(type)?.id !== documentItem.id) {
        URL.revokeObjectURL(url)
        return
      }
      releaseImagePreview(type)
      imagePreviewUrls.value = { ...imagePreviewUrls.value, [type]: url }
    } catch {
      thumbnailFailedTypes.value = [...new Set([...thumbnailFailedTypes.value, type])]
    } finally {
      thumbnailLoadingTypes.value = thumbnailLoadingTypes.value.filter(value => value !== type)
    }
  }

  function thumbnailDecodeFailed (type: ApplicationDocumentType) {
    releaseImagePreview(type)
    thumbnailFailedTypes.value = [...new Set([...thumbnailFailedTypes.value, type])]
  }

  async function load () {
    if (!UUID_V4_PATTERN.test(applicationId.value)) {
      loadError.value = true
      initialLoading.value = false
      return
    }
    loadError.value = false
    try {
      const [loadedApplication, loadedDocuments, loadedApplications] = await Promise.all([
        inspectionApplicationService.getById(applicationId.value),
        inspectionApplicationService.listDocuments(applicationId.value),
        inspectionApplicationService.listCitizenApplications({ limit: 100, sortOrder: 'desc' }),
      ])
      application.value = loadedApplication
      citizenApplications.value = loadedApplications.data
      associatedVehicle.value = loadedApplication.status === 'COMPLETED'
        ? await inspectionVehicleService.getById(loadedApplication.vehicleId)
        : null
      documents.value = loadedDocuments
      void Promise.all(loadedDocuments.map(documentItem => loadImagePreview(documentItem)))
      documentHistories.value = loadedApplication.status === 'CORRECTION_REQUIRED'
        ? await loadDocumentHistories(loadedApplication.id)
        : {}
      void loadDetailedStatusFacts(loadedApplication.id)
    } catch {
      loadError.value = true
    } finally {
      initialLoading.value = false
      refreshing.value = false
    }
    if (!loadError.value && route.query.focus === 'correction') await openCorrectionArea(false)
  }

  async function loadDocumentHistories (id: string) {
    const results = await Promise.allSettled(DOCUMENT_TYPES.map(type => inspectionApplicationService.listDocumentHistory(id, type, { limit: 100 })))
    return Object.fromEntries(DOCUMENT_TYPES.map((type, index) => {
      const result = results[index]
      return [type, result?.status === 'fulfilled' ? result.value.data : []]
    })) as Partial<Record<ApplicationDocumentType, ApplicationDocument[]>>
  }

  async function loadDetailedStatusFacts (id: string) {
    const results = await Promise.allSettled([
      inspectionApplicationService.listTimelineEvents(id),
      inspectionApplicationService.getInspectionStatus(id),
      inspectionApplicationService.getStickerStatus(id),
      inspectionApplicationService.getPayment(id),
      inspectionApplicationService.getApplicationCertificate(id),
    ] as const)
    if (application.value?.id !== id) return
    const [timelineEvents, inspection, sticker, payment, certificate] = results
    detailedStatusFacts.value = {
      timelineEvents: timelineEvents.status === 'fulfilled' ? timelineEvents.value : null,
      inspection: inspection.status === 'fulfilled' ? inspection.value : null,
      sticker: sticker.status === 'fulfilled' ? sticker.value : null,
      payment: payment.status === 'fulfilled' ? payment.value : null,
      certificate: certificate.status === 'fulfilled' ? certificate.value : null,
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
    if (canReplaceDocument(type) && !uploadingTypes.value.includes(type)) document.querySelector<HTMLElement>(`#${replacementInputId(type)}`)?.click()
  }

  async function replacementSelected (type: ApplicationDocumentType, event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file) await uploadReplacement(type, file)
  }

  async function uploadReplacement (type: ApplicationDocumentType, file: File) {
    if (!canReplaceDocument(type) || uploadingTypes.value.includes(type)) return
    const validationKey = validationErrorKey(file)
    if (validationKey) {
      documentErrorKeys.value = { ...documentErrorKeys.value, [type]: validationKey }
      return
    }
    uploadingTypes.value = [...uploadingTypes.value, type]
    documentErrorKeys.value = { ...documentErrorKeys.value, [type]: undefined }
    try {
      await inspectionApplicationService.uploadDocument(applicationId.value, type, file)
      const [refreshedDocuments, refreshedHistory] = await Promise.all([
        inspectionApplicationService.listDocuments(applicationId.value),
        inspectionApplicationService.listDocumentHistory(applicationId.value, type, { limit: 100 }),
      ])
      documents.value = refreshedDocuments
      documentHistories.value = { ...documentHistories.value, [type]: refreshedHistory.data }
      releaseImagePreview(type)
      const current = refreshedDocuments.find(documentItem => documentItem.documentType === type && documentItem.isCurrent)
      if (current !== undefined) void loadImagePreview(current)
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

  async function renewCompletedApplication () {
    if (application.value?.status !== 'COMPLETED' || associatedVehicle.value === null) return
    await startOrContinueRenewal(associatedVehicle.value)
  }

  onMounted(() => {
    void load()
  })

  onBeforeUnmount(() => {
    closeDocumentPreview()
    for (const type of Object.keys(imagePreviewUrls.value)) releaseImagePreview(type as ApplicationDocumentType)
  })
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <section class="application-details citizen-auth-type-scale mx-auto">
    <div class="application-details__topline"><v-breadcrumbs class="application-details__breadcrumbs px-0" density="compact"><v-breadcrumbs-item to="/services/inspection/applications">{{ $t('inspection_my_applications') }}</v-breadcrumbs-item><v-breadcrumbs-divider icon="mdi-chevron-right" /><v-breadcrumbs-item active active-color="primary" class="application-details__breadcrumbs-current">{{ application?.referenceNumber ?? '—' }}</v-breadcrumbs-item></v-breadcrumbs><v-btn class="application-details__back" prepend-icon="mdi-arrow-left" to="/services/inspection/applications" variant="text">{{ $t('inspection_application_details_back') }}</v-btn></div>
    <div v-if="initialLoading" class="application-details__loading"><v-progress-circular color="primary" indeterminate /><span>{{ $t('loading') }}</span></div>
    <v-alert v-else-if="loadError" type="error" variant="tonal"><div class="d-flex flex-wrap align-center justify-space-between ga-3"><span>{{ $t('inspection_application_details_load_error') }}</span><v-btn :loading="refreshing" variant="outlined" @click="retry">{{ $t('retry') }}</v-btn></div></v-alert>
    <template v-else-if="application">
      <header class="application-details__header"><div class="application-details__heading-copy"><h1>{{ $t('inspection_application_details_title') }}</h1><p class="application-details__reference"><span>{{ $t('inspection_application_details_reference') }}:</span>{{ application.referenceNumber ?? '—' }}</p><p v-if="application.transactionNumber" class="application-details__transaction"><span>{{ $t('inspection_history_transaction_number') }}:</span>{{ application.transactionNumber }}</p><div class="application-details__metadata"><span><v-icon icon="mdi-card-text-outline" size="17" />{{ headerPlate }}</span><span><v-icon :icon="headerVehicleIcon" size="17" />{{ headerMakeModel }}</span><span><v-icon icon="mdi-calendar-blank-outline" size="17" />{{ $t('inspection_application_details_submitted') }}: {{ formatDate(application.submittedAt) }}</span></div></div><v-btn v-if="isCorrectionRequired" :aria-label="$t('inspection_application_correction_open_accessible', { status: $t(headerStatus.labelKey) })" :class="['application-details__status', 'application-details__status-action', `application-details__status--${headerStatus.color}`]" :color="headerStatus.color" :prepend-icon="headerStatus.icon" rounded="pill" size="small" variant="tonal" @click="openCorrectionArea()">{{ $t(headerStatus.labelKey) }}</v-btn><v-chip v-else :class="['application-details__status', `application-details__status--${headerStatus.color}`]" :color="headerStatus.color" :prepend-icon="headerStatus.icon" size="small" variant="tonal">{{ $t(headerStatus.labelKey) }}</v-chip></header>
      <v-alert v-if="pageMessageKey" class="mb-5" :type="pageMessageType" variant="tonal">{{ $t(pageMessageKey) }}</v-alert>
      <v-alert v-if="application.status === 'EXPIRED'" class="mb-5" icon="mdi-calendar-remove-outline" type="error" variant="tonal"><div class="d-flex flex-wrap align-center justify-space-between ga-3"><div><strong>{{ $t('inspection_application_correction_application_expired') }}</strong><p class="mb-0 mt-1">{{ $t('inspection_application_correction_expired_description') }}</p></div><v-btn color="error" :loading="renewing" variant="outlined" @click="renewAgain">{{ $t('inspection_renewal_renew_again') }}</v-btn></div></v-alert>
      <v-card class="application-details__content" elevation="0">
        <div :class="['application-details__tabs', `application-details__tabs--${activeTab}`]"><v-tabs color="primary" :model-value="activeTab" show-arrows @update:model-value="changeTab"><v-tab :class="{ 'application-details__tab--active': activeTab === 'progress' }" value="progress">{{ $t('inspection_application_details_tab_progress') }}</v-tab><v-tab :class="{ 'application-details__tab--active': activeTab === 'documents' }" value="documents">{{ $t('inspection_application_details_tab_documents') }}</v-tab><v-tab :class="{ 'application-details__tab--active': activeTab === 'invoice' }" value="invoice">{{ $t('inspection_application_details_tab_invoice') }}</v-tab></v-tabs><span aria-hidden="true" class="application-details__active-tab-bar" /></div><v-divider />
        <v-window :model-value="activeTab">
          <v-window-item value="progress"><div class="application-details__panel application-details__panel--progress"><ApplicationProgressTab :active="activeTab === 'progress'" :application="application" :renewal-action-icon="completedRenewalAction.icon" :renewal-action-label-key="completedRenewalAction.labelKey" :renewal-loading="associatedVehicle !== null && isRenewingVehicle(associatedVehicle.id)" @correction="openCorrectionArea()" @renew="renewCompletedApplication" /></div></v-window-item>
          <v-window-item value="documents"><div class="application-details__panel">
            <section class="vehicle-section mb-8"><h2 class="application-details__section-title">{{ $t('inspection_application_details_vehicle_section_title') }}</h2><div v-if="application.vehicleSnapshot" class="vehicle-card-grid">
              <article aria-labelledby="vehicle-information-heading" class="vehicle-info-card vehicle-info-card--vehicle"><h3 id="vehicle-information-heading" class="vehicle-info-card__title"><v-icon :icon="getVehicleTypeIcon(application.vehicleSnapshot.vehicleType)" size="24" />{{ $t('inspection_application_details_vehicle_title') }}</h3><dl class="vehicle-info-list"><div><dt>{{ $t('inspection_plate_number') }}</dt><dd>{{ formattedPlate(application.vehicleSnapshot) }}</dd></div><div class="vehicle-info-list__type"><dt>{{ $t('inspection_payment_inspection_category') }}</dt><dd>{{ applicationInspectionCategoryLabel() }}</dd></div><div><dt>{{ $t('inspection_make_and_model') }}</dt><dd>{{ vehicleMakeModel(application.vehicleSnapshot) }}</dd></div><div><dt>{{ $t('inspection_manufacture_year') }}</dt><dd>{{ snapshotValue(application.vehicleSnapshot.manufactureYear) }}</dd></div><div><dt>{{ $t('inspection_colour') }}</dt><dd>{{ resolveVehicleColorLabel(application.vehicleSnapshot.colour, t) }}</dd></div></dl></article>
              <article aria-labelledby="technical-information-heading" class="vehicle-info-card vehicle-info-card--technical"><h3 id="technical-information-heading" class="vehicle-info-card__title"><v-icon icon="mdi-cog-outline" size="24" />{{ $t('inspection_application_details_technical_title') }}</h3><dl class="vehicle-info-list"><div><dt>{{ $t('inspection_engine_number') }}</dt><dd>{{ snapshotValue(application.vehicleSnapshot.engineNumber ?? null) }}</dd></div><div><dt>{{ $t('inspection_chassis_number') }}</dt><dd>{{ snapshotValue(application.vehicleSnapshot.chassisNumber) }}</dd></div><div><dt>{{ $t('inspection_engine_displacement') }}</dt><dd>{{ engineDisplacement(application.vehicleSnapshot.engineDisplacementCc) }}</dd></div><div><dt>{{ $t('inspection_engine_power') }}</dt><dd>{{ snapshotValue(application.vehicleSnapshot.enginePowerHp ?? null) }}</dd></div><div><dt>{{ $t('inspection_fuel_type') }}</dt><dd>{{ formatVehicleEnum(application.vehicleSnapshot.fuelType, t) }}</dd></div></dl></article>
            </div><p v-else class="text-medium-emphasis">{{ $t('inspection_application_details_vehicle_unavailable') }}</p></section>
            <section id="submitted-documents" ref="submittedDocumentsRef" class="submitted-documents"><div class="application-details__documents-heading"><h2 class="application-details__section-title mb-0">{{ $t('inspection_application_details_documents_title') }}</h2></div>
              <div class="document-list"><article v-for="type in DOCUMENT_TYPES" :id="correctionDocumentId(type)" :key="type" class="document-row" :class="{ 'document-row--rejected': documentFor(type)?.status === 'REJECTED' }" :tabindex="documentFor(type)?.status === 'REJECTED' ? -1 : undefined"><template v-if="documentFor(type)"><div class="document-row__main"><button v-if="filePresentation(documentFor(type)!) === 'IMAGE'" :aria-label="$t('inspection_application_document_view_file')" class="document-row__thumbnail" :disabled="!imagePreviewUrl(type)" type="button" @click="viewDocument(documentFor(type)!)"><img v-if="imagePreviewUrl(type)" :alt="documentFor(type)!.originalFileName" :src="imagePreviewUrl(type)!" @error="thumbnailDecodeFailed(type)"><v-progress-circular v-else-if="thumbnailLoading(type)" color="primary" indeterminate size="22" width="2" /><v-icon v-else :icon="thumbnailFailed(type) ? 'mdi-image-broken-variant' : 'mdi-file-image-outline'" size="24" /></button><div v-else aria-hidden="true" class="document-row__icon"><v-icon :icon="documentIcon(documentFor(type)!)" /></div><div class="document-row__copy"><h3>{{ $t(documentTitleKey(type)) }}</h3><p :title="documentMetadata(documentFor(type)!)">{{ documentMetadata(documentFor(type)!) }}</p></div></div><v-chip :class="['document-row__status', documentStatusClass(documentFor(type)!.status)]" :color="documentStatusColor(documentFor(type)!.status)" size="small" variant="tonal">{{ $t(documentStatusKey(documentFor(type)!.status)) }}</v-chip><div class="document-row__actions"><v-btn :aria-label="$t('inspection_application_document_view_file')" class="document-row__icon-action" icon="mdi-eye-outline" :loading="viewingDocumentId === documentFor(type)!.id" size="small" :title="$t('inspection_application_document_view_file')" variant="text" @click="viewDocument(documentFor(type)!)" /><v-btn :aria-label="$t(downloadLabelKey(documentFor(type)!))" class="document-row__icon-action" icon="mdi-download-outline" :loading="downloadingDocumentId === documentFor(type)!.id" size="small" :title="$t(downloadLabelKey(documentFor(type)!))" variant="text" @click="downloadDocument(documentFor(type)!)" /></div>
                <div v-if="correctionReasonFor(type)" class="document-row__reason"><v-icon icon="mdi-alert-circle-outline" size="18" /><span><strong>{{ $t(correctionReasonLabelKey(type)) }}:</strong><small>{{ correctionReason(correctionReasonFor(type)) }}</small></span></div>
                <v-alert v-if="documentErrorKeys[type]" class="mb-4" density="compact" type="error" variant="tonal">{{ $t(documentErrorKeys[type]!) }}</v-alert>
                <div v-if="canReplaceDocument(type)" class="document-row__correction-action"><v-btn color="primary" :loading="uploadingTypes.includes(type)" prepend-icon="mdi-file-replace-outline" @click="chooseReplacement(type)">{{ $t(replacementActionLabelKey(documentFor(type)!)) }}</v-btn></div><input :id="replacementInputId(type)" accept=".pdf,.jpg,.jpeg,.png" class="d-none" :disabled="uploadingTypes.includes(type)" type="file" @change="replacementSelected(type, $event)"></template><p v-else class="text-medium-emphasis mb-0">{{ $t('inspection_application_document_missing') }}</p></article></div>
              <div v-if="isCorrectionRequired" class="correction-submit"><v-btn color="primary" :disabled="!canResubmit || uploadingTypes.length > 0" :loading="resubmitting" @click="resubmit">{{ $t('inspection_application_correction_resubmit') }}</v-btn></div>
            </section>
          </div></v-window-item>
          <v-window-item value="invoice"><ApplicationPaymentTab :active="activeTab === 'invoice'" :application="application" /></v-window-item>
        </v-window>
      </v-card>
      <RenewalStartConfirmationDialog v-model="confirmationOpen" :loading="confirmationLoading" @confirm="confirmRenewal" />
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
  .application-details__header h1 { color: #102652; font-size: clamp(1.35rem, 2vw, 1.72rem); font-weight: 400; letter-spacing: -.01em; line-height: 1.2; }
  .application-details__reference { color: #26366d; font-size: .88rem; font-weight: 700; margin: 7px 0 0; overflow-wrap: anywhere; }
  .application-details__reference span { color: #4f5669; font-weight: 400; margin-inline-end: 8px; }
  .application-details__transaction { color: #26366d; font-size: .88rem; font-weight: 700; margin: 4px 0 0; overflow-wrap: anywhere; }
  .application-details__transaction span { color: #4f5669; font-weight: 400; margin-inline-end: 8px; }
  .application-details__metadata { align-items: center; color: #4f5669; column-gap: 24px; display: flex; flex-wrap: wrap; font-size: .9rem; margin-top: 13px; row-gap: 10px; }
  .application-details__metadata span { align-items: center; background: transparent; border: 0; border-radius: 0; box-shadow: none; display: inline-flex; gap: 6px; min-height: 0; padding: 0; }
  .application-details__metadata :deep(.v-icon) { color: #42558f; }
  .application-details__status { box-shadow: 0 5px 14px rgba(32, 38, 71, .09); flex: 0 0 auto; font-weight: 800; margin-top: 4px; }
  .application-details__status-action { font-size: .84rem; letter-spacing: 0; text-transform: none; }
  .application-details__status-action:focus-visible { outline: 3px solid rgba(42, 52, 114, .3); outline-offset: 2px; }
  .application-details__status--info { background: #e8f4fc !important; color: #1683bd !important; }
  .application-details__status--secondary { background: #f7f2ff !important; color: #6b21a8 !important; }
  .application-details__status--success { background: #ecfdf3 !important; color: #166534 !important; }
  .application-details__status--warning { background: #fff3e8 !important; color: #c25f00 !important; }
  .application-details__status--error { background: #fff0f0 !important; color: #b42318 !important; }
  .application-details__content { background: #fff; border: 1px solid #dfe3ec; border-radius: 14px; box-shadow: 0 12px 32px rgba(25, 35, 71, .045); overflow: clip; }
  .application-details__tabs { background: #f8f8fb; position: relative; }
  .application-details__content :deep(.v-tabs) { background: transparent; }
  .application-details__content :deep(.v-tab) { color: #5e6370; flex: 1 1 0; font-size: 1.05rem; font-weight: 600; min-height: 68px; padding-bottom: 9px; position: relative; }
  .application-details__content :deep(.v-tab--selected),
  .application-details__content :deep(.application-details__tab--active) { background: #fff; color: #263575; font-weight: 600; }
  .application-details.citizen-auth-type-scale .application-details__content :deep(.v-tab--selected),
  .application-details.citizen-auth-type-scale .application-details__content :deep(.v-tab--selected .v-btn__content),
  .application-details.citizen-auth-type-scale .application-details__content :deep(.application-details__tab--active),
  .application-details.citizen-auth-type-scale .application-details__content :deep(.application-details__tab--active .v-btn__content) { font-size: .92rem !important; }
  .application-details__content :deep(.v-tab__slider) { display: none !important; }
  .application-details__active-tab-bar { background: #2a3d80; bottom: 0; height: 3px; left: 0; pointer-events: none; position: absolute; transform: translateX(0); transition: transform .2s ease; width: 33.333333%; z-index: 3; }
  .application-details__tabs--documents .application-details__active-tab-bar { transform: translateX(100%); }
  .application-details__tabs--invoice .application-details__active-tab-bar { transform: translateX(200%); }
  .application-details__panel { padding: 32px 28px 40px; }
  .application-details__panel--progress { background: #fff; }
  .application-details__placeholder { align-items: center; display: flex; flex-direction: column; justify-content: center; min-height: 280px; padding: 32px; text-align: center; }
  .application-details__placeholder--progress { background: #f7f8fb; border-radius: 14px; min-height: 190px; }
  .application-details__placeholder h2 { font-size: 1.12rem; margin-top: 12px; }
  .application-details__placeholder p { color: #666c7b; margin: 6px 0 0; }
  .application-details__section-title { align-items: center; color: #102652; display: flex; font-size: 1.08rem; font-weight: 800; gap: 9px; margin-bottom: 18px; }
  .application-details__section-title::before { background: linear-gradient(#334b91, #7891dd); border-radius: 999px; content: ''; height: 20px; width: 4px; }
  .vehicle-section { width: 100%; }
  .vehicle-card-grid { align-items: stretch; display: grid; gap: 20px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-inline: auto; max-width: 800px; }
  .vehicle-info-card { background: #fff; border: 1px solid #d9dfeb; border-radius: 16px; box-shadow: 0 8px 22px rgba(32, 47, 92, .08); display: flex; flex-direction: column; min-width: 0; overflow: hidden; padding: 20px 24px; position: relative; }
  .vehicle-info-card::before { display: none; }
  .vehicle-info-card__title { align-items: center; color: #24356f; display: flex; font-size: 1rem; font-weight: 800; gap: 9px; margin-bottom: 10px; }
  .vehicle-info-card__title :deep(.v-icon) { align-items: center; background: #e8edff; border-radius: 10px; display: inline-flex; font-size: 20px !important; height: 42px; justify-content: center; line-height: 1; padding: 0; width: 42px; }
  .vehicle-info-list { flex: 1; }
  .vehicle-info-list > div { align-items: start; display: grid; gap: 16px; grid-template-columns: minmax(108px, .85fr) minmax(0, 1.25fr); min-height: 59px; padding: 12px 0; }
  .application-details.citizen-auth-type-scale .vehicle-info-list dt { color: #666b7a; font-size: .85rem !important; }
  .application-details.citizen-auth-type-scale .vehicle-info-list dd { color: #252833; font-size: .95rem !important; font-weight: 650; margin: 0; overflow-wrap: anywhere; }
  .vehicle-info-card--vehicle .vehicle-info-list__type, .vehicle-info-card--technical .vehicle-info-list > div:nth-child(2) { min-height: 77px; }
  .vehicle-info-list__type dd { display: block; line-height: 1.55; min-width: 0; overflow-wrap: anywhere; text-align: start; white-space: normal; }
  .vehicle-info-list__type-suffix { display: block; }
  .application-details__documents-heading { align-items: center; display: flex; gap: 20px; justify-content: space-between; margin-bottom: 12px; }
  .submitted-documents, .document-row--rejected { scroll-margin-top: 96px; }
  .document-list { display: grid; gap: 9px; }
  .document-row { align-items: center; background: transparent; border: 0; border-radius: 0; box-shadow: none; display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr) auto auto; min-width: 0; padding: 12px 16px; }
  .document-row--rejected { background: transparent; }
  .document-row__main { align-items: center; display: flex; gap: 13px; min-width: 0; }
  .document-row__icon { align-items: center; background: linear-gradient(145deg, #e7edff, #d5e0ff); border: 1px solid #ced9fa; border-radius: 9px; color: #334b88; display: flex; flex: 0 0 40px; height: 40px; justify-content: center; width: 40px; }
  .document-row__thumbnail { align-items: center; background: #eef1f7; border: 1px solid #d7ddeb; border-radius: 9px; color: #536184; cursor: zoom-in; display: flex; flex: 0 0 56px; height: 56px; justify-content: center; overflow: hidden; padding: 0; width: 56px; }
  .document-row__thumbnail:disabled { cursor: default; }
  .document-row__thumbnail img { background: #f8fafc; height: 100%; object-fit: contain; width: 100%; }
  .document-row__thumbnail:focus-visible { outline: 3px solid rgba(42, 52, 114, .25); outline-offset: 2px; }
  .document-row__copy { min-width: 0; }
  .document-row__copy h3 { color: #242936; font-size: .94rem; overflow-wrap: anywhere; }
  .application-details.citizen-auth-type-scale .document-row__copy p { color: #6f7481; font-size: .85rem !important; margin: 2px 0 0; max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .application-details.citizen-auth-type-scale .document-row__status { box-shadow: 0 2px 7px rgba(32, 38, 71, .05); font-size: .85rem !important; font-weight: 800; justify-self: start; }
  .document-row__status--approved { background: #ecfdf3 !important; color: #166534 !important; }.document-row__status--pending { background: #e8f4fc !important; color: #1683bd !important; }.document-row__status--rejected { background: #fff0f0 !important; color: #b42318 !important; }
  .document-row__actions { align-items: center; display: flex; gap: 6px; justify-self: end; }
  .document-row__actions :deep(.v-btn) { border-radius: 9px; color: #263575; }
  .document-row__icon-action { background: transparent; height: 36px; min-width: 36px; width: 36px; }
  .document-row__icon-action:hover { background: #eef2ff; }
  .document-row > .v-alert, .document-row__reason, .document-row__correction-action { grid-column: 1 / -1; }
  .document-row__reason { align-items: flex-start; background: #fef2f2; border-inline-start: 3px solid #f87171; border-radius: 5px; color: #b42318; display: flex; font-size: .82rem; gap: 7px; line-height: 1.5; padding: 7px 9px; }
  .document-row__reason :deep(.v-icon) { flex: 0 0 auto; margin-top: 1px; }
  .document-row__reason span { display: grid; gap: 1px; }
  .document-row__reason small { color: #b42318; font-size: .75rem; }
  .document-row__correction-action { display: flex; justify-content: flex-end; }
  .correction-submit { align-items: center; border-top: 1px solid #e3e6ee; display: flex; gap: 16px; justify-content: flex-end; margin-top: 16px; padding-top: 14px; }
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
