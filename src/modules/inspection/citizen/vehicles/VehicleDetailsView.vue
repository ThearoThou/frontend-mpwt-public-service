<script setup lang="ts">
  import type { Vehicle } from './types/vehicle.types'
  import { isAxiosError } from 'axios'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { useInspectionAuthStore } from '@/modules/inspection/auth/stores/auth.store'
  import { inspectionApplicationService } from '../applications/services/application.service'
  import { inspectionVehicleService } from './services/vehicle.service'

  type ApiErrorResponse = { code?: string }
  type InspectionState = 'expired' | 'expiring' | 'valid'
  const { locale, t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const authStore = useInspectionAuthStore()
  const vehicle = ref<Vehicle | null>(null)
  const loading = ref(true)
  const loadError = ref(false)
  const creatingDraft = ref(false)
  const renewalError = ref<string | null>(null)
  const profile = computed(() => authStore.currentUser?.citizenProfile)
  const ownerName = computed(() => vehicle.value?.registeredOwnerNameKh || vehicle.value?.registeredOwnerNameEn || profile.value?.nameKh || profile.value?.nameEn || '—')
  const formattedPlate = computed(() => vehicle.value === null
    ? t('inspection_vehicle_details')
    : `${plateCategoryLabel(vehicle.value)} ${vehicle.value.plateNumber}`)
  const stateText = computed(() => vehicle.value ? t(`inspection_dashboard_${inspectionState(vehicle.value)}`) : '')

  onMounted(loadVehicle)
  watch(() => (route.params as Record<string, string | undefined>).id, loadVehicle)
  async function loadVehicle () {
    const vehicleId = String((route.params as Record<string, string | undefined>).id || '')
    if (!vehicleId) return
    loading.value = true; loadError.value = false
    try { vehicle.value = await inspectionVehicleService.getById(vehicleId) } catch { loadError.value = true } finally { loading.value = false }
  }
  function inspectionState (value: Vehicle): InspectionState { const days = daysUntilExpiry(value); return days < 0 ? 'expired' : days <= 30 ? 'expiring' : 'valid' }
  function daysUntilExpiry (value: Vehicle) { return Math.ceil((new Date(value.inspectionExpiryDate).getTime() - Date.now()) / 86_400_000) }
  function stateColor (value: Vehicle) { return { expired: 'error', expiring: 'warning', valid: 'success' }[inspectionState(value)] }
  function formatDate (date: string | null) { return date ? new Intl.DateTimeFormat(locale.value === 'kh' ? 'km-KH' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date)) : '—' }
  function formatPhoneNumber (value: string | null | undefined) {
    if (!value) return '—'

    const normalized = value.replace(/[\s-]/g, '')
    if (!normalized.startsWith('+855')) return value

    return `0${normalized.slice(4).replace(/^0/, '')}`
  }
  function vehicleName (value: Vehicle) { return [value.make, value.model].filter(Boolean).join(' ') || '—' }
  function vehicleClassLabel (value: Vehicle) {
    if (value.vehicleClass === 'LIGHT') return t('inspection_vehicle_class_light')
    if (value.vehicleClass === 'HEAVY') return t('inspection_vehicle_class_heavy')
    return '—'
  }
  function plateCategoryLabel (value: Vehicle) {
    if (value.plateCategory === 'PERSONALIZED_CAMBODIA') return t('inspection_plate_cambodia')
    if (value.plateProvince === 'ភ្នំពេញ' || value.plateProvince?.toLowerCase() === 'phnom penh') return t('inspection_plate_phnom_penh')
    return value.plateProvince || t('inspection_plate_category_province')
  }

  async function continueRenewal () {
    if (vehicle.value === null || creatingDraft.value) return

    creatingDraft.value = true
    renewalError.value = null
    try {
      const application = await inspectionApplicationService.createDraft(vehicle.value.id)
      await router.push({ path: '/services/inspection/renewal/documents', query: { applicationId: application.id } })
    } catch (error) {
      if (isUnfinishedApplicationError(error)) {
        await resumeExistingDraft(vehicle.value.id)
        return
      }

      renewalError.value = getRenewalErrorMessage(error)
    } finally {
      creatingDraft.value = false
    }
  }

  function isUnfinishedApplicationError (error: unknown): boolean {
    return isAxiosError<ApiErrorResponse>(error)
      && error.response?.data?.code === 'UNFINISHED_APPLICATION_ALREADY_EXISTS'
  }

  function getRenewalErrorMessage (error: unknown): string {
    if (isAxiosError<ApiErrorResponse>(error)
      && error.response?.data?.code === 'VEHICLE_CLASSIFICATION_INCOMPLETE') {
      return 'inspection_vehicle_classification_incomplete'
    }

    return 'inspection_draft_creation_error'
  }

  async function resumeExistingDraft (vehicleId: string) {
    try {
      const applications = await inspectionApplicationService.listCitizenApplications()
      const draft = applications.find(application => application.vehicleId === vehicleId && application.status === 'DRAFT')

      if (draft !== undefined) {
        await router.push({ path: '/services/inspection/renewal/documents', query: { applicationId: draft.id } })
        return
      }
    } catch {
      // Fall through to the localized error below.
    }

    renewalError.value = 'inspection_unfinished_application_error'
  }
