<script setup lang="ts">
  import type { CurrentUser } from '../../auth/types/auth.types'
  import type { CitizenPaymentInvoice, CitizenPaymentRecord, RenewalApplication } from '../applications/types/application.types'
  import type { Vehicle } from '../vehicles/types/vehicle.types'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { inspectionAuthService } from '../../auth/services/auth.service'
  import { inspectionApplicationService } from '../applications/services/application.service'
  import { inspectionVehicleService } from '../vehicles/services/vehicle.service'
  import InspectionTechnicalForm from './components/InspectionTechnicalForm.vue'
  import OfficialPaymentInvoice from './components/OfficialPaymentInvoice.vue'
  import { downloadDocumentPdf } from './utils/download-document-pdf'

  const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const applicationId = computed(() => typeof route.query.applicationId === 'string' ? route.query.applicationId : '')
  const application = ref<RenewalApplication | null>(null)
  const invoice = ref<CitizenPaymentInvoice | null>(null)
  const vehicle = ref<Vehicle | null>(null)
  const loading = ref(true)
  const errorMessage = ref('')
  const downloadingInvoice = ref(false)
  const downloadingForm = ref(false)
  const invoiceElement = ref<HTMLElement | null>(null)
  const formElement = ref<HTMLElement | null>(null)

  function makeInvoice (payment: CitizenPaymentRecord, submittedApplication: RenewalApplication, vehicle: Vehicle, citizen: CurrentUser): CitizenPaymentInvoice {
    return {
      ...payment,
      applicationReferenceNumber: submittedApplication.referenceNumber,
      preferredInspectionStationId: submittedApplication.preferredInspectionStationId,
      preferredInspectionDate: submittedApplication.preferredInspectionDate,
      vehicle: {
        registrationNumber: vehicle.registrationNumber,
        plateNumber: vehicle.plateNumber,
        plateCategory: vehicle.plateCategory,
        plateProvince: vehicle.plateProvince,
        plateType: vehicle.vehicleType,
        make: vehicle.make,
        model: vehicle.model,
        manufactureYear: vehicle.manufactureYear,
        chassisNumber: vehicle.chassisNumber,
      },
      applicant: {
        nameKh: citizen.citizenProfile?.nameKh ?? null,
        nameEn: citizen.citizenProfile?.nameEn ?? null,
        phone: citizen.user.phone,
      },
    }
  }

  async function load () {
    if (!UUID_V4_PATTERN.test(applicationId.value)) {
      errorMessage.value = t('inspection_confirmation_invalid_application_link')
      loading.value = false
      return
    }
    try {
      const submittedApplication = await inspectionApplicationService.getById(applicationId.value)
      if (submittedApplication.status === 'DRAFT') {
        await router.replace({ path: '/services/inspection/renewal/payment', query: { applicationId: submittedApplication.id } })
        return
      }
      const [payment, selectedVehicle, citizen] = await Promise.all([
        inspectionApplicationService.getPayment(submittedApplication.id),
        inspectionVehicleService.getById(submittedApplication.vehicleId),
        inspectionAuthService.getCurrentUser(),
      ])
      application.value = submittedApplication
      vehicle.value = selectedVehicle
      invoice.value = makeInvoice(payment, submittedApplication, selectedVehicle, citizen)
    } catch {
      errorMessage.value = t('inspection_confirmation_load_error')
    } finally {
      loading.value = false
    }
  }

  async function downloadInvoice () {
    if (!invoiceElement.value || !invoice.value) return
    downloadingInvoice.value = true
    try {
      await downloadDocumentPdf(invoiceElement.value, `${invoice.value.invoiceNumber}.pdf`)
    } finally {
      downloadingInvoice.value = false
    }
  }

  async function downloadForm () {
    if (!formElement.value || !invoice.value) return
    downloadingForm.value = true
    try {
      await downloadDocumentPdf(formElement.value, `${invoice.value.invoiceNumber}-inspection-form.pdf`)
    } finally {
      downloadingForm.value = false
    }
  }

  onMounted(load)
