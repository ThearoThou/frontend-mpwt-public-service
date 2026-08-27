<script setup lang="ts">
  import type { CitizenPaymentInvoice, RenewalApplication } from '../applications/types/application.types'
  import type { Vehicle } from '../vehicles/types/vehicle.types'
  import { isAxiosError } from 'axios'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { inspectionApplicationService } from '../applications/services/application.service'
  import { inspectionVehicleService } from '../vehicles/services/vehicle.service'
  import OfficialPaymentInvoice from './components/OfficialPaymentInvoice.vue'

  type ApiErrorResponse = { code?: string }
  const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const applicationId = computed(() => typeof route.query.applicationId === 'string' ? route.query.applicationId : '')
  const application = ref<RenewalApplication | null>(null)
  const invoice = ref<CitizenPaymentInvoice | null>(null)
  const vehicle = ref<Vehicle | null>(null)
  const loading = ref(true)
  const submitting = ref(false)
  const errorMessage = ref('')
  let invoiceInitialization: Promise<void> | null = null
  const canSubmit = computed(() => application.value?.status === 'DRAFT' && invoice.value !== null && !submitting.value)

  function paymentErrorMessage (error: unknown): string {
    if (!isAxiosError<ApiErrorResponse>(error)) return t('inspection_payment_submit_error')
    return {
      REQUIRED_DOCUMENTS_MISSING: t('inspection_review_documents_missing'),
      REQUIRED_DOCUMENTS_NOT_READY: t('inspection_review_documents_rejected'),
      CITIZEN_PROFILE_REQUIRED: t('inspection_review_profile_required'),
      APPLICATION_INVALID_TRANSITION: t('inspection_payment_not_editable'),
      PAYMENT_STEP_FOUR_REQUIRED: t('inspection_payment_invoice_required'),
      CONFLICT: t('inspection_review_schedule_unavailable'),
    }[error.response?.data?.code ?? ''] ?? t('inspection_payment_submit_error')
  }

  function paymentLoadErrorMessage (error: unknown): string {
    if (!isAxiosError<ApiErrorResponse>(error)) return t('inspection_payment_load_error')

    return {
      APPLICATION_NOT_FOUND: t('inspection_payment_invalid_application_link'),
      RESOURCE_NOT_OWNED: t('inspection_payment_invalid_application_link'),
      APPLICATION_INVALID_TRANSITION: t('inspection_payment_not_editable'),
    }[error.response?.data?.code ?? ''] ?? t('inspection_payment_load_error')
  }

  async function initializeInvoice (): Promise<void> {
    if (!application.value || invoice.value !== null || submitting.value) return
    if (invoiceInitialization !== null) return invoiceInitialization

    errorMessage.value = ''
    const request = inspectionApplicationService.initializePayment(application.value.id)
      .then(paymentInvoice => {
        invoice.value = paymentInvoice
      })
      .catch((error: unknown) => {
        errorMessage.value = paymentErrorMessage(error)
      })
      .finally(() => {
        invoiceInitialization = null
      })
    invoiceInitialization = request
    return request
  }

  async function load () {
    if (!UUID_V4_PATTERN.test(applicationId.value)) {
      errorMessage.value = t('inspection_payment_invalid_application_link')
      loading.value = false
      return
    }
    try {
      const draft = await inspectionApplicationService.getById(applicationId.value)
      if (draft.status !== 'DRAFT') {
        await router.replace({ path: draft.status === 'SUBMITTED' ? '/services/inspection/renewal/confirmation' : `/services/inspection/applications/${draft.id}`, query: draft.status === 'SUBMITTED' ? { applicationId: draft.id } : undefined })
        return
      }
      application.value = draft
      vehicle.value = await inspectionVehicleService.getById(draft.vehicleId)
      await initializeInvoice()
    } catch (error) {
      errorMessage.value = paymentLoadErrorMessage(error)
    } finally {
      loading.value = false
    }
  }

  async function confirmAndSubmit () {
    if (!application.value || !canSubmit.value) return
    submitting.value = true
    errorMessage.value = ''
    try {
      const submittedApplication = await inspectionApplicationService.submitDraft(application.value.id)
      await router.replace({ path: '/services/inspection/renewal/confirmation', query: { applicationId: submittedApplication.id } })
    } catch (error) {
      errorMessage.value = paymentErrorMessage(error)
    } finally {
      submitting.value = false
    }
  }

  function routeTo (path: string) {
    void router.push({ path, query: { applicationId: applicationId.value } })
  }

  onMounted(load)
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <section class="renewal-payment mx-auto">
    <header class="renewal-payment__heading"><v-breadcrumbs :aria-label="$t('inspection_payment_breadcrumb_label')" class="renewal-breadcrumbs px-0 pb-5" density="compact"><v-breadcrumbs-item to="/services/inspection/dashboard">{{ $t('inspection_dashboard') }}</v-breadcrumbs-item><v-breadcrumbs-divider icon="mdi-chevron-right" /><v-breadcrumbs-item active active-color="primary" class="renewal-breadcrumbs__current">{{ $t('inspection_documents_wizard_payment') }}</v-breadcrumbs-item></v-breadcrumbs><h1 class="text-h5 font-weight-bold mb-2">{{ $t('inspection_payment_title') }}</h1><p class="text-medium-emphasis mb-0">{{ $t('inspection_payment_description') }}</p></header>
    <v-alert v-if="errorMessage" class="mb-5" type="error">{{ errorMessage }}</v-alert><v-progress-linear v-if="loading" color="primary" indeterminate />
    <template v-else-if="application">
      <section :aria-label="$t('inspection_documents_wizard_label')" class="renewal-stepper mb-6"><div class="renewal-stepper__steps"><button class="renewal-stepper__step is-complete is-clickable" type="button" @click="routeTo('/services/inspection/renewal/documents')"><span class="renewal-stepper__number"><v-icon icon="mdi-check" size="17" /></span><span class="renewal-stepper__label">{{ $t('inspection_documents_wizard_documents') }}</span></button><button class="renewal-stepper__step is-complete is-clickable" type="button" @click="routeTo('/services/inspection/renewal/scheduling')"><span class="renewal-stepper__number"><v-icon icon="mdi-check" size="17" /></span><span class="renewal-stepper__label">{{ $t('inspection_documents_wizard_service_fee') }}</span></button><button class="renewal-stepper__step is-complete is-clickable" type="button" @click="routeTo('/services/inspection/renewal/review')"><span class="renewal-stepper__number"><v-icon icon="mdi-check" size="17" /></span><span class="renewal-stepper__label">{{ $t('inspection_documents_wizard_review') }}</span></button><div class="renewal-stepper__step is-active"><span class="renewal-stepper__number">4</span><span class="renewal-stepper__label">{{ $t('inspection_documents_wizard_payment') }}</span></div></div></section>
      <v-row><v-col cols="12" md="8"><v-card border class="mb-5 pa-5 pa-md-6" elevation="0" rounded="xl"><div class="d-flex align-center ga-3 mb-5"><v-avatar color="primary" size="42" variant="tonal"><v-icon icon="mdi-wallet-outline" /></v-avatar><div><h2 class="text-h6 font-weight-bold mb-1">{{ $t('inspection_payment_method_title') }}</h2><p class="text-body-2 text-medium-emphasis mb-0">{{ $t('inspection_payment_method_description') }}</p></div></div><div class="payment-methods"><button class="payment-method payment-method--selected" type="button" @click="initializeInvoice"><v-icon color="primary" icon="mdi-storefront-outline" size="30" /><span><strong>{{ $t('inspection_payment_pay_at_station') }}</strong><small>{{ $t('inspection_payment_pay_at_station_copy') }}</small></span><v-icon color="primary" icon="mdi-check-circle" /></button><div aria-disabled="true" class="payment-method payment-method--disabled"><v-icon icon="mdi-credit-card-outline" size="30" /><span><strong>{{ $t('inspection_payment_online_title') }}</strong><small>{{ $t('inspection_payment_online_copy') }}</small></span><v-chip size="x-small" variant="tonal">{{ $t('inspection_payment_coming_later') }}</v-chip></div></div></v-card>
        <v-alert class="mb-5" density="comfortable" icon="mdi-information-outline" type="warning" variant="tonal">{{ $t('inspection_payment_pay_later_notice') }}</v-alert>
        <div v-if="invoice && vehicle"><OfficialPaymentInvoice :invoice="invoice" :submitted-at="application.submittedAt" :vehicle="vehicle" /></div><v-alert v-else type="warning" variant="tonal">{{ $t('inspection_payment_invoice_required') }}</v-alert>
        <div class="d-flex justify-space-between align-start mt-6"><v-btn prepend-icon="mdi-arrow-left" variant="outlined" @click="routeTo('/services/inspection/renewal/review')">{{ $t('inspection_documents_back') }}</v-btn><div class="payment-submit-action"><div class="d-flex justify-end ga-2"><v-btn append-icon="mdi-check" color="primary" :disabled="!canSubmit" :loading="submitting" @click="confirmAndSubmit">{{ $t('inspection_payment_confirm_submit') }}</v-btn></div><p class="text-caption text-medium-emphasis mt-2 mb-0">{{ $t('inspection_payment_confirm_submit_copy') }}</p></div></div>
      </v-col><v-col cols="12" md="4"><aside class="d-flex flex-column ga-5 renewal-payment__sidebar"><v-card class="renewal-progress-card pa-5 text-white" elevation="0" rounded="xl"><p class="text-body-1 font-weight-medium mb-1">{{ $t('inspection_documents_application_progress') }}</p><div class="text-h3 font-weight-bold">87<span class="text-h6">%</span></div><v-progress-linear bg-color="white" class="mt-4" color="white" :model-value="87" rounded /><p class="text-body-2 mt-2 mb-0">{{ $t('inspection_payment_step_four_of_four') }}</p></v-card><v-card border class="pa-5" elevation="0" rounded="xl"><div class="d-flex ga-3"><v-icon color="warning" icon="mdi-information-outline" /><div><h2 class="text-body-1 font-weight-bold mb-2">{{ $t('inspection_payment_review_help_title') }}</h2><p class="text-body-2 text-medium-emphasis mb-0">{{ $t('inspection_payment_review_help') }}</p></div></div></v-card></aside></v-col></v-row>
    </template>
  </section>
