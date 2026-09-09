<script setup lang="ts">
  import type { ApplicationStatus, RenewalApplicationListItem } from './types/application.types'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { inspectionApplicationService } from './services/application.service'

  type StatusPresentation = { color: string, icon: string, labelKey: string }

  const pageSize = 20
  const { locale, t } = useI18n()
  const router = useRouter()
  const applications = ref<RenewalApplicationListItem[]>([])
  const meta = ref<{ totalPages: number } | null>(null)
  const page = ref(1)
  const search = ref('')
  type ApplicationFilterGroup = 'all' | 'draft' | 'inProgress' | 'actionRequired' | 'completed' | 'unsuccessful' | 'cancelled'
  const filterGroup = ref<ApplicationFilterGroup>('all')
  const initialLoading = ref(true)
  const refreshing = ref(false)
  const loadError = ref(false)
  const actionErrorMessageKey = ref('')
  const hasLoaded = ref(false)
  const navigatingApplicationId = ref<string | null>(null)
  let requestSequence = 0
  let searchTimeout: ReturnType<typeof setTimeout> | null = null

  const statusOptions = computed(() => [
    { title: t('inspection_applications_filter_all'), value: 'all' },
    { title: t('inspection_application_status_draft'), value: 'draft' },
    { title: t('inspection_applications_filter_in_progress'), value: 'inProgress' },
    { title: t('inspection_applications_filter_action_required'), value: 'actionRequired' },
    { title: t('inspection_application_status_completed'), value: 'completed' },
    { title: t('inspection_applications_filter_unsuccessful'), value: 'unsuccessful' },
    { title: t('inspection_application_status_cancelled'), value: 'cancelled' },
  ])

  const filterStatuses: Record<ApplicationFilterGroup, ApplicationStatus[]> = {
    all: [],
    draft: ['DRAFT'],
    inProgress: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'],
    actionRequired: ['CORRECTION_REQUIRED', 'APPOINTMENT_SELECTION_REQUIRED', 'REINSPECTION_REQUIRED'],
    completed: ['COMPLETED'],
    unsuccessful: ['REJECTED', 'INSPECTION_FAILED', 'EXPIRED'],
    cancelled: ['CANCELLED'],
  }

  onMounted(() => {
    void loadApplications()
  })
  onBeforeUnmount(() => {
    if (searchTimeout !== null) clearTimeout(searchTimeout)
  })
  watch(search, () => {
    page.value = 1
    if (searchTimeout !== null) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      searchTimeout = null
      void loadApplications()
    }, 300)
  })

  async function loadApplications () {
    const request = ++requestSequence
    const isInitialLoad = !hasLoaded.value
    if (isInitialLoad) initialLoading.value = true
    else refreshing.value = true
    loadError.value = false
    try {
      const response = await inspectionApplicationService.listCitizenApplications({
        page: page.value,
        limit: pageSize,
        sortOrder: 'desc',
        search: search.value,
        statuses: filterStatuses[filterGroup.value],
      })
      if (request !== requestSequence) return
      applications.value = response.data
      meta.value = response.meta
      hasLoaded.value = true
    } catch {
      if (request !== requestSequence) return
      loadError.value = true
    } finally {
      if (request === requestSequence) {
        initialLoading.value = false
        refreshing.value = false
      }
    }
  }

  function changeStatus (value: ApplicationFilterGroup | null = 'all') {
    const nextGroup = value === null ? 'all' : value
    if (nextGroup === filterGroup.value) return
    filterGroup.value = nextGroup
    page.value = 1
    void loadApplications()
  }

  function changePage (value: number) {
    if (value === page.value) return
    page.value = value
    void loadApplications()
  }

  function retry () {
    if (!initialLoading.value && !refreshing.value) void loadApplications()
  }

  async function openApplication (application: RenewalApplicationListItem) {
    if (navigatingApplicationId.value !== null) return
    navigatingApplicationId.value = application.id
    actionErrorMessageKey.value = ''
    try {
      if (application.status === 'EXPIRED') {
        const draft = await inspectionApplicationService.renewAgain(application.id)
        await router.push({ path: '/services/inspection/renewal/documents', query: { applicationId: draft.id } })
        return
      }
      if (application.status === 'INSPECTION_FAILED') {
        const draft = await inspectionApplicationService.applyAgain(application.id)
        await router.push({ path: '/services/inspection/renewal/documents', query: { applicationId: draft.id } })
        return
      }
      if (application.status === 'CORRECTION_REQUIRED') {
        await router.push({
          path: `/services/inspection/applications/${application.id}`,
          query: { tab: 'documents' },
        })
        return
      }
      if (application.status === 'DRAFT') {
        await router.push({ path: '/services/inspection/renewal/documents', query: { applicationId: application.id } })
        return
      }
      await router.push(`/services/inspection/applications/${application.id}`)
    } catch {
      if (application.status === 'EXPIRED' || application.status === 'INSPECTION_FAILED') {
        actionErrorMessageKey.value = 'inspection_draft_creation_error'
      }
    } finally {
      navigatingApplicationId.value = null
    }
  }

  function actionLabelKey (application: RenewalApplicationListItem): string {
    if (application.status === 'EXPIRED') return 'inspection_renewal_renew_again'
    if (application.status === 'INSPECTION_FAILED') return 'inspection_renewal_apply_again'
    if (application.status === 'CORRECTION_REQUIRED') return 'inspection_application_correct_documents'
    if (application.status === 'DRAFT') return 'inspection_applications_continue'
    return 'inspection_applications_view_details'
  }

  function formatDate (value: string | null): string {
    if (value === null) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return new Intl.DateTimeFormat(locale.value === 'kh' ? 'km-KH' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
  }

  function vehiclePlateLabel (application: RenewalApplicationListItem): string {
    const vehicle = application.vehicle
    if (vehicle === null) return '—'
    if (vehicle.plateCategory === 'PERSONALIZED_CAMBODIA') return [t('inspection_plate_cambodia'), vehicle.plateNumber].filter(Boolean).join(' ') || '—'
    const province = vehicle.plateProvince === 'ភ្នំពេញ' || vehicle.plateProvince?.toLowerCase() === 'phnom penh' ? t('inspection_plate_phnom_penh') : vehicle.plateProvince
    return [province, vehicle.plateNumber].filter(Boolean).join(' ') || '—'
  }

  function vehicleSummary (application: RenewalApplicationListItem): string {
    if (application.vehicle === null) return '—'
    return [application.vehicle.make, application.vehicle.model, application.vehicle.manufactureYear].filter(value => value !== null && value !== '').join(' ') || '—'
  }

  function formatAmount (application: RenewalApplicationListItem): string {
    if (application.payment === null) return '—'
    const amount = Number(application.payment.totalAmount)
    const formattedAmount = Number.isFinite(amount) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount) : application.payment.totalAmount
    return `${formattedAmount} ${application.payment.currency}`
  }

  function statusPresentation (application: RenewalApplicationListItem): StatusPresentation {
    const standardStatuses: Partial<Record<ApplicationStatus, StatusPresentation>> = {
      DRAFT: { color: 'secondary', icon: 'mdi-file-document-edit-outline', labelKey: 'inspection_application_status_draft' },
      SUBMITTED: { color: 'info', icon: 'mdi-clock-outline', labelKey: 'inspection_application_status_under_review' },
      UNDER_REVIEW: { color: 'info', icon: 'mdi-clock-outline', labelKey: 'inspection_application_status_under_review' },
      CORRECTION_REQUIRED: { color: 'warning', icon: 'mdi-pencil-alert-outline', labelKey: 'inspection_application_status_correction_required' },
      APPOINTMENT_SELECTION_REQUIRED: { color: 'warning', icon: 'mdi-calendar-clock-outline', labelKey: 'inspection_application_status_appointment_selection_required' },
      REJECTED: { color: 'error', icon: 'mdi-close-circle-outline', labelKey: 'inspection_application_status_rejected' },
      REINSPECTION_REQUIRED: { color: 'warning', icon: 'mdi-car-wrench', labelKey: 'inspection_application_status_reinspection_required' },
      INSPECTION_FAILED: { color: 'error', icon: 'mdi-alert-circle-outline', labelKey: 'inspection_application_status_inspection_failed' },
      EXPIRED: { color: 'error', icon: 'mdi-calendar-remove-outline', labelKey: 'inspection_application_status_expired' },
      CANCELLED: { color: 'secondary', icon: 'mdi-cancel', labelKey: 'inspection_application_status_cancelled' },
      COMPLETED: { color: 'success', icon: 'mdi-check-circle-outline', labelKey: 'inspection_application_status_completed' },
    }
    if (application.status !== 'APPROVED') return standardStatuses[application.status]!
    if (application.payment?.status === 'REJECTED') return { color: 'error', icon: 'mdi-close-circle-outline', labelKey: 'inspection_application_status_payment_rejected' }
    if (application.payment?.status === 'FAILED') return { color: 'error', icon: 'mdi-alert-circle-outline', labelKey: 'inspection_application_status_payment_failed' }
    if (application.payment?.status === 'PENDING') return { color: 'warning', icon: 'mdi-clock-outline', labelKey: 'inspection_application_status_waiting_payment_confirmation' }
    if (application.inspection?.result === 'FAIL') return { color: 'error', icon: 'mdi-alert-circle-outline', labelKey: 'inspection_application_status_inspection_failed' }
    if (application.inspection?.result === 'PASS') return { color: 'success', icon: 'mdi-check-circle-outline', labelKey: 'inspection_application_status_inspection_passed' }
    if (application.payment?.status === 'CONFIRMED' && application.inspection === null) return { color: 'info', icon: 'mdi-calendar-clock-outline', labelKey: 'inspection_application_status_ready_for_inspection' }
    return { color: 'primary', icon: 'mdi-check-circle-outline', labelKey: 'inspection_application_status_approved' }
  }
