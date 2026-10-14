<script setup lang="ts">
  import type { TechnicalInspectionCertificateStatus } from '../applications/types/application.types'
  import type { CitizenInspectionHistoryItem } from './types/inspection-history.types'
  import { useI18n } from 'vue-i18n'
  import TechnicalInspectionCertificateCard from '../applications/components/TechnicalInspectionCertificateCard.vue'
  import { inspectionApplicationService } from '../applications/services/application.service'
  import { formatProvince } from '../vehicles/utils/province-label'
  import { formatVehicleType } from '../vehicles/utils/vehicle-type-label'
  import { inspectionHistoryService } from './services/inspection-history.service'
  import { formatInspectionHistoryDate, inspectionResultLabel, knownInspectionFailureReasonLabel } from './utils/inspection-history-display'

  const props = defineProps<{ inspectionId: string }>()
  const { locale, t } = useI18n()
  const inspection = ref<CitizenInspectionHistoryItem | null>(null)
  const certificate = ref<TechnicalInspectionCertificateStatus | null>(null)
  const loading = ref(true)
  const loadError = ref(false)
  const unavailable = '\u2014'

  const plateLabel = computed(() => {
    if (!inspection.value) return ''
    return [formatProvince(inspection.value.vehicle.plateProvince, locale.value), inspection.value.vehicle.plateNumber].filter(Boolean).join(' ')
  })
  const stationName = computed(() => {
    if (!inspection.value?.station) return unavailable
    return locale.value === 'kh' ? inspection.value.station.nameKh || inspection.value.station.nameEn : inspection.value.station.nameEn || inspection.value.station.nameKh
  })
  const vehicleName = computed(() => [inspection.value?.vehicle.make, inspection.value?.vehicle.model].filter(Boolean).join(' ') || unavailable)
  const inspectionCategoryName = computed(() => {
    const category = inspection.value?.inspectionCategory
    if (!category) return unavailable
    return locale.value === 'kh' ? category.nameKh || category.nameEn : category.nameEn || category.nameKh
  })
  const resultLabel = computed(() => inspection.value ? inspectionResultLabel(inspection.value.result, t) : '')
  const resultColor = computed(() => inspection.value?.result === 'PASS' ? 'success' : 'error')
  const resultIcon = computed(() => inspection.value?.result === 'PASS' ? 'mdi-check-circle-outline' : 'mdi-close-circle-outline')
  const failureReasonLabel = computed(() => knownInspectionFailureReasonLabel(inspection.value?.failureReason ?? null, locale.value))
  function formatDate (value: string | null) {
    return formatInspectionHistoryDate(value, locale.value)
  }

  onMounted(async () => {
    try {
      inspection.value = await inspectionHistoryService.detail(props.inspectionId)
      if (inspection.value.result === 'PASS') {
        try {
          const response = await inspectionApplicationService.getApplicationCertificate(inspection.value.applicationId)
          certificate.value = response.issued ? response : null
        } catch {
          certificate.value = null
        }
      }
    } catch {
      loadError.value = true
    } finally {
      loading.value = false
    }
  })
</script>

