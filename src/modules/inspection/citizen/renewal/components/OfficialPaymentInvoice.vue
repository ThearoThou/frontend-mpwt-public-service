<script setup lang="ts">
  import type { CitizenPaymentInvoice } from '../../applications/types/application.types'
  import type { Vehicle } from '../../vehicles/types/vehicle.types'
  import type { InspectionStation } from '../services/scheduling.service'
  import { useI18n } from 'vue-i18n'
  import ministryLogo from '@/assets/mpwt-logo-sm.svg'
  import { formatOfficialApplicantName } from '../../../shared/utils/citizen-display-name'
  import { formatDisplayDate } from '../../../shared/utils/display-date'
  import { latePenaltyDisplay } from '../utils/late-penalty-display'
  import { formatVehiclePlate } from '../utils/vehicle-display'

  const props = withDefaults(defineProps<{
    invoice: CitizenPaymentInvoice
    vehicle: Vehicle
    preferredStation: InspectionStation | null
    applicationExpiryDate?: string | null
    showGraceNote?: boolean
    submittedAt?: string | null
  }>(), {
    applicationExpiryDate: null,
    showGraceNote: true,
    submittedAt: null,
  })
  const { t, locale } = useI18n()
  const paymentStatusKey = computed(() => ({
    CONFIRMED: 'inspection_payment_payment_status_confirmed',
    PENDING: 'inspection_payment_payment_status_waiting_confirmation',
    REJECTED: 'inspection_application_status_payment_rejected',
  })[props.invoice.status])
  const paymentStatusClass = computed(() => {
    if (props.invoice.status === 'CONFIRMED') return 'official-invoice__confirmed'
    if (props.invoice.status === 'PENDING') return 'official-invoice__pending'
    return 'official-invoice__error'
  })
  const preferredInspectionDate = computed(() =>
    props.invoice.preferredInspectionDate === null
      ? ''
      : formatDisplayDate(props.invoice.preferredInspectionDate),
  )
  const applicationExpiryDate = computed(() =>
    props.applicationExpiryDate === null
      ? ''
      : formatDisplayDate(props.applicationExpiryDate),
  )

  const invoiceRows = computed(() => {
    const common = [
      { label: t('inspection_scheduling_inspection_fee'), quantity: '1', unitPrice: props.invoice.inspectionFeeKhr, amount: props.invoice.inspectionFeeKhr },
    ]
    if (Number(props.invoice.serviceFeeKhr) > 0) {
      common.push({ label: t('inspection_scheduling_service_fee'), quantity: '1', unitPrice: props.invoice.serviceFeeKhr, amount: props.invoice.serviceFeeKhr })
    }
    if (Number(props.invoice.lateFee) > 0) {
      const penalty = latePenaltyDisplay(
        props.invoice.lateDays,
        props.invoice.lateFee,
        props.vehicle.vehicleClass,
      )
      common.push({
        label: t('inspection_scheduling_late_fee'),
        quantity: penalty === null ? '1' : formatPenaltyDays(penalty.chargeableLateDays),
        unitPrice: penalty === null ? props.invoice.lateFee : String(penalty.dailyRateKhr),
        amount: props.invoice.lateFee,
      })
    }
    return common
  })

  const preferredStationName = computed(() => {
    const station = props.preferredStation
    if (station === null) return ''

    return locale.value === 'kh'
      ? station.nameKh || station.nameEn
      : station.nameEn || station.nameKh
  })

  const inspectionCategoryName = computed(() => {
    const category = props.vehicle.inspectionCategory
    if (category === null) return ''

    return locale.value === 'kh'
      ? category.nameKh
      : category.nameEn || category.nameKh
  })

  function formatCurrency (amount: string): string {
    const [whole, fraction] = amount.split('.')
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/gu, ',')
    return `${fraction && !/^0+$/u.test(fraction) ? `${grouped}.${fraction}` : grouped} ៛`
  }

  function formatPenaltyDays (days: number): string {
    return locale.value === 'kh' ? `${days}ថ្ងៃ` : `${days} days`
  }

  function vehicleName (): string {
    const makeAndModel = [props.vehicle.make, props.vehicle.model].filter(Boolean).join(' ')
    return [makeAndModel, props.vehicle.manufactureYear].filter(Boolean).join(' · ') || '—'
  }

  function applicantName (): string {
    return formatOfficialApplicantName(props.invoice.applicant)
  }
