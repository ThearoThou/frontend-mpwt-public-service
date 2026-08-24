<script setup lang="ts">
  import { isAxiosError } from 'axios'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { inspectionApplicationService } from '../applications/services/application.service'
  import { inspectionVehicleService } from '../vehicles/services/vehicle.service'
  import { CAMBODIAN_CAPITAL_PROVINCES_KH, type Vehicle, type VehicleLookupQuery, type VehiclePlateCategory } from '../vehicles/types/vehicle.types'

  type ApiErrorResponse = { code?: string, message?: string }

  const { t } = useI18n()
  const router = useRouter()
  const chassisNumber = ref('')
  const plateCategory = ref<VehiclePlateCategory>('PROVINCE')
  const plateProvince = ref('')
  const plateNumber = ref('')
  const firstRegistrationDate = ref('')
  const vehicles = ref<Vehicle[]>([])
  const selectedVehicleId = ref<string | null>(null)
  const searched = ref(false)
  const searching = ref(false)
  const creatingDraft = ref(false)
  const errorMessage = ref('')

  const selectedVehicle = computed(() => vehicles.value.find(vehicle => vehicle.id === selectedVehicleId.value) ?? null)
  const plateCategoryItems = computed(() => [
    { title: t('inspection_plate_category_province'), value: 'PROVINCE' },
    { title: t('inspection_plate_category_personalized'), value: 'PERSONALIZED_CAMBODIA' },
  ])
  const provinceItems = computed(() => CAMBODIAN_CAPITAL_PROVINCES_KH.map(province => ({ title: province, value: province })))

  watch(plateCategory, category => {
    if (category === 'PERSONALIZED_CAMBODIA') plateProvince.value = ''
  })

  function clearResults () {
    vehicles.value = []
    selectedVehicleId.value = null
    searched.value = false
  }

  function searchQuery (): VehicleLookupQuery | null {
    const chassis = chassisNumber.value.trim()
    const plate = plateNumber.value.trim()
    const province = plateProvince.value.trim()
    const firstRegistration = firstRegistrationDate.value.trim()

    if (plate && plateCategory.value === 'PROVINCE' && !province) {
      errorMessage.value = t('inspection_plate_province_required')
      return null
    }

    const hasCompletePlate = Boolean(
      plate && (plateCategory.value === 'PERSONALIZED_CAMBODIA' || province),
    )

    if (!chassis && !hasCompletePlate) {
      errorMessage.value = t('inspection_vehicle_lookup_criteria_required')
      return null
    }

    return {
      ...(chassis ? { chassisNumber: chassis } : {}),
      ...(firstRegistration ? { firstRegistrationDate: firstRegistration } : {}),
      ...(
        plate
          ? {
            plateCategory: plateCategory.value,
            plateNumber: plate,
            ...(plateCategory.value === 'PROVINCE' ? { plateProvince: province } : {}),
          }
          : {}
      ),
    }
  }

  async function searchVehicles () {
    if (searching.value) return

    const query = searchQuery()
    if (query === null) return

    searching.value = true
    errorMessage.value = ''
    clearResults()
    try {
      const response = await inspectionVehicleService.lookup(query)
      vehicles.value = response.data
      searched.value = true
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'inspection_vehicle_lookup_error')
    } finally {
      searching.value = false
    }
  }

  async function startRenewal () {
    if (selectedVehicle.value === null || creatingDraft.value) return

    creatingDraft.value = true
    errorMessage.value = ''
    try {
      const application = await inspectionApplicationService.createDraft(selectedVehicle.value.id)
      await router.push({ path: '/services/inspection/renewal/documents', query: { applicationId: application.id } })
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'inspection_draft_creation_error')
    } finally {
      creatingDraft.value = false
    }
  }

  function resetSearch () {
    chassisNumber.value = ''
    plateCategory.value = 'PROVINCE'
    plateProvince.value = ''
    plateNumber.value = ''
    firstRegistrationDate.value = ''
    errorMessage.value = ''
    clearResults()
  }

  function getErrorMessage (error: unknown, fallback: string): string {
    if (!isAxiosError<ApiErrorResponse>(error)) return t(fallback)

    if (error.response?.data?.code === 'UNFINISHED_APPLICATION_ALREADY_EXISTS') {
      return t('inspection_unfinished_application_error')
    }

    const message = error.response?.data?.message
    return typeof message === 'string' && message.trim() ? message : t(fallback)
  }