</script>

<template>
  <section class="vehicle-details-view">
    <div class="details-topline"><v-breadcrumbs class="details-breadcrumbs px-0" density="compact"><v-breadcrumbs-item to="/services/inspection/vehicles">{{ $t('inspection_my_vehicles') }}</v-breadcrumbs-item><v-breadcrumbs-divider icon="mdi-chevron-right" /><v-breadcrumbs-item active active-color="primary" class="details-breadcrumbs__current">{{ formattedPlate }}</v-breadcrumbs-item></v-breadcrumbs><v-btn class="back-action" prepend-icon="mdi-arrow-left" to="/services/inspection/vehicles" variant="text">{{ $t('inspection_back_to_vehicles') }}</v-btn></div>
    <div v-if="loading" class="details-state"><v-progress-circular color="primary" indeterminate size="44" /></div>
    <v-alert v-else-if="loadError || !vehicle" type="error" variant="tonal"><div class="d-flex flex-wrap align-center justify-space-between ga-3">{{ $t('inspection_vehicle_detail_load_error') }}<v-btn color="error" variant="outlined" @click="loadVehicle">{{ $t('retry') }}</v-btn></div></v-alert>
    <template v-else>
      <header class="details-heading"><h1>{{ $t('inspection_vehicle_detail_title') }}</h1></header>
      <v-alert v-if="renewalError" class="mb-4" density="compact" type="error" variant="tonal">{{ $t(renewalError) }}</v-alert>
      <div class="details-summary-grid">
        <v-card class="details-card vehicle-information" elevation="0"><div class="details-card__title"><v-avatar color="primary" icon="mdi-car-outline" size="58" variant="tonal" /><h2>{{ $t('inspection_vehicle_information') }}</h2></div><v-divider class="my-5" /><dl class="details-grid"><div><dt>{{ $t('inspection_plate_label') }}</dt><dd>{{ plateCategoryLabel(vehicle) }} {{ vehicle.plateNumber }}</dd></div><div><dt>{{ $t('inspection_make_and_model') }}</dt><dd>{{ vehicleName(vehicle) }}</dd></div><div><dt>{{ $t('inspection_manufacture_year') }}</dt><dd>{{ vehicle.manufactureYear || '—' }}</dd></div><div><dt>{{ $t('inspection_vehicle_type') }}</dt><dd>{{ vehicle.vehicleType || '—' }}</dd></div><div><dt>{{ $t('inspection_vehicle_class') }}</dt><dd>{{ vehicleClassLabel(vehicle) }}</dd></div><div><dt>{{ $t('inspection_registration_number') }}</dt><dd>{{ vehicle.registrationNumber || '—' }}</dd></div><div><dt>{{ $t('inspection_chassis_number') }}</dt><dd>{{ vehicle.chassisNumber || '—' }}</dd></div><div><dt>{{ $t('inspection_first_registration_date') }}</dt><dd>{{ formatDate(vehicle.firstRegistrationDate) }}</dd></div></dl></v-card>
        <aside class="inspection-status-card"><div class="d-flex align-center justify-space-between ga-2"><h2>{{ $t('inspection_status') }}</h2><v-chip :color="stateColor(vehicle)" size="small" variant="flat"><v-icon class="mr-1" icon="mdi-check-circle" size="14" />{{ stateText }}</v-chip></div><dl><div><dt>{{ $t('inspection_last_inspection_date') }}</dt><dd>{{ formatDate(vehicle.lastInspectionDate) }}</dd></div><div><dt>{{ $t('inspection_dashboard_expiry_date') }}</dt><dd>{{ formatDate(vehicle.inspectionExpiryDate) }}</dd></div></dl><strong class="days-remaining" :class="`days-remaining--${inspectionState(vehicle)}`">{{ Math.abs(daysUntilExpiry(vehicle)) }} {{ $t(daysUntilExpiry(vehicle) < 0 ? 'inspection_days_overdue' : 'inspection_days_remaining') }}</strong><span>{{ $t(daysUntilExpiry(vehicle) < 0 ? 'inspection_expired_since' : 'inspection_until_expiry') }}</span></aside>
      </div>
      <v-card class="details-card owner-card" elevation="0"><div class="details-card__title"><v-avatar color="primary" icon="mdi-account-outline" size="58" variant="tonal" /><h2>{{ $t('inspection_registered_owner') }}</h2></div><v-divider class="my-5" /><dl class="owner-grid"><div><dt>{{ $t('inspection_owner_name') }}</dt><dd>{{ ownerName }}</dd></div><div><dt>{{ $t('inspection_national_id') }}</dt><dd>{{ profile?.nationalIdNumber || '—' }}</dd></div><div><dt>{{ $t('inspection_phone') }}</dt><dd>{{ formatPhoneNumber(vehicle.registeredOwnerPhone || authStore.currentUser?.user.phone) }}</dd></div><div><dt>{{ $t('inspection_address') }}</dt><dd>{{ profile?.address || '—' }}</dd></div></dl></v-card>
      <v-card class="details-card inspection-history-card" elevation="0"><div class="details-card__title"><v-avatar color="primary" icon="mdi-history" size="58" variant="tonal" /><h2>{{ $t('inspection_vehicle_inspection_history') }}</h2></div><v-divider class="my-5" /><div class="history-table" role="table"><div class="history-row history-row--header" role="row"><span>{{ $t('inspection_last_inspection_date') }}</span><span>{{ $t('inspection_registration_number') }}</span><span>{{ $t('inspection_status') }}</span></div><div class="history-row" role="row"><span>{{ formatDate(vehicle.lastInspectionDate) }}</span><span>{{ vehicle.registrationNumber || '—' }}</span><span class="history-success"><v-icon icon="mdi-check-circle-outline" size="16" /> {{ $t('inspection_completed') }}</span></div></div></v-card>
      <div class="details-actions"><v-btn v-if="inspectionState(vehicle) !== 'valid'" color="primary" :loading="creatingDraft" prepend-icon="mdi-refresh" size="large" @click="continueRenewal">{{ $t('inspection_dashboard_renew_vehicle') }}</v-btn><v-btn color="primary" prepend-icon="mdi-file-document-outline" size="large" to="/services/inspection/inspection-history" variant="outlined">{{ $t('inspection_view_inspection_history') }}</v-btn></div>
    </template>
  </section>
