<script setup lang="ts">
  import type { CurrentUser } from '../../../auth/types/auth.types'
  import type { InspectionStation } from '../../renewal/services/scheduling.service'
  import type { Vehicle } from '../../vehicles/types/vehicle.types'
  import type { CitizenPaymentInvoice, CitizenPaymentRecord, PaymentStatus, RenewalApplicationDetail } from '../types/application.types'
  import { isAxiosError } from 'axios'
  import { inspectionAuthService } from '../../../auth/services/auth.service'
  import OfficialPaymentInvoice from '../../renewal/components/OfficialPaymentInvoice.vue'
  import { inspectionSchedulingService } from '../../renewal/services/scheduling.service'
  import { formatVehiclePlate } from '../../renewal/utils/vehicle-display'
  import { inspectionVehicleService } from '../../vehicles/services/vehicle.service'
  import { inspectionApplicationService } from '../services/application.service'

  type ApiErrorResponse = { code?: string }
  const props = defineProps<{ active: boolean, application: RenewalApplicationDetail }>()
  const payment = ref<CitizenPaymentRecord | null>(null)
  const officialInvoice = ref<CitizenPaymentInvoice | null>(null)
  const vehicle = ref<Vehicle | null>(null)
  const preferredStation = ref<InspectionStation | null>(null)
  const loading = ref(false)
  const loaded = ref(false)
  const loadError = ref(false)
  const invoiceElement = ref<HTMLElement | null>(null)
  const downloadingInvoice = ref(false)
  const downloadErrorKey = ref('')
  const displayedStatusKey = computed(() => {
    if (props.application.status === 'CANCELLED') return 'inspection_application_status_cancelled'
    return payment.value === null ? '' : paymentStatusKey(payment.value.status)
  })
  const displayedStatusColor = computed(() => {
    if (props.application.status === 'CANCELLED') return 'secondary'
    return payment.value === null ? 'secondary' : paymentStatusColor(payment.value.status)
  })
  const displayedStatusIcon = computed(() => {
    if (props.application.status === 'CANCELLED') return 'mdi-cancel'
    return payment.value === null ? 'mdi-help-circle-outline' : paymentStatusIcon(payment.value.status)
  })
  const displayedStatusClass = computed(() => {
    if (props.application.status === 'CANCELLED' || payment.value === null) {
      return 'official-invoice-preview__status--secondary'
    }
    return `official-invoice-preview__status--${payment.value.status.toLowerCase()}`
  })

  watch(() => [props.active, props.application.id] as const, ([active, applicationId], previous) => {
    if (previous?.[1] !== undefined && previous[1] !== applicationId) {
      payment.value = null
      officialInvoice.value = null
      vehicle.value = null
      preferredStation.value = null
      loaded.value = false
      loadError.value = false
      downloadErrorKey.value = ''
    }
    if (active && !loaded.value && !loading.value) void loadPayment()
  }, { immediate: true })

  function paymentStatusKey (status: PaymentStatus): string {
    return {
      CONFIRMED: 'inspection_payment_payment_status_confirmed',
      PENDING: 'inspection_payment_payment_status_waiting_confirmation',
      REJECTED: 'inspection_application_status_payment_rejected',
    }[status]
  }

  function paymentStatusColor (status: PaymentStatus): string {
    if (status === 'CONFIRMED') return '#15803d'
    if (status === 'PENDING') return '#c25f00'
    return 'error'
  }

  function paymentStatusIcon (status: PaymentStatus): string {
    return {
      CONFIRMED: 'mdi-check-circle-outline',
      PENDING: 'mdi-clock-outline',
      REJECTED: 'mdi-close-circle-outline',
    }[status]
  }

  function isMissingPayment (error: unknown): boolean {
    return isAxiosError<ApiErrorResponse>(error) && error.response?.data?.code === 'PAYMENT_NOT_FOUND'
  }

  function makeInvoice (paymentRecord: CitizenPaymentRecord, selectedVehicle: Vehicle, citizen: CurrentUser): CitizenPaymentInvoice {
    return {
      ...paymentRecord,
      applicationReferenceNumber: props.application.referenceNumber,
      preferredInspectionStationId: props.application.preferredInspectionStationId,
      preferredInspectionDate: props.application.preferredInspectionDate,
      vehicle: {
        registrationNumber: selectedVehicle.registrationNumber,
        plateNumber: selectedVehicle.plateNumber,
        plateCategory: selectedVehicle.plateCategory,
        plateProvince: selectedVehicle.plateProvince,
        plateType: selectedVehicle.vehicleType,
        make: selectedVehicle.make,
        model: selectedVehicle.model,
        manufactureYear: selectedVehicle.manufactureYear,
        chassisNumber: selectedVehicle.chassisNumber,
        engineNumber: props.application.vehicleSnapshot?.engineNumber ?? null,
      },
      applicant: {
        nameKh: citizen.citizenProfile?.nameKh ?? null,
        nameEn: citizen.citizenProfile?.nameEn ?? null,
        phone: citizen.user.phone,
      },
    }
  }

  async function loadPayment () {
    if (loading.value) return
    loading.value = true
    loadError.value = false
    downloadErrorKey.value = ''
    try {
      const paymentRecord = await inspectionApplicationService.getPayment(props.application.id)
      const [selectedVehicle, citizen, selectedStation] = await Promise.all([
        inspectionVehicleService.getById(props.application.vehicleId),
        inspectionAuthService.getCurrentUser(),
        props.application.preferredInspectionStationId === null
          ? Promise.resolve(null)
          : inspectionSchedulingService.getStationById(props.application.preferredInspectionStationId),
      ])
      payment.value = paymentRecord
      vehicle.value = selectedVehicle
      preferredStation.value = selectedStation
      officialInvoice.value = makeInvoice(paymentRecord, selectedVehicle, citizen)
      loaded.value = true
    } catch (error) {
      if (isMissingPayment(error)) {
        payment.value = null
        loaded.value = true
      } else {
        loadError.value = true
      }
    } finally {
      loading.value = false
    }
  }

  function safePdfFilename (value: string | null, fallback: string): string {
    const filename = (value || fallback).replace(/[^\p{L}\p{M}\p{N}_.-]+/gu, '-').replace(/-+/gu, '-').replace(/^[._-]+|[._-]+$/gu, '')
    return `${filename || fallback}.pdf`
  }

  async function downloadInvoice () {
    if (!payment.value || !invoiceElement.value || !vehicle.value || downloadingInvoice.value) return

    const invoiceDocument = invoiceElement.value.querySelector<HTMLElement>('[data-pdf-document="invoice"]')
    if (!invoiceDocument) return
    const filename = safePdfFilename(`វិក្កយបត្រត្រួតពិនិត្យយានយន្ត-${formatVehiclePlate(vehicle.value)}-${payment.value.invoiceNumber}`, 'វិក្កយបត្រ')

    downloadingInvoice.value = true
    downloadErrorKey.value = ''
    try {
      const { downloadDocumentPdf } = await import('../../renewal/utils/download-document-pdf')
      await downloadDocumentPdf(invoiceDocument, filename, 900)
    } catch {
      downloadErrorKey.value = 'inspection_application_payment_invoice_download_error'
    } finally {
      downloadingInvoice.value = false
    }
  }
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <section :aria-label="$t('inspection_application_payment_title')" class="application-payment-tab">
    <div v-if="loading" aria-live="polite" class="application-payment-state" role="status"><v-progress-circular color="primary" indeterminate size="34" /><p>{{ $t('inspection_application_payment_loading') }}</p></div>
    <div v-else-if="loadError" aria-live="polite" class="application-payment-state"><v-icon color="error" icon="mdi-alert-circle-outline" size="36" /><p>{{ $t('inspection_application_payment_load_error') }}</p><v-btn color="primary" prepend-icon="mdi-refresh" variant="outlined" @click="loadPayment">{{ $t('retry') }}</v-btn></div>
    <div v-else-if="loaded && !payment" class="application-payment-state"><v-icon color="primary" icon="mdi-file-document-clock-outline" size="38" /><h2>{{ $t('inspection_application_payment_unavailable_title') }}</h2><p>{{ $t('inspection_application_payment_unavailable') }}</p></div>
    <div v-else-if="payment" class="payment-artifacts">
      <v-alert v-if="downloadErrorKey" aria-live="polite" closable type="error" variant="tonal" @click:close="downloadErrorKey = ''">{{ $t(downloadErrorKey) }}</v-alert>
      <section v-if="officialInvoice && vehicle" class="official-invoice-preview">
        <header class="official-invoice-preview__toolbar"><h2>{{ $t('inspection_application_payment_invoice') }}</h2><div class="official-invoice-preview__actions"><v-chip :class="['official-invoice-preview__status', displayedStatusClass]" :color="displayedStatusColor" :prepend-icon="displayedStatusIcon" size="small" variant="tonal">{{ $t(displayedStatusKey) }}</v-chip><v-btn :aria-label="$t('inspection_application_payment_download_invoice_accessible')" color="primary" :loading="downloadingInvoice" prepend-icon="mdi-download-outline" @click="downloadInvoice">{{ $t('inspection_confirmation_download_invoice') }}</v-btn></div></header>
        <v-alert v-if="payment.status === 'REJECTED' && payment.rejectionReason" class="payment-artifact-card__reason" density="compact" type="error" variant="tonal"><strong>{{ $t('inspection_application_payment_reason') }}</strong><p>{{ payment.rejectionReason }}</p></v-alert>
        <div ref="invoiceElement"><OfficialPaymentInvoice :application-expiry-date="application.applicationExpiryDate" :invoice="officialInvoice" :preferred-station="preferredStation" :submitted-at="application.submittedAt" :vehicle="vehicle" /></div>
      </section>
    </div>
  </section>
