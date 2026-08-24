<script setup lang="ts">
  import type { Vehicle } from '@/modules/inspection/citizen/vehicles/types/vehicle.types'
  import { useI18n } from 'vue-i18n'
  import { useInspectionAuthStore } from '@/modules/inspection/auth/stores/auth.store'
  import { inspectionVehicleService } from '@/modules/inspection/citizen/vehicles/services/vehicle.service'

  type InspectionState = 'expired' | 'expiring' | 'valid'

  const { locale } = useI18n()
  const authStore = useInspectionAuthStore()
  const sessionCheckComplete = ref(false)
  const vehicles = ref<Vehicle[]>([])
  const loadingVehicles = ref(false)
  const vehicleLoadError = ref(false)
  const visibleVehicles = computed(() => vehicles.value.slice(0, 3))

  onMounted(async () => {
    await authStore.restoreSession()
    sessionCheckComplete.value = true

    if (!authStore.isCitizen) return

    await loadVehicles()
  })

  async function loadVehicles () {
    loadingVehicles.value = true
    vehicleLoadError.value = false
    try {
      vehicles.value = (await inspectionVehicleService.lookup({})).data
    } catch {
      vehicleLoadError.value = true
    } finally {
      loadingVehicles.value = false
    }
  }

  function getInspectionState (vehicle: Vehicle): InspectionState {
    const remainingDays = Math.ceil((new Date(vehicle.inspectionExpiryDate).getTime() - Date.now()) / 86_400_000)
    if (remainingDays < 0) return 'expired'
    if (remainingDays <= 30) return 'expiring'
    return 'valid'
  }

  function getInspectionStateKey (vehicle: Vehicle) {
    return `inspection_dashboard_${getInspectionState(vehicle)}`
  }

  function getInspectionStateColor (vehicle: Vehicle) {
    return { expired: 'error', expiring: 'warning', valid: 'success' }[getInspectionState(vehicle)]
  }

  function formatInspectionDate (value: string) {
    return new Intl.DateTimeFormat(locale.value === 'kh' ? 'km-KH' : 'en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    }).format(new Date(value))
  }

  function formatVehicleModel (vehicle: Vehicle) {
    return [vehicle.make, vehicle.model, vehicle.manufactureYear].filter(Boolean).join(' ')
  }
</script>

<template>
  <section class="dashboard-view">
    <v-sheet class="dashboard-hero pa-4 pa-md-6" rounded="xl">
      <p class="text-overline font-weight-bold mb-2">{{ $t('inspection_service_label') }}</p>
      <h1 class="dashboard-hero-title mb-3">{{ $t('inspection_dashboard_welcome') }}</h1>
      <p class="dashboard-hero-copy mb-4">{{ $t('inspection_dashboard_description') }}</p>

      <v-btn
        color="white"
        :prepend-icon="authStore.isCitizen ? 'mdi-car-arrow-right' : 'mdi-login'"
        rounded="pill"
        size="default"
        :to="authStore.isCitizen ? '/services/inspection/renewal' : { path: '/services/inspection/login', query: { redirect: '/services/inspection/dashboard' } }"
        variant="flat"
      >
        {{ authStore.isCitizen ? $t('inspection_dashboard_renewal_cta') : $t('inspection_sign_in') }}
      </v-btn>
    </v-sheet>

    <template v-if="sessionCheckComplete && authStore.isCitizen">
      <v-card
        border
        class="dashboard-notice pa-3 pa-md-4 mt-4"
        elevation="0"
        rounded="xl"
        to="/services/inspection/applications"
      >
        <div class="d-flex align-center justify-space-between ga-4">
          <div class="d-flex align-center ga-4">
            <v-avatar color="primary" icon="mdi-file-document-outline" size="56" variant="tonal" />

            <div>
              <h2 class="text-h6 font-weight-bold mb-1">{{ $t('inspection_dashboard_notice') }}</h2>
              <p class="text-body-1 text-medium-emphasis mb-0">{{ $t('inspection_dashboard_notice_description') }}</p>
            </div>
          </div>

          <v-icon icon="mdi-chevron-right" size="32" />
        </div>
      </v-card>

      <div class="d-flex flex-wrap align-center justify-space-between ga-3 mt-6 mb-3">
        <h2 class="text-h6 font-weight-bold">{{ $t('inspection_dashboard_vehicle_overview') }}</h2>
        <v-btn append-icon="mdi-chevron-right" color="primary" to="/services/inspection/vehicles" variant="text">{{ $t('inspection_dashboard_view_all') }}</v-btn>
      </div>

      <div v-if="loadingVehicles" class="py-10 text-center"><v-progress-circular color="primary" indeterminate /></div>
      <v-alert v-else-if="vehicleLoadError" type="error">{{ $t('inspection_dashboard_vehicle_load_error') }}</v-alert>
      <v-alert v-else-if="vehicles.length === 0" type="info">{{ $t('inspection_dashboard_no_vehicles') }}</v-alert>

      <v-row v-else>
        <v-col v-for="vehicle in visibleVehicles" :key="vehicle.id" cols="12" lg="4">
          <v-card border class="vehicle-dashboard-card d-flex flex-column pa-3 pa-md-4" elevation="0" rounded="xl">
            <div class="d-flex align-start justify-space-between ga-3">
              <v-avatar color="primary" icon="mdi-car-outline" size="56" variant="tonal" />

              <v-chip :color="getInspectionStateColor(vehicle)" :prepend-icon="getInspectionState(vehicle) === 'valid' ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline'" variant="tonal">
                {{ $t(getInspectionStateKey(vehicle)) }}
              </v-chip>
            </div>

            <div class="mt-4">
              <h3 class="text-h6 font-weight-bold mb-1">{{ vehicle.plateDisplayLabelKh || vehicle.plateNumber }}</h3>
              <p class="text-subtitle-1 text-primary font-weight-bold mb-2">{{ formatVehicleModel(vehicle) }}</p>
              <p class="text-body-2 text-medium-emphasis mb-4">{{ vehicle.vehicleType }}<span v-if="vehicle.vehicleClass"> · {{ vehicle.vehicleClass }}</span></p>

              <v-sheet class="inspection-expiry d-flex align-center ga-2 px-3 py-3" :class="`inspection-expiry--${getInspectionState(vehicle)}`" rounded="lg">
                <v-icon icon="mdi-calendar-month-outline" />
                <span>{{ $t('inspection_dashboard_expiry_date') }}: <strong>{{ formatInspectionDate(vehicle.inspectionExpiryDate) }}</strong></span>
              </v-sheet>
            </div>

            <div class="d-flex ga-3 mt-auto pt-4">
              <v-btn class="flex-grow-1" prepend-icon="mdi-eye-outline" :to="`/services/inspection/vehicles/${vehicle.id}`" variant="outlined">{{ $t('inspection_dashboard_view_vehicle') }}</v-btn>

              <v-btn
                v-if="getInspectionState(vehicle) !== 'valid'"
                class="flex-grow-1"
                color="primary"
                prepend-icon="mdi-refresh"
                to="/services/inspection/renewal"
              >
                {{ $t('inspection_dashboard_renew_vehicle') }}
              </v-btn>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </section>
</template>

<style scoped>
  .dashboard-hero { background: #2a3472; color: white; }
  .dashboard-hero-title { font-size: clamp(1.55rem, 2.2vw, 2.25rem); font-weight: 700; line-height: 1.25; }
  .dashboard-hero-copy { color: #c1c9ee; font-size: clamp(.9rem, 1.1vw, 1rem); line-height: 1.55; max-width: 760px; }
  .dashboard-notice { cursor: pointer; transition: border-color .15s ease, transform .15s ease; }
  .dashboard-notice:hover { border-color: #2a3472 !important; transform: translateY(-1px); }
  .vehicle-dashboard-card { height: 100%; }
  .inspection-expiry { background: #f4f2f6; color: #363640; }
  .inspection-expiry--expired { background: #fff0f0; color: #bb1e22; }
  .inspection-expiry--expiring { background: #fff9e7; color: #9a530d; }
  .inspection-expiry--valid { background: #effbf3; color: #18733a; }
</style>
