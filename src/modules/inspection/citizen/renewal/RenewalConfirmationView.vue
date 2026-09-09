<script setup lang="ts">
  import type { CurrentUser } from '../../auth/types/auth.types'
  import type { CitizenPaymentInvoice, CitizenPaymentRecord, RenewalApplication } from '../applications/types/application.types'
  import type { Vehicle } from '../vehicles/types/vehicle.types'
  import type { InspectionStation } from './services/scheduling.service'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { inspectionAuthService } from '../../auth/services/auth.service'
  import { inspectionApplicationService } from '../applications/services/application.service'
  import { inspectionVehicleService } from '../vehicles/services/vehicle.service'
  import InspectionTechnicalForm from './components/InspectionTechnicalForm.vue'
  import OfficialPaymentInvoice from './components/OfficialPaymentInvoice.vue'
  import { inspectionSchedulingService } from './services/scheduling.service'

  const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const applicationId = computed(() => typeof route.query.applicationId === 'string' ? route.query.applicationId : '')
  const application = ref<RenewalApplication | null>(null)
  const invoice = ref<CitizenPaymentInvoice | null>(null)
  const vehicle = ref<Vehicle | null>(null)
  const preferredStation = ref<InspectionStation | null>(null)
  const loading = ref(true)
  const errorMessage = ref('')
  const downloadingDocuments = ref(false)
  const invoiceElement = ref<HTMLElement | null>(null)
  const formElement = ref<HTMLElement | null>(null)
  const paymentIsConfirmed = computed(() => invoice.value?.status === 'CONFIRMED')

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
      const [payment, selectedVehicle, citizenUser, selectedStation] = await Promise.all([
        inspectionApplicationService.getPayment(submittedApplication.id),
        inspectionVehicleService.getById(submittedApplication.vehicleId),
        inspectionAuthService.getCurrentUser(),
        submittedApplication.preferredInspectionStationId === null
          ? Promise.resolve(null)
          : inspectionSchedulingService.getStationById(submittedApplication.preferredInspectionStationId),
      ])
      application.value = submittedApplication
      vehicle.value = selectedVehicle
      preferredStation.value = selectedStation
      invoice.value = makeInvoice(payment, submittedApplication, selectedVehicle, citizenUser)
    } catch {
      errorMessage.value = t('inspection_confirmation_load_error')
    } finally {
      loading.value = false
    }
  }

  async function downloadDocuments () {
    if (downloadingDocuments.value || !invoiceElement.value || !formElement.value || !invoice.value) return

    downloadingDocuments.value = true
    errorMessage.value = ''
    try {
      const { downloadDocumentsPdf } = await import('./utils/download-document-pdf')
      await downloadDocumentsPdf(
        [invoiceElement.value, formElement.value],
        `${invoice.value.invoiceNumber}-documents.pdf`,
      )
    } catch {
      errorMessage.value = t('inspection_confirmation_download_error')
    } finally {
      downloadingDocuments.value = false
    }
  }

  onMounted(load)
</script>

<template>
  <section class="renewal-confirmation mx-auto">
    <v-alert v-if="errorMessage" type="error">{{ errorMessage }}</v-alert><v-progress-linear v-if="loading" color="primary" indeterminate />

    <template v-if="!loading && application && invoice && vehicle">
      <v-card border class="renewal-confirmation__hero mx-auto pa-7 pa-md-10 text-center" elevation="0" rounded="xl"><v-avatar color="success" size="72" variant="tonal"><v-icon icon="mdi-check" size="42" /></v-avatar><h1 class="text-h4 font-weight-regular mt-5 mb-3">{{ $t('inspection_confirmation_title') }}</h1><p class="text-body-1 text-medium-emphasis mx-auto mb-0">{{ $t('inspection_confirmation_description') }}</p></v-card>

      <v-card border class="renewal-confirmation__details mx-auto mt-6 pa-5 pa-md-6" elevation="0" rounded="xl"><div class="confirmation-row"><span>{{ $t('inspection_confirmation_reference') }}</span><strong>{{ application.referenceNumber || '—' }}</strong></div><div class="confirmation-row"><span>{{ $t('inspection_confirmation_application_status') }}</span><strong class="text-primary">{{ $t('inspection_confirmation_submitted') }}</strong></div><div class="confirmation-row"><span>{{ $t('inspection_confirmation_payment_method') }}</span><strong>{{ $t('inspection_payment_pay_at_station') }}</strong></div><div class="confirmation-row confirmation-row--last"><span>{{ $t('inspection_confirmation_payment') }}</span><strong :class="paymentIsConfirmed ? 'confirmation-row__confirmed' : 'confirmation-row__pending'">{{ $t(paymentIsConfirmed ? 'inspection_payment_payment_status_confirmed' : 'inspection_payment_payment_status_waiting_confirmation') }}</strong></div>

      </v-card>

      <v-alert
        v-if="paymentIsConfirmed"
        class="payment-confirmation-status mx-auto mt-6"
        icon="mdi-check-circle-outline"
        type="success"
        variant="tonal"
      >
        <p class="font-weight-bold mb-1">{{ $t('inspection_payment_confirmed_title') }}</p>

        <p class="mb-0">{{ $t('inspection_payment_confirmed_copy') }}</p>
      </v-alert>

      <div ref="invoiceElement" class="mt-7"><OfficialPaymentInvoice :invoice="invoice" :preferred-station="preferredStation" :vehicle="vehicle" /></div>
      <div ref="formElement" class="mt-7"><InspectionTechnicalForm :invoice="invoice" :vehicle="vehicle" /></div>

      <div class="renewal-confirmation__actions mx-auto mt-6"><div class="d-flex flex-wrap ga-3"><v-btn to="/services/inspection/dashboard" variant="outlined">{{ $t('inspection_confirmation_return_dashboard') }}</v-btn>

                                                                <v-btn
                                                                  class="confirmation-download-button"
                                                                  :disabled="downloadingDocuments"
                                                                  :loading="downloadingDocuments"
                                                                  prepend-icon="mdi-download"
                                                                  @click="downloadDocuments"
                                                                >{{ $t('inspection_confirmation_download_documents') }}</v-btn></div>

        <v-btn :to="`/services/inspection/applications/${application.id}`" variant="outlined">{{ $t('inspection_confirmation_view_application') }}</v-btn></div>
    </template>
  </section>
</template>

<style scoped>
  .renewal-confirmation { max-width: 900px; padding: 56px 0; }.renewal-confirmation__hero { background: linear-gradient(135deg, #ffffff 0%, #f6f8ff 100%); }.renewal-confirmation__hero p { font-size: 1rem; max-width: 590px; }.renewal-confirmation__details, .payment-confirmation-status { max-width: 720px; }.confirmation-row { align-items: center; border-bottom: 1px solid #e6e8ee; display: flex; gap: 20px; justify-content: space-between; padding: 15px 0; }.confirmation-row span, .confirmation-row strong { font-size: 1rem; }.confirmation-row span { color: #707687; }.confirmation-row--last { border-bottom: 0; }.confirmation-row__pending { color: #b45309; }.confirmation-row__confirmed { color: #18733a; }.renewal-confirmation__actions { align-items: center; display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }.renewal-confirmation__actions :deep(.v-btn__content) { letter-spacing: 0; text-transform: none; }.confirmation-download-button { background: #2a3472 !important; color: #fff !important; } @media (max-width: 599px) { .renewal-confirmation { padding: 32px 0; }.renewal-confirmation__actions { align-items: stretch; flex-direction: column; }.renewal-confirmation__actions :deep(.v-btn) { width: 100%; } }
</style>
