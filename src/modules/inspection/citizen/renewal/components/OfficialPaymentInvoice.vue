<script setup lang="ts">
  import type { CitizenPaymentInvoice } from '../../applications/types/application.types'
  import type { Vehicle } from '../../vehicles/types/vehicle.types'
  import type { InspectionStation } from '../services/scheduling.service'
  import { useI18n } from 'vue-i18n'
  import ministryLogo from '@/assets/mpwt-logo-sm.svg'
  import { formatOfficialApplicantName } from '../../../shared/utils/citizen-display-name'
  import { formatVehicleType } from '../../vehicles/utils/vehicle-type-label'
  import { formatCambodianPhone, formatVehiclePlate } from '../utils/vehicle-display'
  import LatePenaltyExplanation from './LatePenaltyExplanation.vue'

  const props = defineProps<{ invoice: CitizenPaymentInvoice, vehicle: Vehicle, preferredStation: InspectionStation | null }>()
  const { t, locale } = useI18n()
  const paymentStatusKey = computed(() => props.invoice.status === 'CONFIRMED'
    ? 'inspection_payment_payment_status_confirmed'
    : 'inspection_payment_payment_status_waiting_confirmation')

  const invoiceRows = computed(() => {
    const common = [
      { label: t('inspection_scheduling_inspection_fee'), amount: props.invoice.inspectionFeeKhr, isLateFee: false },
    ]
    if (Number(props.invoice.serviceFeeKhr) > 0) {
      common.push({ label: t('inspection_scheduling_service_fee'), amount: props.invoice.serviceFeeKhr, isLateFee: false })
    }
    if (Number(props.invoice.lateFee) > 0) common.push({ label: t('inspection_scheduling_late_fee'), amount: props.invoice.lateFee, isLateFee: true })
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
    return `${fraction && !/^0+$/u.test(fraction) ? `${grouped}.${fraction}` : grouped} ${props.invoice.currency}`
  }

  function formatDate (value: string | null): string {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat(locale.value === 'kh' ? 'km-KH' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      timeZone: 'Asia/Phnom_Penh',
      year: 'numeric',
    }).format(date)
  }

  function formatPreferredInspectionDate (value: string | null): string {
    return value === null ? '' : formatDate(value)
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
    <p class="official-invoice__invoice-number mb-0">{{ $t('inspection_payment_invoice_reference') }}: <strong>{{ invoice.invoiceNumber }}</strong></p>

    <dl class="official-invoice__details">
      <div class="official-invoice__detail"><dt>{{ $t('inspection_payment_registration_number') }}</dt><dd>{{ invoice.vehicle.registrationNumber }}</dd></div>
      <div class="official-invoice__detail"><dt>{{ $t('inspection_make_and_model') }}</dt><dd>{{ vehicleName() }}</dd></div>
      <div class="official-invoice__detail"><dt>{{ $t('inspection_invoice_applicant_name') }}</dt><dd>{{ applicantName() }}</dd></div>
      <div class="official-invoice__detail"><dt>{{ $t('inspection_documents_plate_number') }}</dt><dd>{{ formatVehiclePlate(vehicle) }}</dd></div>
      <div class="official-invoice__detail"><dt>{{ $t('inspection_documents_chassis_number') }}</dt><dd>{{ vehicle.chassisNumber }}</dd></div>
      <div class="official-invoice__detail"><dt>{{ $t('inspection_documents_phone_number') }}</dt><dd>{{ formatCambodianPhone(invoice.applicant.phone) }}</dd></div>
      <div class="official-invoice__detail"><dt>{{ $t('inspection_vehicle_type') }}</dt><dd>{{ formatVehicleType(vehicle.vehicleType, t) }}</dd></div>
      <div class="official-invoice__detail"><dt>{{ $t('inspection_payment_inspection_category') }}</dt><dd>{{ inspectionCategoryName }}</dd></div>
      <div class="official-invoice__detail"><dt>{{ $t('inspection_scheduling_date_label') }}</dt><dd>{{ formatPreferredInspectionDate(invoice.preferredInspectionDate) }}</dd></div>
      <div class="official-invoice__detail"><dt>{{ $t('inspection_payment_invoice_date') }}</dt><dd>{{ formatDate(invoice.invoiceIssuedAt) }}</dd></div>
      <div class="official-invoice__detail"><dt>{{ $t('inspection_payment_preferred_inspection_station') }}</dt><dd>{{ preferredStationName }}</dd></div>
      <div class="official-invoice__detail"><dt>{{ $t('inspection_payment_payment_status') }}</dt><dd :class="props.invoice.status === 'CONFIRMED' ? 'official-invoice__confirmed' : 'official-invoice__pending'">{{ $t(paymentStatusKey) }}</dd></div>
    </dl>

    <table class="official-invoice__table">
      <thead><tr><th>{{ $t('inspection_payment_invoice_number') }}</th><th>{{ $t('inspection_payment_invoice_description') }}</th><th>{{ $t('inspection_payment_invoice_quantity') }}</th><th>{{ $t('inspection_payment_invoice_unit_price') }}</th><th>{{ $t('inspection_payment_invoice_amount') }}</th></tr></thead>

      <tbody>
        <tr v-for="(row, index) in invoiceRows" :key="row.label" :class="{ 'official-invoice__late-fee': row.isLateFee }"><td>{{ index + 1 }}</td><td>{{ row.label }}</td><td>1</td><td>{{ formatCurrency(row.amount) }}</td><td>{{ formatCurrency(row.amount) }}</td></tr>
        <tr><td colspan="5"><LatePenaltyExplanation :currency="invoice.currency" :late-days="invoice.lateDays" :late-fee="invoice.lateFee" :vehicle-class="vehicle.vehicleClass" /></td></tr>
        <tr class="official-invoice__total"><td colspan="4">{{ $t('inspection_payment_estimated_invoice_total') }}</td><td>{{ formatCurrency(invoice.totalAmount) }}</td></tr>
      </tbody>
    </table>

  </article>
</template>

<style scoped>
  .official-invoice { background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 3px 10px rgb(20 33 74 / 8%); color: #192130; padding: 34px 32px; }
  .official-invoice__letterhead { align-items: center; display: flex; flex-direction: column; gap: 7px; text-align: center; }.official-invoice__logo { display: block; height: 72px; object-fit: contain; width: 72px; }.official-invoice__ministry { color: #223a85; font-size: 1rem; font-weight: 800; }.official-invoice__ministry-en { color: #44536e; font-size: .7rem; font-weight: 700; letter-spacing: .02em; }.official-invoice__rule { background: #9ca7b9; height: 1px; margin: 18px 0 20px; }.official-invoice__eyebrow { color: #68748b; font-size: .8rem; margin: 0 0 7px; text-align: center; }.official-invoice__title { font-size: 1.2rem; margin: 0; text-align: center; }.official-invoice__invoice-number { color: #556278; font-size: .77rem; margin-top: 7px; text-align: center; }.official-invoice__details { display: grid; gap: 16px 28px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 24px 0; }.official-invoice__details dl { margin: 0; }.official-invoice__details dt { color: #718096; font-size: .71rem; margin-top: 8px; }.official-invoice__details dt:first-child { margin-top: 0; }.official-invoice__details dd { font-size: .82rem; font-weight: 700; margin: 1px 0 0; overflow-wrap: anywhere; }.official-invoice__pending { color: #f5b300; }.official-invoice__table { border-collapse: collapse; font-size: .79rem; table-layout: fixed; width: 100%; }.official-invoice__table th, .official-invoice__table td { border: 1px solid #566174; padding: 8px 7px; }.official-invoice__table th { text-align: center; }.official-invoice__table th:first-child, .official-invoice__table td:first-child { text-align: center; width: 7%; }.official-invoice__table th:nth-child(2) { width: 47%; }.official-invoice__table th:nth-child(3), .official-invoice__table td:nth-child(3) { text-align: center; width: 9%; }.official-invoice__table th:nth-child(4), .official-invoice__table th:nth-child(5), .official-invoice__table td:nth-child(4), .official-invoice__table td:nth-child(5) { text-align: right; width: 18.5%; }.official-invoice__total { background: #f0f3f8; font-size: .9rem; font-weight: 700; }.official-invoice__total td:first-child { text-align: right; }
  .official-invoice__pending { color: #c56a00 !important; }
  .official-invoice__confirmed { color: #18733a !important; }
  .official-invoice__ministry { font-family: 'Moul', 'Siemreap', 'Battambang', 'Kantumruy Pro', sans-serif !important; font-size: 1.1rem !important; font-weight: 400 !important; }
  .official-invoice__ministry-en { color: #223a85 !important; font-weight: 600 !important; }
  .official-invoice__title { font-family: 'Moul', 'Siemreap', 'Battambang', 'Kantumruy Pro', sans-serif !important; font-weight: 400 !important; }
  .official-invoice__invoice-number { font-size: 1rem !important; }
  .official-invoice__invoice-number strong { color: #000 !important; }
  .official-invoice__details dt { font-size: .95rem !important; }
  .official-invoice__details dd { font-size: 1rem !important; }
  .official-invoice__table { font-size: 1rem !important; }
  .official-invoice__total { font-size: 1rem !important; }
  .official-invoice__late-fee { color: #B42318 !important; }
  .official-invoice__details { align-items: stretch; gap: 18px 28px; grid-auto-rows: minmax(58px, auto); }
  .official-invoice__detail { min-width: 0; }
  .official-invoice__details dt { line-height: 1.35; margin: 0; }
  .official-invoice__details dd { line-height: 1.45; margin: 3px 0 0; min-height: 1.45em; }
  .official-invoice__table th, .official-invoice__table td { line-height: 1.4; padding: 9px 7px; vertical-align: middle; }
  .official-invoice__table th:nth-child(2), .official-invoice__table td:nth-child(2) { text-align: left; }
  .official-invoice__table th:nth-child(4), .official-invoice__table th:nth-child(5) { text-align: right; }
  @media (max-width: 599px) { .official-invoice { padding: 22px 16px; }.official-invoice__details { grid-template-columns: 1fr; }.official-invoice__table { font-size: .68rem; }.official-invoice__table th, .official-invoice__table td { padding: 6px 4px; } }
</style>