</template>

<style scoped>
  .application-payment-tab { min-height: 360px; padding: 20px 28px 40px; }
  .application-payment-state { align-items: center; color: #666c7b; display: flex; flex-direction: column; gap: 12px; justify-content: center; min-height: 300px; padding: 30px; text-align: center; }
  .application-payment-state h2 { color: #182b5c; font-size: 1.08rem; }
  .application-payment-state p { margin: 0; max-width: 520px; }
  .payment-artifacts { display: grid; gap: 20px; margin-inline: auto; max-width: 760px; }
  .official-invoice-preview { display: grid; gap: 16px; }
  .official-invoice-preview__toolbar { align-items: center; border-bottom: 1px solid #e1e5ee; display: flex; gap: 18px; justify-content: space-between; padding: 0 0 14px; }
  .official-invoice-preview__toolbar h2 { align-items: center; color: #102652; display: flex; font-size: 1.08rem; font-weight: 800; gap: 9px; line-height: 1.35; margin: 0; }
  .official-invoice-preview__toolbar h2::before { background: linear-gradient(#334b91, #7891dd); border-radius: 999px; content: ''; height: 20px; width: 4px; }
  .official-invoice-preview__actions { align-items: center; display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
  .official-invoice-preview__status { padding-inline: 12px !important; }
  .official-invoice-preview__status--confirmed { background: #dcfce7 !important; color: #15803d !important; }.official-invoice-preview__status--pending { background: #fff3e8 !important; color: #c25f00 !important; }.official-invoice-preview__status--failed, .official-invoice-preview__status--rejected { background: #fee2e2 !important; color: #b42318 !important; }.official-invoice-preview__status--secondary { background: #f0e7ff !important; color: #6b21a8 !important; }
  .official-invoice-preview__actions :deep(.v-btn) { letter-spacing: 0; min-height: 40px; }
  .official-invoice-preview :deep(.official-invoice) { box-shadow: 0 10px 28px rgba(31, 43, 89, .09); }
  .application-payment-tab .official-invoice-preview :deep(.official-invoice__ministry) { font-size: 1.3rem !important; }
  .application-payment-tab .official-invoice-preview :deep(.official-invoice__ministry-en) { font-size: .72rem !important; }
  .application-payment-tab .official-invoice-preview :deep(.official-invoice__details dt) { font-size: .85rem !important; }
  .application-payment-tab .official-invoice-preview :deep(.official-invoice__table th) { font-weight: 450 !important; }
  .application-payment-tab .official-invoice-preview :deep(.late-penalty-explanation__copy),
  .application-payment-tab .official-invoice-preview :deep(.late-penalty-explanation__rate) { font-size: .85rem !important; }
  .payment-artifact-card__reason { margin-top: 12px; }
  .payment-artifact-card__reason p { margin: 4px 0 0; }

  @media (max-width: 759px) {
    .application-payment-tab { padding: 18px 18px 30px; }
    .official-invoice-preview__toolbar { align-items: flex-start; flex-direction: column; }
    .official-invoice-preview__actions { align-items: stretch; flex-direction: column; width: 100%; }
    .official-invoice-preview__actions :deep(.v-btn) { width: 100%; }
  }
</style>