</script>

<template>
  <article class="official-invoice" data-pdf-document="invoice">
    <header class="official-invoice__letterhead">
      <img alt="MPWT" class="official-invoice__logo" :src="ministryLogo">

      <div>
        <p class="official-invoice__ministry mb-0">{{ $t('inspection_payment_ministry_name') }}</p>
        <p class="official-invoice__ministry-en mb-0">MINISTRY OF PUBLIC WORKS AND TRANSPORT</p>
      </div>
    </header>

    <div class="official-invoice__rule" />
    <h2 class="official-invoice__title">{{ $t('inspection_payment_official_invoice_title') }}</h2>

    <dl class="official-invoice__details">
      <div class="official-invoice__detail official-invoice__detail--nowrap"><dt>{{ $t('inspection_payment_invoice_reference') }}</dt><dd>{{ invoice.invoiceNumber }}</dd></div>
      <div class="official-invoice__detail"><dt>{{ $t('inspection_make_and_model') }}</dt><dd>{{ vehicleName() }}</dd></div>
      <div class="official-invoice__detail"><dt>{{ $t('inspection_invoice_applicant_name') }}</dt><dd>{{ applicantName() }}</dd></div>
      <div class="official-invoice__detail official-invoice__detail--nowrap"><dt>{{ $t('inspection_payment_submission_date') }}</dt><dd>{{ formatDisplayDate(submittedAt) }}</dd></div>
      <div class="official-invoice__detail official-invoice__detail--nowrap"><dt>{{ $t('inspection_payment_registration_number') }}</dt><dd>{{ invoice.vehicle.registrationNumber }}</dd></div>
      <div class="official-invoice__detail official-invoice__detail--nowrap"><dt>{{ $t('inspection_scheduling_date_label') }}</dt><dd>{{ formatDisplayDate(invoice.preferredInspectionDate) }}</dd></div>
      <div class="official-invoice__detail official-invoice__detail--nowrap"><dt>{{ $t('inspection_documents_chassis_number') }}</dt><dd>{{ vehicle.chassisNumber }}</dd></div>
      <div class="official-invoice__detail official-invoice__detail--nowrap"><dt>{{ $t('inspection_engine_number') }}</dt><dd>{{ invoice.vehicle.engineNumber || '—' }}</dd></div>
      <div class="official-invoice__detail official-invoice__detail--nowrap"><dt>{{ $t('inspection_payment_payment_status') }}</dt><dd :class="paymentStatusClass">{{ $t(paymentStatusKey) }}</dd></div>
      <div class="official-invoice__detail official-invoice__detail--nowrap"><dt>{{ $t('inspection_documents_plate_number') }}</dt><dd>{{ formatVehiclePlate(vehicle) }}</dd></div>
      <div class="official-invoice__detail official-invoice__detail--long"><dt>{{ $t('inspection_payment_inspection_category') }}</dt><dd>{{ inspectionCategoryName }}</dd></div>
      <div class="official-invoice__detail official-invoice__detail--long"><dt>{{ $t('inspection_payment_preferred_inspection_station') }}</dt><dd>{{ preferredStationName }}</dd></div>
    </dl>

    <table class="official-invoice__table">
      <thead><tr><th>{{ $t('inspection_payment_invoice_number') }}</th><th>{{ $t('inspection_payment_invoice_description') }}</th><th>{{ $t('inspection_payment_invoice_quantity') }}</th><th>{{ $t('inspection_payment_invoice_unit_price') }}</th><th>{{ $t('inspection_payment_invoice_amount') }}</th></tr></thead>

      <tbody>
        <tr v-for="(row, index) in invoiceRows" :key="row.label"><td>{{ index + 1 }}</td><td>{{ row.label }}</td><td>{{ row.quantity }}</td><td>{{ formatCurrency(row.unitPrice) }}</td><td>{{ formatCurrency(row.amount) }}</td></tr>
        <tr class="official-invoice__total"><td colspan="4">{{ $t('inspection_payment_estimated_invoice_total') }}</td><td>{{ formatCurrency(invoice.totalAmount) }}</td></tr>
      </tbody>
    </table>

    <section class="official-invoice__notice">
      <header class="official-invoice__notice-heading">
        <v-icon icon="mdi-information-outline" size="20" />
        <h3>{{ $t('inspection_invoice_notice_heading') }}</h3>
      </header>

      <div class="official-invoice__notice-box">
        <p>{{ $t('inspection_invoice_notice_bring_intro') }}</p>

        <ul>
          <li>{{ $t('inspection_invoice_notice_vehicle_document') }}</li>
          <li>{{ $t('inspection_invoice_notice_invoice_application') }}</li>
          <li>{{ $t('inspection_invoice_notice_previous_certificate') }}</li>
        </ul>

        <p>{{ $t('inspection_invoice_notice_verify') }}</p>

        <p
          v-if="preferredInspectionDate"
        >
          {{ $t('inspection_invoice_notice_preferred_date', { date: preferredInspectionDate }) }}
        </p>

        <p
          v-if="applicationExpiryDate"
        >
          {{ $t('inspection_invoice_notice_expiry_date', { date: applicationExpiryDate }) }}
        </p>
      </div>
    </section>

  </article>