<template>
  <section class="inspection-detail citizen-auth-type-scale">
    <div class="inspection-detail__topline">
      <div v-if="inspection" class="inspection-detail__breadcrumbs">
        <RouterLink to="/services/inspection/inspection-history">{{ $t('inspection_history') }}</RouterLink>
        <span aria-hidden="true">/</span>
        <strong class="inspection-detail__plate-label">{{ plateLabel }}</strong>
      </div>

      <v-btn class="inspection-detail__back" prepend-icon="mdi-arrow-left" to="/services/inspection/inspection-history" variant="text">{{ $t('inspection_history_back') }}</v-btn>
    </div>

    <div v-if="loading" class="inspection-detail__state"><v-progress-circular color="primary" indeterminate /></div>
    <v-alert v-else-if="loadError || !inspection" type="error" variant="tonal">{{ $t('inspection_history_load_error') }}</v-alert>

    <template v-else>
      <h1 class="inspection-detail__title">{{ $t('inspection_history_details') }}</h1>

      <v-card class="inspection-detail__summary" elevation="0">
        <div>
          <span>{{ $t('inspection_history_transaction_number') }}</span>
          <strong>{{ inspection.transactionNumber || unavailable }}</strong>
          <div class="inspection-detail__reference"><span>{{ $t('inspection_history_application_reference') }}</span><b>{{ inspection.referenceNumber || unavailable }}</b></div>
        </div>

        <v-chip
          :class="['inspection-detail__result-chip', `inspection-detail__result-chip--${inspection.result.toLowerCase()}`]"
          :color="resultColor"
          :prepend-icon="resultIcon"
          size="small"
          variant="tonal"
        >{{ resultLabel }}</v-chip>
      </v-card>

      <div class="inspection-detail__grid">
        <v-card class="inspection-detail__card" elevation="0">
          <div class="inspection-detail__card-title"><v-avatar color="primary" icon="mdi-car-outline" size="42" variant="tonal" /><h2>{{ $t('inspection_history_vehicle') }}</h2></div>

          <dl class="inspection-detail__facts">
            <div><dt>{{ $t('inspection_history_plate_label') }}</dt><dd>{{ plateLabel || unavailable }}</dd></div>
            <div><dt>{{ $t('inspection_make_and_model') }}</dt><dd>{{ vehicleName }}</dd></div>
            <div><dt>{{ $t('inspection_manufacture_year') }}</dt><dd>{{ inspection.vehicle.manufactureYear || unavailable }}</dd></div>
            <div><dt>{{ $t('inspection_chassis_number') }}</dt><dd>{{ inspection.vehicle.chassisNumber || unavailable }}</dd></div>
            <div><dt>{{ $t('inspection_engine_number') }}</dt><dd>{{ inspection.vehicle.engineNumber || unavailable }}</dd></div>
            <div><dt>{{ $t('inspection_vehicle_type') }}</dt><dd>{{ formatVehicleType(inspection.vehicle.vehicleType, $t) }}</dd></div>
          </dl>
        </v-card>

        <v-card class="inspection-detail__card inspection-detail__inspection-card" elevation="0">
          <div class="inspection-detail__card-title"><v-avatar color="primary" icon="mdi-clipboard-check-outline" size="42" variant="tonal" /><h2>{{ $t('inspection_information') }}</h2></div>

          <dl class="inspection-detail__facts inspection-detail__inspection-facts">
            <div><dt>{{ $t('inspection_history_date') }}</dt><dd>{{ formatDate(inspection.inspectedAt) }}</dd></div>
            <div><dt>{{ $t('inspection_history_station') }}</dt><dd>{{ stationName }}</dd></div>
            <div><dt>{{ $t('inspection_payment_inspection_category') }}</dt><dd>{{ inspectionCategoryName }}</dd></div>
            <div v-if="inspection.result === 'PASS' && inspection.validUntil"><dt>{{ $t('inspection_history_expiry_date') }}</dt><dd>{{ formatDate(inspection.validUntil) }}</dd></div>
          </dl>

          <section v-if="inspection.result === 'FAIL' && inspection.failureReason" aria-labelledby="failure-reason-heading" class="inspection-detail__failure">
            <div><h3 id="failure-reason-heading">{{ $t('inspection_history_failure_reason') }}</h3><p>{{ failureReasonLabel }}</p></div>
          </section>
        </v-card>
      </div>

      <TechnicalInspectionCertificateCard v-if="inspection.result === 'PASS' && certificate" :application-id="inspection.applicationId" :certificate="certificate" />
    </template>
  </section>
</template>