</script>

<template>
  <section class="citizen-auth-type-scale inspection-applications-view">
    <header class="applications-heading"><h1>{{ $t('inspection_my_applications') }}</h1><p>{{ $t('inspection_applications_description') }}</p></header>

    <div class="applications-controls">
      <v-select
        :aria-label="$t('inspection_applications_status_filter')"
        class="applications-status-filter"
        density="comfortable"
        hide-details
        item-title="title"
        item-value="value"
        :items="statusOptions"
        :label="$t('inspection_applications_status_filter')"
        :menu-props="{ contentClass: 'applications-status-menu' }"
        :model-value="filterGroup"
        variant="outlined"
        @update:model-value="changeStatus($event)"
      />

      <v-text-field
        v-model="search"
        :aria-label="$t('inspection_applications_search_label')"
        class="applications-search"
        clearable
        density="comfortable"
        hide-details
        :label="$t('inspection_applications_search_label')"
        :placeholder="$t('inspection_applications_search_placeholder')"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
      />
    </div>

    <v-progress-linear v-if="refreshing" class="applications-refresh" color="primary" indeterminate />
    <div v-if="initialLoading && !hasLoaded" class="applications-state"><v-progress-circular color="primary" indeterminate size="42" /><span>{{ $t('loading') }}</span></div>

    <template v-else>
      <v-alert v-if="loadError" class="applications-error" type="error" variant="tonal"><div class="d-flex flex-wrap align-center justify-space-between ga-3">{{ $t('inspection_applications_load_error') }}<v-btn color="error" :loading="refreshing" variant="outlined" @click="retry">{{ $t('retry') }}</v-btn></div></v-alert>

      <v-alert
        v-if="actionErrorMessageKey"
        class="applications-error"
        type="error"
        variant="tonal"
      >{{ $t(actionErrorMessageKey) }}</v-alert>

      <v-card v-if="applications.length > 0" class="applications-list" elevation="0">
        <v-table class="applications-table"><colgroup><col class="applications-table__reference"><col class="applications-table__vehicle"><col class="applications-table__date"><col class="applications-table__status"><col class="applications-table__amount"><col class="applications-table__action"></colgroup><thead><tr><th>{{ $t('inspection_applications_reference') }}</th><th>{{ $t('inspection_applications_vehicle') }}</th><th>{{ $t('inspection_applications_submitted_date') }}</th><th>{{ $t('inspection_applications_status') }}</th><th>{{ $t('inspection_applications_amount') }}</th><th class="text-right">{{ $t('inspection_applications_action') }}</th></tr></thead>

          <tbody><tr v-for="application in applications" :key="application.id"><td class="application-reference">{{ application.referenceNumber ?? '—' }}</td><td><strong>{{ vehiclePlateLabel(application) }}</strong><span class="application-secondary">{{ vehicleSummary(application) }}</span></td><td class="application-submitted-date">{{ formatDate(application.submittedAt) }}</td><td><v-chip :color="statusPresentation(application).color" :prepend-icon="statusPresentation(application).icon" size="small" variant="tonal">{{ $t(statusPresentation(application).labelKey) }}</v-chip></td><td class="application-amount">{{ formatAmount(application) }}</td>

            <td class="text-right"><v-btn
              color="primary"
              :loading="navigatingApplicationId === application.id"
              size="small"
              variant="text"
              @click="openApplication(application)"
            >{{ $t(actionLabelKey(application)) }}</v-btn></td></tr></tbody></v-table>

        <div class="applications-cards"><article v-for="application in applications" :key="application.id" class="application-card"><div class="application-card__top"><strong class="application-reference">{{ application.referenceNumber ?? '—' }}</strong><v-chip :color="statusPresentation(application).color" :prepend-icon="statusPresentation(application).icon" size="small" variant="tonal">{{ $t(statusPresentation(application).labelKey) }}</v-chip></div><div class="application-card__vehicle"><strong>{{ vehiclePlateLabel(application) }}</strong><span>{{ vehicleSummary(application) }}</span></div><dl class="application-card__facts"><div><dt>{{ $t('inspection_applications_submitted_date') }}</dt><dd class="application-submitted-date">{{ formatDate(application.submittedAt) }}</dd></div><div><dt>{{ $t('inspection_applications_amount') }}</dt><dd>{{ formatAmount(application) }}</dd></div></dl>

          <v-btn
            block
            color="primary"
            :loading="navigatingApplicationId === application.id"
            variant="outlined"
            @click="openApplication(application)"
          >{{ $t(actionLabelKey(application)) }}</v-btn></article></div>
      </v-card>

      <v-card v-else-if="hasLoaded && !loadError" class="applications-empty" elevation="0"><v-avatar color="primary" icon="mdi-file-document-outline" size="58" variant="tonal" /><h2>{{ $t(search.trim() || filterGroup !== 'all' ? 'inspection_applications_no_matches_title' : 'inspection_applications_empty_title') }}</h2><p>{{ $t(search.trim() || filterGroup !== 'all' ? 'inspection_applications_no_matches_description' : 'inspection_applications_empty_description') }}</p></v-card>
      <div v-if="hasLoaded && meta && meta.totalPages > 1" class="applications-pagination"><v-pagination :length="meta.totalPages" :model-value="page" @update:model-value="changePage" /></div>
    </template>
  </section>