</template>

<style scoped>
  /* Use a clean sans-serif face for Latin invoice content. Khmer glyphs fall
     through to the bundled Khmer fonts, keeping bilingual fields readable. */
  .official-invoice, .official-invoice * { font-family: Arial, 'Helvetica Neue', 'Siemreap', 'Battambang', 'Kantumruy Pro', sans-serif !important; }
  .official-invoice { background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: none; color: #222; padding: 38px 36px; }
  .official-invoice__letterhead { align-items: center; display: flex; flex-direction: column; gap: 7px; text-align: center; }.official-invoice__logo { display: block; height: 72px; object-fit: contain; width: 72px; }.official-invoice__ministry { color: #223a85; font-size: 1rem; font-weight: 800; }.official-invoice__ministry-en { color: #44536e; font-size: .7rem; font-weight: 700; letter-spacing: .02em; }.official-invoice__rule { background: #9ca7b9; height: 1px; margin: 18px 0 20px; }.official-invoice__eyebrow { color: #68748b; font-size: .8rem; margin: 0 0 7px; text-align: center; }.official-invoice__title { font-size: 1.2rem; margin: 0; text-align: center; }.official-invoice__invoice-number { color: #556278; font-size: .77rem; margin-top: 7px; text-align: center; }.official-invoice__details { display: grid; gap: 16px 28px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 24px 0; }.official-invoice__details dl { margin: 0; }.official-invoice__details dt { color: #718096; font-size: .71rem; margin-top: 8px; }.official-invoice__details dt:first-child { margin-top: 0; }.official-invoice__details dd { font-size: .82rem; font-weight: 700; margin: 1px 0 0; overflow-wrap: anywhere; }.official-invoice__pending { color: #f5b300; }.official-invoice__table { border-collapse: collapse; font-size: .79rem; table-layout: fixed; width: 100%; }.official-invoice__table th, .official-invoice__table td { border: 1px solid #566174; padding: 8px 7px; }.official-invoice__table th { text-align: center; }.official-invoice__table th:first-child, .official-invoice__table td:first-child { text-align: center; width: 7%; }.official-invoice__table th:nth-child(2) { width: 47%; }.official-invoice__table th:nth-child(3), .official-invoice__table td:nth-child(3) { text-align: center; width: 9%; }.official-invoice__table th:nth-child(4), .official-invoice__table th:nth-child(5), .official-invoice__table td:nth-child(4), .official-invoice__table td:nth-child(5) { text-align: right; width: 18.5%; }.official-invoice__total { background: #f0f3f8; font-size: .9rem; font-weight: 700; }.official-invoice__total td:first-child { text-align: right; }
  .official-invoice__pending { color: #c25f00 !important; font-weight: 700 !important; }
  .official-invoice__details dd.official-invoice__pending { overflow-wrap: anywhere; white-space: normal; }
  .official-invoice__confirmed { color: #15803d !important; font-weight: 700 !important; }
  .official-invoice__error { color: #b42318 !important; }
  .official-invoice__ministry { font-family: 'Moul', 'Siemreap', 'Battambang', 'Kantumruy Pro', sans-serif !important; font-size: 1.3rem !important; font-weight: 400 !important; line-height: 1.45; }
  .official-invoice__ministry-en { color: #223a85 !important; font-size: .72rem !important; font-weight: 600 !important; letter-spacing: .02em; line-height: 1.35; }
  .official-invoice__title { font-family: 'Moul', 'Siemreap', 'Battambang', 'Kantumruy Pro', sans-serif !important; font-weight: 400 !important; }
  .official-invoice__details dt { color: #333 !important; font-size: .82rem !important; font-weight: 500; }
  .official-invoice__details dd { color: #111; font-size: .95rem !important; font-weight: 600 !important; }
  .official-invoice__table { font-size: .9rem !important; }
  .official-invoice__table th { font-size: .9rem !important; font-weight: 700; }
  .official-invoice__table td { font-size: .9rem !important; font-weight: 400; }
  .official-invoice__total { background: #fff; font-size: .95rem !important; font-weight: 700; }
  .official-invoice__details { align-items: stretch; gap: 18px 28px; grid-auto-rows: minmax(58px, auto); margin: 24px 0; }
  .official-invoice__detail { display: block; min-width: 0; }
  .official-invoice__detail--nowrap dd { white-space: nowrap; }
  .official-invoice__details dt { line-height: 1.35; margin: 0; }
  .official-invoice__details dd { line-height: 1.45; margin: 3px 0 0; min-height: 1.45em; }
  .official-invoice__table th, .official-invoice__table td { border-color: #333; color: #222; line-height: 1.4; padding: 8px 7px; vertical-align: middle; }
  .official-invoice__table th:nth-child(2), .official-invoice__table td:nth-child(2) { text-align: left; }
  .official-invoice__table th:nth-child(4), .official-invoice__table th:nth-child(5) { text-align: right; }
  .official-invoice__notice { break-inside: avoid; margin-top: 28px; page-break-inside: avoid; }
  .official-invoice__notice-heading { align-items: center; color: #9f2636; display: flex; gap: 7px; margin-bottom: 9px; }
  .official-invoice__notice-heading h3 { font-size: .95rem; font-weight: 700; line-height: 1.4; margin: 0; }
  .official-invoice__notice-box { border: 1px solid #b85b66; color: #374151; font-size: .88rem; line-height: 1.7; padding: 14px 17px; }
  .official-invoice__notice-box p { margin: 0 0 8px; }
  .official-invoice__notice-box p:last-child { margin-bottom: 0; }
  .official-invoice__notice-box ul { margin: 3px 0 10px; padding-inline-start: 22px; }
  .official-invoice__notice-box li { margin: 1px 0; padding-inline-start: 2px; }
  @media (max-width: 599px) { .official-invoice { padding: 22px 16px; }.official-invoice__details { grid-template-columns: 1fr; }.official-invoice__table { font-size: .68rem; }.official-invoice__table th, .official-invoice__table td { padding: 6px 4px; } }
</style>
