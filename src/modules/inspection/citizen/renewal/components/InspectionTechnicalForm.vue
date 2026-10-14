<script setup lang="ts">
  import type { CitizenPaymentInvoice, RenewalApplicationDetail } from '../../applications/types/application.types'
  import type { Vehicle } from '../../vehicles/types/vehicle.types'
  import type { InspectionStation } from '../services/scheduling.service'
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { resolveInspectionCategoryLabel } from '../../vehicles/utils/inspection-category-label'
  import { formatVehicleEnum, resolveVehicleColorLabel } from '../../vehicles/utils/vehicle-enum-label'
  import { formatCambodianPhone, formatVehiclePlate } from '../utils/vehicle-display'

  const props = defineProps<{
    application: RenewalApplicationDetail
    invoice: CitizenPaymentInvoice
    preferredStation: InspectionStation | null
    vehicle: Vehicle
  }>()
  const { locale, t } = useI18n()
  const snapshot = computed(() => props.application.vehicleSnapshot)

  const categoryName = computed(() => {
    const category = snapshot.value?.inspectionCategory
    if (category !== null && category !== undefined) {
      return locale.value === 'kh' ? category.nameKh : category.nameEn || category.nameKh
    }
    return resolveInspectionCategoryLabel(props.vehicle.inspectionCategory, locale.value).replace('—', '')
  })

  function value (candidate: string | number | null | undefined, unit = ''): string {
    if (candidate === undefined) return ''
    if (candidate === null) return ''
    if (candidate === '') return ''
    return `${candidate}${unit}`
  }

  function enumValue (candidate: string | null | undefined): string {
    return candidate ? formatVehicleEnum(candidate, t).replace('—', '') : ''
  }

  function colourValue (): string {
    const colour = snapshot.value?.colour
    return colour ? resolveVehicleColorLabel(colour, t).replace('—', '') : ''
  }

  function dimensions (): string {
    const items = [snapshot.value?.lengthMm, snapshot.value?.widthMm, snapshot.value?.heightMm]
    return items.every(item => item !== null && item !== undefined) ? `${items.join(' × ')} mm` : ''
  }
</script>

<template>
  <article class="technical-form" data-pdf-document="technical-form">
    <header class="technical-form__header">
      <p>ព្រះរាជាណាចក្រកម្ពុជា</p>
      <p>ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
      <span aria-hidden="true">─────── ❖ ────────</span>
      <h2>ពាក្យសុំត្រួតពិនិត្យលក្ខណៈបច្ចេកទេសរថយន្ត</h2>
    </header>

    <section aria-label="ព័ត៌មានម្ចាស់យានយន្ត" class="technical-form__owner">
      <div class="technical-form__identity-row">
        <p><span>នាម និងគោត្តនាម:</span><b>{{ invoice.applicant.nameKh || invoice.applicant.nameEn }}</b></p>
        <p><span>ភេទ:</span><b class="technical-form__blank" /></p>
        <p><span>សញ្ជាតិ:</span><b class="technical-form__blank" /></p>
      </div>

      <div class="technical-form__address-row">
        <p><span>អាសយដ្ឋានបច្ចុប្បន្ន៖ ផ្ទះលេខ:</span><b class="technical-form__blank" /></p>
        <p><span>ផ្លូវ:</span><b class="technical-form__blank" /></p>
        <p><span>ភូមិ:</span><b class="technical-form__blank" /></p>
        <p><span>សង្កាត់/ឃុំ:</span><b class="technical-form__blank" /></p>
        <p><span>ខណ្ឌ/ស្រុក:</span><b class="technical-form__blank" /></p>
        <p><span>រាជធានី/ខេត្ត:</span><b class="technical-form__blank" /></p>
        <p><span>លេខទូរស័ព្ទ:</span><b>{{ formatCambodianPhone(invoice.applicant.phone).replace('—', '') }}</b></p>
        <p><span>អ៊ីម៉ែល:</span><b class="technical-form__blank" /></p>
      </div>
    </section>

    <p class="technical-form__vehicle-lead">សំណើសុំត្រួតពិនិត្យលក្ខណៈបច្ចេកទេសរថយន្ត មានភិនភាគដូចខាងក្រោម:</p>

    <div class="technical-form__vehicle-grid">
      <p><span>លេខសម្គាល់យានជំនិះ</span><b>{{ formatVehiclePlate(vehicle) }}</b></p>
      <p><span>ម៉ាក</span><b>{{ [snapshot?.make ?? vehicle.make, snapshot?.model ?? vehicle.model].filter(Boolean).join(' ') }}</b></p>
      <p><span>ប្រភេទ</span><b>{{ categoryName }}</b></p>
      <p><span>ពណ៌</span><b>{{ colourValue() }}</b></p>
      <p><span>ឆ្នាំផលិត</span><b>{{ value(snapshot?.manufactureYear ?? vehicle.manufactureYear) }}</b></p>
      <p><span>ទំហំស៊ីឡាំង - កម្លាំងសេះ</span><b>{{ value(snapshot?.engineDisplacementCc, ' cc') }} / {{ value(snapshot?.enginePowerHp, ' HP') }}</b></p>
      <p><span>ចំនួនភ្លៅ</span><b>{{ value(snapshot?.numberOfAxles) }}</b></p>
      <p><span>ទម្ងន់យាន (គីឡូក្រាម)</span><b>{{ value(snapshot?.vehicleWeightKg, ' kg') }}</b></p>
      <p><span>ទម្ងន់ផ្ទុកអតិបរមា (គីឡូក្រាម)</span><b>{{ value(snapshot?.maximumLoadKg, ' kg') }}</b></p>
      <p><span>ចំនួនកៅអី/ខ្សែក្រវ៉ាត់</span><b>{{ value(snapshot?.numberOfSeats) }}</b></p>
      <p><span>ចង្កូត</span><b>{{ enumValue(snapshot?.steering) }}</b></p>
      <p><span>ប្រភេទប្រេងឥន្ធនៈ</span><b>{{ enumValue(snapshot?.fuelType) }}</b></p>

      <div class="technical-form__vehicle-final-row">
        <p><span>បណ្ដោយ - ទទឹង - កម្ពស់</span><b>{{ dimensions() }}</b></p>
        <p><span>ទំហំកង់</span><b>{{ value(snapshot?.wheelSize) }}</b></p>
      </div>
    </div>

    <table class="technical-form__identifier-table">
      <thead><tr><th>លេខតួ</th><th>លេខសាក់ស៊ី</th></tr></thead>
      <tbody><tr><td>(បិទលេខផ្តិតចម្លងជាក់ស្តែង)</td><td>(បិទលេខផ្តិតចម្លងជាក់ស្តែង)</td></tr></tbody>
    </table>

    <div class="technical-form__lower-band">
      <div class="technical-form__references">
        <p><span>លេខប្រតិបត្តិការ៖</span> <strong>{{ invoice.applicationReferenceNumber }} | {{ invoice.invoiceNumber }}</strong></p>
      </div>

      <div class="technical-form__signing">
        <p>ធ្វើនៅ........... ថ្ងៃទី...................ខែ................ឆ្នាំ............</p>
        <strong>ម្ចាស់យាន ឬតំណាងស្របច្បាប់</strong>
        <small>(ហត្ថលេខា និងឈ្មោះ)</small>
      </div>
    </div>

  </article>