</template>

<style scoped>
  .inspection-applications-view { padding-bottom: 24px; }.inspection-applications-view :deep(*) { font-weight: 400 !important; }.applications-heading { background: linear-gradient(112deg, #33447f, #27366f); border-radius: 17px; color: #fff; margin-bottom: 28px; min-height: 170px; padding: 34px 42px; }.applications-heading h1 { font-size: clamp(1.65rem, 2.7vw, 2.35rem); font-weight: 800 !important; line-height: 1.18; }.applications-heading p { color: rgba(255, 255, 255, .86); font-size: .98rem; margin-top: 13px; max-width: 760px; }.applications-controls { align-items: center; display: flex; gap: 14px; justify-content: space-between; margin-bottom: 20px; }.applications-status-filter { flex: 0 1 286px; }.applications-search { flex: 0 1 360px; }.applications-refresh { margin: -8px 0 8px; }.applications-state { align-items: center; color: #656776; display: flex; flex-direction: column; gap: 14px; justify-content: center; min-height: 360px; }.applications-error { margin-bottom: 20px; }.applications-list, .applications-empty { border: 1px solid #d4d5de; border-radius: 16px; box-shadow: 0 6px 16px rgba(31, 36, 69, .05); overflow: hidden; }.applications-table { table-layout: fixed; width: 100%; }.applications-table :deep(th) { background: #f7f8fc; color: #535867; font-size: .84rem; font-weight: 800 !important; white-space: nowrap; }.applications-table :deep(td) { color: #252934; font-size: .93rem; font-weight: 600 !important; padding-block: 17px; vertical-align: middle; }.applications-table :deep(tr:last-child td) { border-bottom: 0; }.applications-table :deep(.applications-table__reference) { width: 16%; }.applications-table :deep(.applications-table__vehicle) { width: 27%; }.applications-table :deep(.applications-table__date) { width: 17%; }.applications-table :deep(.applications-table__status) { width: 22%; }.applications-table :deep(.applications-table__amount) { width: 12%; }.applications-table :deep(.applications-table__action) { width: 16%; }.application-reference { color: #273d7a; font-family: 'Siemreap', sans-serif; font-size: .88rem; font-weight: 700 !important; overflow-wrap: anywhere; }.application-secondary { color: #5b5f6d; display: block; font-size: .84rem; font-weight: 600 !important; margin-top: 4px; overflow-wrap: anywhere; }.application-amount { font-variant-numeric: tabular-nums; white-space: nowrap; }.applications-cards { display: none; }.applications-empty { align-items: center; display: flex; flex-direction: column; justify-content: center; min-height: 280px; padding: 30px; text-align: center; }.applications-empty h2 { color: #20212a; font-size: 1.1rem; font-weight: 800 !important; margin-top: 14px; }.applications-empty p { color: #656776; font-size: .9rem; margin-top: 5px; max-width: 480px; }.applications-pagination { display: flex; justify-content: flex-end; margin-top: 24px; }.applications-pagination :deep(.v-pagination__list) { gap: 10px; justify-content: flex-end; }.applications-pagination :deep(.v-pagination__list > li) { margin: 0; }.applications-pagination :deep(.v-pagination__item), .applications-pagination :deep(.v-pagination__prev .v-btn), .applications-pagination :deep(.v-pagination__next .v-btn) { align-items: center; background: #fff; border: 1px solid #d5d7dc; border-radius: 9px; box-shadow: none; color: #20212a; display: inline-flex; font-size: .86rem; font-weight: 800 !important; height: 36px; justify-content: center; min-width: 36px; padding: 0; width: 36px; }.applications-pagination :deep(.v-pagination__item--is-active .v-btn) { background: #293675 !important; border-color: #293675 !important; color: #fff !important; opacity: 1 !important; } @media (max-width: 900px) { .applications-table { display: none; }.applications-cards { display: grid; gap: 0; }.application-card { border-bottom: 1px solid #e0e2e8; display: grid; gap: 15px; padding: 20px; }.application-card:last-child { border-bottom: 0; }.application-card__top { align-items: flex-start; display: flex; gap: 12px; justify-content: space-between; }.application-card__vehicle { display: grid; gap: 4px; }.application-card__vehicle strong { color: #252934; font-weight: 800 !important; overflow-wrap: anywhere; }.application-card__vehicle span { color: #5b5f6d; font-size: .88rem; font-weight: 600 !important; }.application-card__facts { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }.application-card__facts div { display: grid; gap: 3px; }.application-card__facts dt { color: #727687; font-size: .75rem; font-weight: 800 !important; }.application-card__facts dd { color: #252934; font-size: .9rem; font-weight: 700 !important; margin: 0; overflow-wrap: anywhere; }.applications-pagination { justify-content: center; } } @media (max-width: 600px) { .applications-heading { border-radius: 14px; margin-bottom: 22px; min-height: 0; padding: 26px 22px; }.applications-heading p { font-size: .9rem; }.applications-controls { align-items: stretch; flex-direction: column; }.applications-status-filter, .applications-search { flex-basis: auto; width: 100%; }.applications-pagination :deep(.v-pagination__list) { gap: 5px; }.applications-pagination :deep(.v-pagination__item), .applications-pagination :deep(.v-pagination__prev .v-btn), .applications-pagination :deep(.v-pagination__next .v-btn) { height: 34px; min-width: 34px; width: 34px; } }

  .applications-heading h1 { font-size: clamp(1.35rem, 2vw, 1.72rem); font-weight: 400 !important; }
  .applications-heading p { font-size: .94rem; }
  .applications-state, .applications-error { font-size: .94rem; }
  .applications-controls :deep(.v-field-label) { font-size: .86rem; }
  .applications-status-filter :deep(.v-select__selection-text), .applications-search :deep(.v-field__input) { font-size: .94rem; }
  .applications-table :deep(th) { font-size: .88rem; }
  .applications-table :deep(td) { font-size: .94rem; }
  .application-reference { font-size: .86rem; }
  .application-secondary { font-size: .86rem; }
  .applications-list :deep(.v-chip), .applications-cards :deep(.v-chip) { font-size: .84rem; }
  .applications-list :deep(.v-btn), .applications-cards :deep(.v-btn) { font-size: .86rem; }
  .applications-empty h2 { font-size: 1.05rem; }
  .applications-empty p { font-size: .94rem; }
  .applications-pagination :deep(.v-pagination__item), .applications-pagination :deep(.v-pagination__prev .v-btn), .applications-pagination :deep(.v-pagination__next .v-btn) { font-size: .86rem; }
  .applications-pagination :deep(.v-pagination__item .v-btn), .applications-pagination :deep(.v-pagination__prev .v-btn), .applications-pagination :deep(.v-pagination__next .v-btn) { height: 36px !important; max-height: 36px !important; max-width: 36px !important; min-height: 36px !important; min-width: 36px !important; padding: 0 !important; width: 36px !important; }
  .applications-table :deep(th) { font-weight: 600 !important; }
  .applications-table :deep(td) { font-weight: 400 !important; }
  .applications-table :deep(td.application-reference), .applications-table :deep(td.application-amount) { font-weight: 400 !important; }
  .application-secondary, .applications-list :deep(.v-chip), .applications-list :deep(.v-btn) { font-weight: 400 !important; }
  .applications-empty h2 { font-weight: 600 !important; }
  .applications-pagination :deep(.v-pagination__item .v-btn), .applications-pagination :deep(.v-pagination__prev .v-btn), .applications-pagination :deep(.v-pagination__next .v-btn) { font-weight: 600 !important; }
  .inspection-applications-view .applications-controls .applications-status-filter :deep(.v-select__selection-text),
  .inspection-applications-view .applications-controls .applications-search :deep(.v-field__input) { font-size: .9rem !important; }
  .inspection-applications-view .applications-list .applications-table :deep(th) { font-size: .85rem !important; font-weight: 400 !important; }
  .inspection-applications-view .application-submitted-date { color: #2a3472 !important; }

  @media (max-width: 900px) {
    .application-card__top .application-reference, .application-card__facts > div:last-child dd { font-weight: 400 !important; }
    .application-card__vehicle strong, .application-card__vehicle span, .application-card__facts dt, .application-card__facts dd, .applications-cards :deep(.v-chip), .applications-cards :deep(.v-btn) { font-weight: 400 !important; }
    .application-card__vehicle strong { font-size: .96rem; }
    .application-card__vehicle span { font-size: .9rem; }
    .application-card__facts dt { font-size: .8rem; }
    .application-card__facts dd { font-size: .94rem; }
  }

  @media (max-width: 600px) {
    .applications-heading p { font-size: .94rem; }
  }
</style>

<style>
  .applications-status-menu .v-list-item-title { font-size: .9rem !important; }
</style>