</template>

<style scoped>
  .renewal-payment { max-width: 1120px; padding-bottom: 36px; }.renewal-payment__heading { margin-bottom: 24px; }.renewal-breadcrumbs :deep(.v-breadcrumbs-item--link) { color: #697080; }.renewal-breadcrumbs :deep(.renewal-breadcrumbs__current) { background: #e9ebf8; border-radius: 999px; color: #2a3472; font-weight: 700; padding: 4px 10px; }.renewal-stepper { background: #fff; border: 1px solid #e3e5eb; border-radius: 14px; padding: 12px 28px 10px; }.renewal-stepper__steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }.renewal-stepper__step { align-items: center; color: #7c8190; display: flex; flex-direction: column; font-size: .78rem; gap: 4px; position: relative; text-align: center; }.renewal-stepper__step:not(:last-child)::after { background: #e5e7ed; content: ''; height: 2px; left: 50%; position: absolute; right: -50%; top: 13px; z-index: 0; }.renewal-stepper__step.is-clickable { background: transparent; border: 0; cursor: pointer; font: inherit; padding: 0; }.renewal-stepper__number { align-items: center; background: #ebedf2; border-radius: 50%; display: inline-flex; font-weight: 700; height: 26px; justify-content: center; position: relative; width: 26px; z-index: 1; }.renewal-stepper__step.is-active { color: #202746; font-weight: 700; }.renewal-stepper__step.is-active .renewal-stepper__label { font-size: .95rem; font-weight: 800; }.renewal-stepper__step.is-active .renewal-stepper__number, .renewal-stepper__step.is-complete .renewal-stepper__number { background: rgb(var(--v-theme-primary)); color: #fff; }.renewal-stepper__step.is-complete:not(:last-child)::after { background: rgb(var(--v-theme-primary)); }.payment-methods { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }.payment-method { align-items: center; background: #fafaff; border: 1px solid #e3e5eb; border-radius: 12px; color: inherit; display: flex; gap: 13px; min-height: 112px; padding: 16px; text-align: left; }.payment-method span { display: flex; flex: 1; flex-direction: column; gap: 4px; }.payment-method--selected { background: #f0ecff; border: 2px solid rgb(var(--v-theme-primary)); cursor: pointer; }.payment-method--disabled { color: #777d8b; opacity: .68; }.renewal-progress-card { background: #2c3678; }.renewal-progress-card :deep(.v-progress-linear__background) { opacity: .28; }.payment-submit-action { max-width: 410px; text-align: right; }.renewal-payment__sidebar { position: sticky; top: 24px; } @media (max-width: 959px) { .renewal-payment { max-width: 760px; }.renewal-payment__sidebar { position: static; } } @media (max-width: 599px) { .renewal-payment { padding-bottom: 24px; }.renewal-stepper { padding: 12px 8px 10px; }.renewal-stepper__label { font-size: .7rem; }.payment-methods { grid-template-columns: 1fr; }.payment-submit-action { max-width: 100%; } }
</style>