</template>

<style scoped>
  .vehicle-details-view { margin-inline: auto; max-width: 960px; padding-bottom: 20px; }.details-topline { align-items: center; display: flex; justify-content: space-between; min-height: 32px; }.details-breadcrumbs :deep(.v-breadcrumbs-item--link) { color: #697080; }.details-breadcrumbs :deep(.details-breadcrumbs__current) { background: #e9ebf8; border-radius: 999px; color: #2a3472; font-weight: 700; padding: 4px 10px; }.back-action { color: #233766; font-size: .78rem; font-weight: 800; letter-spacing: 0; }.details-heading { margin: 10px 0 17px; }.details-heading h1 { color: #102652; font-size: clamp(1.3rem, 2.1vw, 1.75rem); font-weight: 800; line-height: 1.22; }.details-heading p { align-items: center; color: #20212a; display: flex; flex-wrap: wrap; font-size: .98rem; font-weight: 800; gap: 6px; margin-top: 3px; }.details-plate-label { color: #3a3b43; font: inherit; font-weight: 700; }.details-state { display: grid; min-height: 380px; place-items: center; }
  .details-summary-grid { align-items: start; display: grid; gap: 16px; grid-template-columns: minmax(0, 1.9fr) minmax(215px, .9fr); }.details-card { border: 1px solid #eff0f4; border-radius: 12px; box-shadow: 0 4px 13px rgba(32, 38, 71, .045); padding: 16px; }.details-card__title { align-items: center; display: flex; gap: 9px; }.details-card__title :deep(.v-avatar) { height: 42px !important; width: 42px !important; }.details-card__title h2 { color: #22242d; font-size: clamp(1rem, 1.5vw, 1.22rem); font-weight: 800; }.details-grid, .owner-grid { display: grid; gap: 15px 24px; grid-template-columns: repeat(2, minmax(0, 1fr)); }.details-grid dt, .owner-grid dt { color: #6c6e79; font-size: .74rem; font-weight: 600; margin-bottom: 2px; }.details-grid dd, .owner-grid dd { color: #282a33; font-size: .87rem; font-weight: 800; margin: 0; overflow-wrap: anywhere; }
  .inspection-status-card { background: #293675; border-radius: 12px; box-shadow: 0 5px 13px rgba(41, 54, 117, .16); color: white; padding: 16px; }.inspection-status-card h2 { font-size: 1.12rem; font-weight: 800; }.inspection-status-card :deep(.v-chip) { font-size: .69rem; font-weight: 800; }.inspection-status-card dl { margin: 11px 0; }.inspection-status-card dl div { align-items: center; border-bottom: 1px solid rgba(255,255,255,.14); display: flex; gap: 8px; justify-content: space-between; padding: 8px 0; }.inspection-status-card dt { color: #aeb9e6; font-size: .7rem; font-weight: 600; }.inspection-status-card dd { font-size: .79rem; font-weight: 800; margin: 0; text-align: right; }.days-remaining { display: block; font-size: 1.28rem; line-height: 1.1; text-align: center; }.days-remaining--expired { color: #ffb4b8; }.days-remaining--expiring { color: #ffda87; }.inspection-status-card > span { color: #b9c3ee; display: block; font-size: .68rem; margin-top: 5px; text-align: center; }
  .owner-card, .inspection-history-card { margin-top: 13px; }.owner-grid { grid-template-columns: 1.05fr 1.1fr 1fr 1.2fr; }.history-table { width: 100%; }.history-row { border-bottom: 1px solid #e0e1e7; display: grid; gap: 12px; grid-template-columns: 1fr 1fr .72fr; padding: 8px 10px; }.history-row--header { color: #6c6e79; font-size: .72rem; font-weight: 700; }.history-row:not(.history-row--header) { color: #2e3039; font-size: .8rem; font-weight: 700; }.history-success { align-items: center; color: #348b46; display: flex; gap: 4px; }.details-actions { border-top: 1px solid #dedfe6; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; padding-top: 14px; }.details-actions :deep(.v-btn) { font-size: .78rem; font-weight: 800; letter-spacing: 0; min-height: 34px; }
  @media (max-width: 960px) { .details-summary-grid { grid-template-columns: 1fr; }.owner-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }@media (max-width: 600px) { .details-topline { align-items: flex-start; flex-direction: column; gap: 6px; }.details-heading { margin-bottom: 22px; }.details-card { border-radius: 14px; padding: 20px; }.details-grid, .owner-grid { gap: 22px; grid-template-columns: 1fr; }.history-row { font-size: .85rem; gap: 9px; grid-template-columns: 1fr .9fr .7fr; padding: 13px 0; }.details-actions { flex-direction: column; } }
</style>
