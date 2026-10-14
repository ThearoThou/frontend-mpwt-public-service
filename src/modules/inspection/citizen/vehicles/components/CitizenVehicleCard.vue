<script setup lang="ts">
  import type { Vehicle } from '../types/vehicle.types'

  interface Status {
    color: string
    icon?: string
    label: string
    modifier: string
  }

  defineProps<{
    vehicle: Vehicle
    vehicleIcon: string
    plateLabel: string
    vehicleName: string
    certificateNumber: string
    hasCertificateNumber: boolean
    transactionNumber: string
    hasTransactionNumber: boolean
    inspectionStatus: Status
    renewalStatus?: Status
    expiryDate: string
    actionLabel: string
    actionIcon: string
    actionLoading?: boolean
  }>()

  const emit = defineEmits<{ renew: [] }>()
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <article class="vehicle-card">
    <div class="vehicle-card__main">
      <div class="d-flex align-start justify-space-between ga-3">
        <v-avatar class="vehicle-card__icon" :icon="vehicleIcon" size="52" />
        <div v-if="renewalStatus" class="text-right"><div class="vehicle-inspection-status-row"><v-chip :class="['vehicle-renewal-state', `vehicle-renewal-state--${renewalStatus.modifier}`]" :color="renewalStatus.color" :prepend-icon="renewalStatus.icon" size="small" variant="tonal">{{ renewalStatus.label }}</v-chip></div></div>
      </div>
      <div class="vehicle-card__title"><h2><span class="vehicle-plate-label">{{ plateLabel }}</span>{{ vehicle.plateNumber }}</h2><p>{{ vehicleName }}</p></div>
      <dl class="vehicle-facts">
        <div class="vehicle-facts__identifier"><dt>{{ $t('inspection_vehicle_certificate_number') }}</dt><dd :class="{ 'vehicle-facts__placeholder': !hasCertificateNumber }">{{ certificateNumber }}</dd></div>
        <div class="vehicle-facts__identifier"><dt>{{ $t('inspection_vehicle_transaction_number') }}</dt><dd :class="{ 'vehicle-facts__placeholder': !hasTransactionNumber }">{{ transactionNumber }}</dd></div>
        <div class="vehicle-facts__inspection-status"><dt>{{ $t('inspection_vehicle_inspection_status') }}</dt><dd><v-chip :class="['vehicle-state', `vehicle-state--${inspectionStatus.modifier}`]" :color="inspectionStatus.color" size="small" variant="tonal">{{ inspectionStatus.label }}</v-chip></dd></div>
        <div :class="`vehicle-facts__expiry vehicle-facts__expiry--${inspectionStatus.modifier}`"><dt>{{ $t('inspection_dashboard_expiry_date') }}</dt><dd>{{ expiryDate }}</dd></div>
      </dl>
    </div>
    <div class="vehicle-card__actions"><v-btn class="flex-grow-1" prepend-icon="mdi-eye-outline" :to="`/services/inspection/vehicles/${vehicle.id}`" variant="outlined">{{ $t('inspection_dashboard_view_vehicle') }}</v-btn><v-btn class="flex-grow-1" color="primary" :loading="actionLoading" :prepend-icon="actionIcon" @click="emit('renew')">{{ actionLabel }}</v-btn></div>
  </article>
</template>