</script>

<template>
  <section class="renewal-entry">
    <v-breadcrumbs class="px-0 pb-5" density="compact">
      <v-breadcrumbs-item to="/services/inspection/dashboard">{{ $t('inspection_dashboard') }}</v-breadcrumbs-item>
      <v-breadcrumbs-divider icon="mdi-chevron-right" />
      <v-breadcrumbs-item class="font-weight-bold" disabled>{{ $t('inspection_start_renewal') }}</v-breadcrumbs-item>
    </v-breadcrumbs>

    <v-card class="renewal-lookup-card pa-5 pa-md-7" elevation="0" rounded="xl">
      <div class="mb-6">
        <h1 class="text-h5 font-weight-bold mb-2">{{ $t('inspection_vehicle_lookup') }}</h1>
        <p class="text-body-1 text-medium-emphasis mb-0">{{ $t('inspection_vehicle_lookup_description') }}</p>
      </div>

      <v-alert v-if="errorMessage" class="mb-5" density="comfortable" type="error">{{ errorMessage }}</v-alert>

      <v-form class="renewal-lookup-form" @submit.prevent="searchVehicles">
        <v-row class="renewal-search-fields">
          <v-col cols="12" md="6">
            <label class="renewal-field-label" for="renewal-plate-category">{{ $t('inspection_plate_category') }} <span>*</span></label>

            <v-select
              id="renewal-plate-category"
              v-model="plateCategory"
              density="comfortable"
              hide-details
              :items="plateCategoryItems"
              variant="outlined"
            />
          </v-col>

          <v-col cols="12" md="6">
            <label class="renewal-field-label" for="renewal-plate-number">{{ $t('inspection_plate_number') }} <span>*</span></label>

            <v-text-field
              id="renewal-plate-number"
              v-model.trim="plateNumber"
              density="comfortable"
              hide-details
              placeholder="e.g. 2AY-1234"
              prepend-inner-icon="mdi-car-info"
              variant="outlined"
            />
          </v-col>

          <v-col v-if="plateCategory === 'PROVINCE'" cols="12" md="6">
            <label class="renewal-field-label" for="renewal-plate-province">{{ $t('inspection_plate_province') }} <span>*</span></label>

            <v-select
              id="renewal-plate-province"
              v-model="plateProvince"
              density="comfortable"
              hide-details
              :items="provinceItems"
              variant="outlined"
            />
          </v-col>

          <v-col cols="12" md="6">
            <label class="renewal-field-label" for="renewal-first-registration-date">{{ $t('inspection_first_registration_date') }}</label>

            <v-text-field
              id="renewal-first-registration-date"
              v-model="firstRegistrationDate"
              density="comfortable"
              hide-details
              type="date"
              variant="outlined"
            />
          </v-col>

          <v-col cols="12" md="6">
            <label class="renewal-field-label" for="renewal-chassis-filter">{{ $t('inspection_chassis_number') }}</label>

            <v-text-field
              id="renewal-chassis-filter"
              v-model.trim="chassisNumber"
              density="comfortable"
              hide-details
              prepend-inner-icon="mdi-barcode"
              variant="outlined"
            />
          </v-col>

        </v-row>

        <v-divider class="mt-auto mb-6" />

        <div class="d-flex flex-wrap ga-3 justify-end">
          <v-btn
            :disabled="searching"
            min-width="120"
            type="button"
            variant="outlined"
            @click="resetSearch"
          >
            {{ $t('clear') }}
          </v-btn>

          <v-btn
            color="primary"
            :loading="searching"
            min-width="180"
            prepend-icon="mdi-magnify"
            type="submit"
          >
            {{ searching ? $t('inspection_searching') : $t('inspection_search') }}
          </v-btn>
        </div>
      </v-form>
    </v-card>

    <div v-if="searching" class="py-8 text-center"><v-progress-circular color="primary" indeterminate /><p class="text-medium-emphasis mt-3 mb-0">{{ $t('inspection_searching') }}</p></div>
    <v-alert v-else-if="searched && vehicles.length === 0" class="mt-5" density="comfortable" type="info">{{ $t('inspection_vehicle_not_found') }}</v-alert>

    <div v-else-if="vehicles.length > 0" class="d-flex flex-column ga-3 mt-6">
      <h2 class="text-h6 font-weight-bold">{{ $t('inspection_select_vehicle') }}</h2>

      <v-card
        v-for="vehicle in vehicles"
        :key="vehicle.id"
        border
        class="vehicle-result pa-4"
        :class="{ 'vehicle-result--selected': vehicle.id === selectedVehicleId }"
        elevation="0"
        rounded="lg"
        @click="selectedVehicleId = vehicle.id"
      >
        <div class="d-flex flex-wrap align-center justify-space-between ga-3">
          <div>
            <p class="text-subtitle-1 font-weight-bold mb-1">{{ vehicle.make }} {{ vehicle.model }}<span v-if="vehicle.manufactureYear"> · {{ vehicle.manufactureYear }}</span></p>
            <p class="text-body-2 text-medium-emphasis mb-0">{{ $t('inspection_registration_number') }}: {{ vehicle.registrationNumber }} · {{ $t('inspection_plate_number') }}: {{ vehicle.plateNumber }}</p>
            <p class="text-body-2 text-medium-emphasis mb-0">{{ $t('inspection_chassis_number') }}: {{ vehicle.chassisNumber }}</p>
          </div>

          <v-chip :color="vehicle.id === selectedVehicleId ? 'primary' : undefined" :prepend-icon="vehicle.id === selectedVehicleId ? 'mdi-check-circle' : 'mdi-car-outline'" variant="tonal">{{ vehicle.id === selectedVehicleId ? $t('inspection_selected_vehicle') : $t('inspection_select_vehicle') }}</v-chip>
        </div>
      </v-card>
    </div>

    <div v-if="selectedVehicle" class="d-flex flex-wrap align-center justify-space-between ga-4 mt-7 pt-5 border-t">
      <div><p class="text-caption text-medium-emphasis mb-1">{{ $t('inspection_selected_vehicle') }}</p><p class="font-weight-bold mb-0">{{ selectedVehicle.make }} {{ selectedVehicle.model }} · {{ selectedVehicle.registrationNumber }}</p></div>
      <v-btn color="primary" :loading="creatingDraft" prepend-icon="mdi-arrow-right" @click="startRenewal">{{ $t('inspection_continue_renewal') }}</v-btn>
    </div>
  </section>
</template>

<style scoped>
  .renewal-entry { max-width: 1180px; }
  .renewal-lookup-card { border: 1px solid #ececf1; min-height: 610px; }
  .renewal-lookup-form { display: flex; flex-direction: column; height: calc(610px - 136px); }
  .renewal-search-fields { flex: 0 0 auto; max-width: 980px; }
  .renewal-field-label { color: #394053; display: block; font-size: 1rem; font-weight: 600; margin-bottom: 10px; }
  .renewal-field-label span { color: #cf2025; font-weight: 700; }
  .vehicle-result { cursor: pointer; transition: border-color .15s ease, background-color .15s ease; }
  .vehicle-result--selected { border-color: rgb(var(--v-theme-primary)) !important; background: rgb(var(--v-theme-primary), .05); }
</style>
