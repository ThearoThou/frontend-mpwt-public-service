<script setup lang="ts">
  import type { CitizenPaymentInvoice } from '../../applications/types/application.types'
  import type { Vehicle } from '../../vehicles/types/vehicle.types'
  import { useI18n } from 'vue-i18n'
  import { formatVehicleType } from '../../vehicles/utils/vehicle-type-label'
  import { formatCambodianPhone, formatVehiclePlate } from '../utils/vehicle-display'

  defineProps<{ invoice: CitizenPaymentInvoice, vehicle: Vehicle }>()
  const { t } = useI18n()
</script>

<template>
  <article class="technical-form" data-pdf-document="technical-form">
    <header class="technical-form__header"><h2>{{ $t('inspection_confirmation_form_title') }}</h2><p>{{ $t('inspection_confirmation_form_subtitle') }}</p></header>
    <p class="technical-form__notice">{{ $t('inspection_confirmation_form_notice') }}</p>

    <div class="technical-form__grid">
      <div><span>{{ $t('inspection_confirmation_reference') }}</span><strong>{{ invoice.applicationReferenceNumber || '—' }}</strong></div>
      <div><span>{{ $t('inspection_documents_plate_number') }}</span><strong>{{ formatVehiclePlate(vehicle) }}</strong></div>
      <div><span>{{ $t('inspection_make_and_model') }}</span><strong>{{ [[vehicle.make, vehicle.model].filter(Boolean).join(' '), vehicle.manufactureYear].filter(Boolean).join(' · ') || '—' }}</strong></div>
      <div><span>{{ $t('inspection_documents_chassis_number') }}</span><strong>{{ vehicle.chassisNumber }}</strong></div>
      <div><span>{{ $t('inspection_vehicle_type') }}</span><strong>{{ formatVehicleType(vehicle.vehicleType, t) }}</strong></div>
      <div><span>{{ $t('inspection_payment_owner_name') }}</span><strong>{{ invoice.applicant.nameKh || invoice.applicant.nameEn || '—' }}</strong></div>
      <div><span>{{ $t('inspection_documents_phone_number') }}</span><strong>{{ formatCambodianPhone(invoice.applicant.phone) }}</strong></div>
      <div><span>{{ $t('inspection_confirmation_preferred_date') }}</span><strong>{{ invoice.preferredInspectionDate ? invoice.preferredInspectionDate.split('-').reverse().join('/') : '—' }}</strong></div>
    </div>

    <section class="technical-form__blank"><h3>{{ $t('inspection_confirmation_inspection_section') }}</h3><div class="technical-form__blank-grid"><p>{{ $t('inspection_confirmation_engine_number') }} <i /></p><p>{{ $t('inspection_confirmation_result') }} <i /></p><p>{{ $t('inspection_confirmation_inspector') }} <i /></p><p>{{ $t('inspection_confirmation_signature') }} <i /></p></div></section>
  </article>
</template>

<style scoped>
  .technical-form { background: #fff; border: 1px solid #344054; color: #111827; padding: 34px 36px; }.technical-form__header { border-bottom: 1px solid #344054; text-align: center; }.technical-form__header h2 { font-size: 1.15rem; margin: 0 0 6px; }.technical-form__header p { font-size: .82rem; margin: 0 0 15px; }.technical-form__notice { background: #fff8e1; border-left: 3px solid #d97706; font-size: .78rem; margin: 18px 0; padding: 10px 12px; }.technical-form__grid { display: grid; gap: 15px 28px; grid-template-columns: repeat(2, minmax(0, 1fr)); }.technical-form__grid div { border-bottom: 1px dotted #667085; display: flex; flex-direction: column; min-height: 45px; }.technical-form__grid span { color: #667085; font-size: .72rem; }.technical-form__grid strong { font-size: .83rem; margin-top: 3px; overflow-wrap: anywhere; }.technical-form__blank { border: 1px solid #667085; margin-top: 28px; padding: 16px; }.technical-form__blank h3 { font-size: .9rem; margin: 0 0 14px; }.technical-form__blank-grid { display: grid; gap: 22px; grid-template-columns: repeat(2, minmax(0, 1fr)); }.technical-form__blank p { display: flex; font-size: .82rem; gap: 8px; margin: 0; }.technical-form__blank i { border-bottom: 1px dotted #475467; flex: 1; } @media (max-width: 599px) { .technical-form { padding: 24px 18px; }.technical-form__grid, .technical-form__blank-grid { grid-template-columns: 1fr; } }
</style>