</script>

<template>
  <section class="renewal-confirmation mx-auto">
    <v-alert v-if="errorMessage" type="error">{{ errorMessage }}</v-alert><v-progress-linear v-else-if="loading" color="primary" indeterminate />

    <template v-else-if="application && invoice && vehicle">
      <v-card border class="renewal-confirmation__hero mx-auto pa-7 pa-md-10 text-center" elevation="0" rounded="xl"><v-avatar color="success" size="72" variant="tonal"><v-icon icon="mdi-check" size="42" /></v-avatar><h1 class="text-h4 font-weight-bold mt-5 mb-3">{{ $t('inspection_confirmation_title') }}</h1><p class="text-body-1 text-medium-emphasis mx-auto mb-0">{{ $t('inspection_confirmation_description') }}</p></v-card>

      <v-card border class="renewal-confirmation__details mx-auto mt-6 pa-5 pa-md-6" elevation="0" rounded="xl"><div class="confirmation-row"><span>{{ $t('inspection_confirmation_reference') }}</span><strong>{{ application.referenceNumber || '—' }}</strong></div><div class="confirmation-row"><span>{{ $t('inspection_confirmation_application_status') }}</span><strong class="text-primary">{{ $t('inspection_confirmation_submitted') }}</strong></div><div class="confirmation-row"><span>{{ $t('inspection_confirmation_payment_method') }}</span><strong>{{ $t('inspection_payment_pay_at_station') }}</strong></div><div class="confirmation-row confirmation-row--last"><span>{{ $t('inspection_confirmation_payment') }}</span><strong class="confirmation-row__pending">{{ $t('inspection_confirmation_payment_pending') }}</strong></div>

        <v-alert
          class="mt-5"
          density="comfortable"
          icon="mdi-information-outline"
          type="info"
          variant="tonal"
        >{{ $t('inspection_confirmation_review_notice') }}</v-alert></v-card>

      <div ref="invoiceElement" class="mt-7"><OfficialPaymentInvoice :invoice="invoice" :submitted-at="application.submittedAt" :vehicle="vehicle" /></div>
      <div ref="formElement" class="mt-7"><InspectionTechnicalForm :invoice="invoice" :vehicle="vehicle" /></div>
      <div class="renewal-confirmation__actions mx-auto mt-6"><v-btn :to="`/services/inspection/applications/${application.id}`" variant="outlined">{{ $t('inspection_confirmation_view_application') }}</v-btn><v-btn :loading="downloadingInvoice" prepend-icon="mdi-download" variant="outlined" @click="downloadInvoice">{{ $t('inspection_confirmation_download_invoice') }}</v-btn><v-btn color="primary" :loading="downloadingForm" prepend-icon="mdi-download" @click="downloadForm">{{ $t('inspection_confirmation_download_form') }}</v-btn></div>
    </template>
  </section>
</template>

<style scoped>
  .renewal-confirmation { max-width: 900px; padding: 56px 0; }.renewal-confirmation__hero { background: linear-gradient(135deg, #ffffff 0%, #f6f8ff 100%); }.renewal-confirmation__hero p { max-width: 590px; }.renewal-confirmation__details { max-width: 720px; }.confirmation-row { align-items: center; border-bottom: 1px solid #e6e8ee; display: flex; gap: 20px; justify-content: space-between; padding: 15px 0; }.confirmation-row span { color: #707687; }.confirmation-row--last { border-bottom: 0; }.confirmation-row__pending { color: #b45309; }.renewal-confirmation__actions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; } @media (max-width: 599px) { .renewal-confirmation { padding: 32px 0; }.renewal-confirmation__actions { align-items: stretch; flex-direction: column; }.renewal-confirmation__actions :deep(.v-btn) { width: 100%; } }
</style>