<style scoped>
  .vehicle-card { background: #fff; border: 1px solid #d4d5de; border-radius: 20px; box-shadow: 0 6px 16px rgba(31, 36, 69, .05); display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
  .vehicle-card__main { display: flex; flex: 1; flex-direction: column; padding: 16px 18px 13px; }
  .vehicle-card__icon { background: #dbe3ff; color: #142c68; }
  .vehicle-inspection-status-row { display: flex; justify-content: flex-end; }
  .vehicle-state { box-shadow: none !important; filter: none; font-size: .95rem !important; font-weight: 800; height: 28px !important; min-height: 28px; }
  .vehicle-renewal-state { box-shadow: none !important; display: flex; filter: none; font-size: .82rem !important; font-weight: 800; height: 28px !important; min-height: 28px; }
  .vehicle-state :deep(.v-chip__content), .vehicle-renewal-state :deep(.v-chip__content) { font-size: .82rem !important; line-height: 1.5; }
  .vehicle-state--expired { background: #fff0f0 !important; color: #b42318 !important; }.vehicle-state--expiring { background: #fff3e8 !important; color: #c25f00 !important; }.vehicle-state--valid { background: #ecfdf3 !important; color: #166534 !important; }
  .vehicle-renewal-state--info { background: #e8f4fc !important; color: #1683bd !important; }.vehicle-renewal-state--deep-purple { background: #f4f1ff !important; color: #5b21b6 !important; }.vehicle-renewal-state--secondary { background: #f7f2ff !important; color: #6b21a8 !important; }.vehicle-renewal-state--success { background: #ecfdf3 !important; color: #166534 !important; }.vehicle-renewal-state--warning { background: #fff3e8 !important; color: #c25f00 !important; }.vehicle-renewal-state--error { background: #fff0f0 !important; color: #b42318 !important; }
  .vehicle-card__title { margin-top: 11px; }.vehicle-card__title h2 { align-items: center; color: #171b28 !important; display: flex; flex-wrap: wrap; font-size: 1rem !important; font-weight: 400 !important; gap: 7px; line-height: 1.25; }.vehicle-plate-label { color: #171b28 !important; font: inherit; font-weight: 400 !important; }.vehicle-card__title p { color: #173d8d !important; font-size: .95rem !important; font-weight: 400 !important; line-height: 1.45; margin-top: 3px; }
  .vehicle-facts { margin-top: 12px; }.vehicle-facts > div { align-items: center; display: grid; gap: 12px; grid-template-columns: minmax(86px, 1fr) minmax(106px, 1.3fr); min-height: 48px; }.vehicle-facts dt { color: #4f5361; font-size: .85rem !important; font-weight: 600; line-height: 1.45; }.vehicle-facts dd { color: #181c27; font-size: .95rem !important; font-weight: 800; line-height: 1.45; margin: 0; overflow-wrap: anywhere; text-align: right; }.vehicle-facts__placeholder { color: #252934 !important; font-style: normal; font-weight: 400 !important; }
  .vehicle-facts__type { align-items: start !important; grid-template-columns: minmax(82px, .75fr) minmax(175px, 1.75fr) !important; padding-block: 10px; }.vehicle-facts__type dt { padding-top: 2px; }.vehicle-facts__type dd { font-size: .91rem !important; line-height: 1.5; }.vehicle-facts__type + .vehicle-facts__identifier, .vehicle-facts__inspection-status { margin-top: 10px; }.vehicle-facts__expiry { background: transparent; border-radius: 0; grid-template-columns: minmax(86px, 1fr) minmax(106px, 1.3fr) !important; }.vehicle-facts__expiry--valid dd { color: #166534; }.vehicle-facts__expiry--expired dd { color: #b42318; }.vehicle-facts__expiry--expiring dd { color: #92400e; }
  .vehicle-card__actions { background: #fafafd; border-top: 1px solid #d7d8e1; display: flex; gap: 8px; margin-top: auto; padding: 10px 12px; }.vehicle-card__actions :deep(.v-btn) { font-size: .85rem !important; font-weight: 800; letter-spacing: 0; min-height: 39px; text-transform: none; }
  @media (max-width: 600px) { .vehicle-card__main { padding: 22px 20px; }.vehicle-card__actions { flex-direction: column; padding: 16px; }.vehicle-facts > div { align-items: start; grid-template-columns: 1fr; padding-block: 9px; }.vehicle-facts dd { text-align: left; }.vehicle-facts__expiry { grid-template-columns: 1fr !important; } }
</style>