</template>

<style scoped>
  .technical-form { aspect-ratio: 8.5 / 11; background: #fff; box-sizing: border-box; color: #161616; margin-inline: auto; max-width: 816px; padding: 79px 52px 70px; width: 100%; }
  .technical-form__header { text-align: center; }
  .technical-form__header p, .technical-form__header h2, .technical-form__header small { margin: 0; }
  .technical-form__header p, .technical-form__header h2 { font-family: 'Moul', 'Siemreap', 'Battambang', 'Kantumruy Pro', sans-serif !important; font-weight: 400 !important; }
  .technical-form__header::after { background: #222; content: ''; display: block; height: 1px; margin: 8px auto 0; opacity: .65; width: 48px; }
  .technical-form__header p { font-size: .75rem; font-weight: 700; }
  .technical-form__header h2 { font-size: .86rem; font-weight: 700; line-height: 1.45; margin-top: 2px; }
  .technical-form__header small { font-size: .58rem; }
  .technical-form__service-row { align-items: center; display: flex; font-size: .64rem; gap: 20px; justify-content: center; margin: 19px 0 13px; }
  .technical-form__service-row span { align-items: center; display: inline-flex; gap: 5px; }
  .paper-check { border: 1px solid #333; display: inline-flex; height: 11px; justify-content: center; line-height: 9px; width: 11px; }
  .paper-check--checked { font-size: .58rem; font-weight: 700; }
  .technical-form__upper-fields { display: grid; gap: 7px 18px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .technical-form__upper-fields p, .technical-form__vehicle-grid p { align-items: baseline; display: flex; font-size: .61rem; gap: 5px; margin: 0; min-width: 0; }
  .technical-form__upper-fields span, .technical-form__vehicle-grid span { flex: 0 0 auto; }
  .technical-form__upper-fields i, .technical-form__vehicle-grid i { flex: 1; font-style: normal; font-weight: 700; line-height: 1.35; min-height: 1.35em; overflow-wrap: anywhere; padding: 0 1px; }
  .technical-form__upper-fields i:empty, .technical-form__vehicle-grid i:empty { border-bottom: 1px dotted #777; }
  .technical-form__vehicle-lead { font-size: .65rem; font-weight: 700; margin: 16px 0 10px; text-align: center; }
  .technical-form__vehicle-grid { display: grid; gap: 11px 24px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .technical-form__combined i { display: flex; gap: 12px; }
  .technical-form__combined em { font-style: normal; margin-left: auto; }
  .technical-form__identifier-table { border-collapse: collapse; font-size: .66rem; margin-top: 19px; table-layout: fixed; text-align: center; width: 100%; }
  .technical-form__identifier-table th, .technical-form__identifier-table td { border: 1px solid #333; padding: 7px 9px; }
  .technical-form__identifier-table th { font-weight: 700; }
  .technical-form__identifier-table td { font-weight: 600; }
  .technical-form__lower-band { display: grid; gap: 38px; grid-template-columns: 1.1fr .9fr; margin-top: 18px; }
  .technical-form__references p, .technical-form__signing p { font-size: .61rem; margin: 0 0 6px; }
  .technical-form__signing { text-align: center; }
  .technical-form__signing strong { display: block; font-size: .64rem; margin-top: 18px; }
  .technical-form__signing small { display: block; font-size: .58rem; margin-top: 5px; }
  .technical-form__header { margin-bottom: 25px; }
  .technical-form__header p { font-size: .66rem; line-height: 1.45; }
  .technical-form__header span { display: block; font-size: .5rem; letter-spacing: -.06em; margin: 3px 0 18px; }
  .technical-form__header h2 { font-size: .72rem; line-height: 1.4; }
  .technical-form__header::after { display: none; }
  .technical-form__owner { margin: 0 0 25px; }
  .technical-form__identity-row, .technical-form__address-row { display: grid; gap: 20px 28px; }
  .technical-form__identity-row { grid-template-columns: 1.4fr .65fr .8fr; }
  .technical-form__address-row { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 22px; }
  .technical-form__identity-row p, .technical-form__address-row p, .technical-form__vehicle-grid p { align-items: baseline; display: flex; font-size: .58rem; gap: 5px; line-height: 1.45; margin: 0; min-width: 0; }
  .technical-form__identity-row p, .technical-form__address-row p { align-items: baseline; column-gap: 10px; display: grid; grid-template-columns: max-content minmax(0, 1fr); row-gap: 0; }
  .technical-form__identity-row span, .technical-form__address-row span, .technical-form__vehicle-grid span { flex: 0 0 auto; }
  .technical-form__identity-row b, .technical-form__address-row b, .technical-form__vehicle-grid b { flex: 1; font-weight: 700; min-height: 1.35em; overflow-wrap: anywhere; }
  .technical-form__identity-row b, .technical-form__address-row b { display: block; flex: 0 0 auto; padding-bottom: 3px; width: 100%; }
  .technical-form__blank { border-bottom: 1px dotted #777; }
  .technical-form__vehicle-lead { font-size: .61rem; margin: 0 0 19px; text-align: center; }
  .technical-form__vehicle-grid { gap: 15px 25px; }
  .technical-form__vehicle-final-row { display: grid; gap: 20px 32px; grid-column: 1 / -1; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .technical-form__identifier-table { margin-top: 28px; }
  .technical-form__identifier-table th { font-size: .64rem; }
  .technical-form__identifier-table td { font-size: .6rem; font-weight: 400; height: 36px; }
  .technical-form__lower-band { align-items: start; margin-top: 20px; }
  .technical-form__references p, .technical-form__signing p { font-size: .56rem; }
  .technical-form__signing strong { font-size: .59rem; margin-top: 9px; }
  .technical-form__signing small { font-size: .54rem; }
  .technical-form__header p { font-size: .9rem; }
  .technical-form__header h2 { font-size: 1.1rem; }
  .technical-form__identity-row p, .technical-form__address-row p { font-size: .82rem; line-height: 1.4; }
  .technical-form__identity-row b, .technical-form__address-row b { font-size: .9rem; line-height: 1.45; }
  .technical-form__vehicle-lead { font-size: .9rem; font-weight: 400; line-height: 1.6; margin-bottom: 24px; }
  .technical-form__vehicle-grid { gap: 20px 32px; }
  .technical-form__vehicle-grid p, .technical-form__vehicle-final-row p { align-items: center; display: flex; flex-direction: column; font-size: .78rem; gap: 3px; margin: 0; text-align: center; }
  .technical-form__identity-row span, .technical-form__address-row span, .technical-form__vehicle-grid span, .technical-form__vehicle-final-row span { color: #333; font-weight: 500; }
  .technical-form__identity-row b, .technical-form__address-row b { color: #111; font-weight: 600 !important; }
  .technical-form__vehicle-grid b, .technical-form__vehicle-final-row b { color: #111; flex: 0 0 auto; font-size: .9rem; font-weight: 600 !important; line-height: 1.45; text-align: center; width: auto; }
  .technical-form__identifier-table { font-size: .84rem; }
  .technical-form__identifier-table th { font-size: .9rem; font-weight: 600 !important; }
  .technical-form__identifier-table td { font-size: .78rem; }
  .technical-form__references p, .technical-form__signing p { font-size: .9rem; }
  .technical-form__references span, .technical-form__signing strong { font-weight: 600 !important; }
  .technical-form__references strong { font-weight: 400; }
  .technical-form__signing strong { font-size: .8rem; }
  .technical-form__signing small { font-size: .72rem; }
  @media (max-width: 599px) {
    .technical-form { aspect-ratio: auto; padding: 24px 18px; }
    .technical-form__identity-row, .technical-form__address-row, .technical-form__vehicle-grid, .technical-form__vehicle-final-row, .technical-form__lower-band { grid-template-columns: 1fr; }
  }
</style>