<style scoped>
  .inspection-detail { max-width: 1120px; padding-bottom: 36px; }
  .inspection-detail__topline { align-items: center; display: flex; justify-content: space-between; min-height: 42px; }
  .inspection-detail__breadcrumbs { align-items: center; color: #697080; display: flex; gap: 12px; }
  .inspection-detail__breadcrumbs a { color: #697080; text-decoration: none; }
  .inspection-detail__breadcrumbs a:hover { color: #2a3472; text-decoration: underline; }
  .inspection-detail__plate-label { background: #d8def8; border-radius: 999px; color: #2a3472; font-weight: 700; padding: 5px 13px; }
  .inspection-detail__back { background: transparent !important; color: #2a3472; font-weight: 800; }
  .inspection-detail__back:hover, .inspection-detail__back:focus-visible { background: transparent !important; }
  .inspection-detail__back :deep(.v-btn__overlay), .inspection-detail__back :deep(.v-btn__underlay) { display: none; }
  .inspection-detail__state { display: grid; min-height: 340px; place-items: center; }
  .inspection-detail__title { color: #102652; font-size: clamp(1.35rem, 2vw, 1.72rem); font-weight: 800; line-height: 1.2; margin: 18px 0; }
  .inspection-detail__summary, .inspection-detail__card { border: 1px solid #e3e7ef; border-radius: 14px; box-shadow: none; }
  .inspection-detail__summary { align-items: flex-start; border-left: 4px solid #2a3472; display: flex; justify-content: space-between; margin-bottom: 24px; padding: 18px 24px; }
  .inspection-detail__summary span, dt { color: #656a78; display: block; font-size: .85rem; font-weight: 700; }
  .inspection-detail__summary > div > strong { color: #2a3472 !important; display: block; font-size: clamp(1.5rem, 2.2vw, 1.75rem); font-weight: 800; line-height: 1.25; margin-top: 3px; overflow-wrap: anywhere; }
  .inspection-detail__reference { margin-top: 12px; }
  .inspection-detail__reference b { color: #102652; display: block; font-size: .94rem; margin-top: 3px; overflow-wrap: anywhere; }
  .inspection-detail__result-chip { font-size: .84rem; font-weight: 800; }
  .inspection-detail__result-chip :deep(.v-chip__content) { align-items: center; display: inline-flex; line-height: 1.4; }
  .inspection-detail__result-chip :deep(.v-chip__prepend) { align-items: center; align-self: center; display: inline-flex; margin-top: 0; }
  .inspection-detail__result-chip :deep(.v-chip__prepend .v-icon) { line-height: 1; margin-top: 0; transform: translateY(2px); }
  .inspection-detail__result-chip--pass { background: #ecfdf3 !important; color: #166534 !important; }
  .inspection-detail__result-chip--fail { background: #fff0f0 !important; color: #991b1b !important; }
  .inspection-detail__grid { align-items: start; display: grid; gap: 24px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .inspection-detail__card { padding: 24px; }
  .inspection-detail__card-title { align-items: center; display: flex; gap: 12px; }
  .inspection-detail__card-title h2 { color: #2a3472; font-size: 1.05rem; font-weight: 800; }
  .inspection-detail__facts { display: grid; gap: 0 28px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 20px; }
  .inspection-detail__facts > div { border-top: 1px solid #eef0f4; padding: 15px 0; }
  .inspection-detail dt { color: #747987; font-size: .8rem !important; font-weight: 600; }
  dd { color: #20232c; font-size: .94rem; font-weight: 700; line-height: 1.55; margin: 5px 0 0; overflow-wrap: anywhere; }
  .inspection-detail__inspection-facts { grid-template-columns: 1fr; }
  .inspection-detail__failure { border-top: 1px solid #e8eaf0; color: #b42318; margin-top: 4px; padding: 18px 0 0; }
  .inspection-detail__failure h3 { color: #991b1b; font-size: .85rem; font-weight: 800; }
  .inspection-detail__failure p { color: #991b1b; font-weight: 650; line-height: 1.55; margin-top: 6px; overflow-wrap: anywhere; }
  @media (max-width: 850px) { .inspection-detail__topline { align-items: flex-start; flex-direction: column; gap: 6px; }.inspection-detail__grid { grid-template-columns: 1fr; }.inspection-detail__facts { grid-template-columns: 1fr; }.inspection-detail__summary { gap: 14px; }.inspection-detail__summary > .v-chip { flex: 0 0 auto; } }
</style>
