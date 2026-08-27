<script setup lang="ts">
  import type { RenewalApplication } from '../applications/types/application.types'
  import { isAxiosError } from 'axios'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { inspectionApplicationService } from '../applications/services/application.service'
  import { inspectionVehicleService } from '../vehicles/services/vehicle.service'
  import { inspectionExpiryState } from '../vehicles/utils/inspection-expiry-status'
  import { CAMBODIAN_CAPITAL_PROVINCES_KH, type Vehicle, type VehicleLookupQuery, type VehiclePlateCategory } from '../vehicles/types/vehicle.types'
  import { findUnfinishedApplication, renewalEntryAction, unfinishedApplicationMessageKey } from './utils/renewal-entry-action'

  type ApiErrorResponse = { code?: string, message?: string }
  type TemporaryFeedbackKind = 'validation' | 'lookup-api' | 'not-found' | 'draft-api'
  type TemporaryFeedback = {
    kind: TemporaryFeedbackKind
    key: string
    type: 'error' | 'info' | 'warning'
  }

  const { t } = useI18n()
  const router = useRouter()
  const chassisNumber = ref('')
  const plateCategory = ref<VehiclePlateCategory>('PROVINCE')
  const plateProvince = ref('')
  const plateNumber = ref('')
  const firstRegistrationDate = ref('')
  const firstRegistrationDateInput = ref('')
  const matchedVehicle = ref<Vehicle | null>(null)
  const applications = ref<RenewalApplication[]>([])
  const searching = ref(false)
  const creatingDraft = ref(false)
  const temporaryFeedback = ref<TemporaryFeedback | null>(null)

  const temporaryFeedbackMessage = computed(() => temporaryFeedback.value === null ? '' : t(temporaryFeedback.value.key))
  const matchedVehicleRenewalIsNotYetAvailable = computed(() => matchedVehicle.value !== null && inspectionExpiryState(matchedVehicle.value.inspectionExpiryDate) === 'valid')
  const matchedApplication = computed(() => matchedVehicle.value === null
    ? undefined
    : findUnfinishedApplication(applications.value, matchedVehicle.value.id))
  const matchedVehicleRenewalAction = computed(() => renewalEntryAction(matchedApplication.value))
  const plateCategoryItems = computed(() => [
    { title: t('inspection_plate_category_province'), value: 'PROVINCE' },
    { title: t('inspection_plate_category_personalized'), value: 'PERSONALIZED_CAMBODIA' },
  ])
  const provinceItems = computed(() => CAMBODIAN_CAPITAL_PROVINCES_KH.map(province => ({ title: province, value: province })))

  watch(plateCategory, () => {
    plateProvince.value = ''
    plateNumber.value = ''
  })

  watch([plateCategory, plateProvince, plateNumber, chassisNumber, firstRegistrationDateInput], () => {
    if (temporaryFeedback.value?.kind === 'lookup-api' || temporaryFeedback.value?.kind === 'not-found') {
      clearTemporaryFeedback()
      return
    }

    if (temporaryFeedback.value?.kind === 'validation' && validationErrorKey() === null) {
      clearTemporaryFeedback()
    }
  })

  function clearResults () {
    matchedVehicle.value = null
  }

  function clearTemporaryFeedback () {
    temporaryFeedback.value = null
  }

  function parseFirstRegistrationDate (value: string): string | null {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(value.trim())
    if (match === null) return null

    const [, day, month, year] = match
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null

    return `${year}-${month}-${day}`
  }

  function onFirstRegistrationDateInput (value: string) {
    const digits = value.replace(/\D/gu, '').slice(0, 8)
    const previousValue = firstRegistrationDateInput.value
    const isRemovingSeparator = value.length < previousValue.length && previousValue.endsWith('/')
    let formattedValue = digits

    if (digits.length === 2) formattedValue = isRemovingSeparator ? digits : `${digits}/`
    else if (digits.length > 2 && digits.length < 4) formattedValue = `${digits.slice(0, 2)}/${digits.slice(2)}`
    else if (digits.length === 4) formattedValue = isRemovingSeparator ? `${digits.slice(0, 2)}/${digits.slice(2)}` : `${digits.slice(0, 2)}/${digits.slice(2)}/`
    else if (digits.length > 4) formattedValue = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`

    firstRegistrationDateInput.value = formattedValue
    firstRegistrationDate.value = formattedValue.trim() === '' ? '' : parseFirstRegistrationDate(formattedValue) ?? ''
  }

  function showTemporaryFeedback (kind: TemporaryFeedbackKind, key: string, type: TemporaryFeedback['type']) {
    temporaryFeedback.value = { kind, key, type }
  }

  function validationErrorKey (): string | null {
    const chassis = chassisNumber.value.trim()
    const plate = plateNumber.value.trim()
    const province = plateProvince.value.trim()

    if (firstRegistrationDateInput.value.trim() && parseFirstRegistrationDate(firstRegistrationDateInput.value) === null) {
      return 'inspection_first_registration_date_invalid'
    }

    if (plate && plateCategory.value === 'PROVINCE' && !province) {
      return 'inspection_plate_province_required'
    }

    const hasCompletePlate = Boolean(
      plate && (plateCategory.value === 'PERSONALIZED_CAMBODIA' || province),
    )

    return !chassis && !hasCompletePlate ? 'inspection_vehicle_lookup_criteria_required' : null
  }

  function searchQuery (): VehicleLookupQuery {
    const chassis = chassisNumber.value.trim()
    const plate = plateNumber.value.trim()
    const province = plateProvince.value.trim()
    const firstRegistration = firstRegistrationDate.value.trim()

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

    clearResults()

    const validationError = validationErrorKey()
    if (validationError !== null) {
      showTemporaryFeedback('validation', validationError, 'error')
      return
    }

    searching.value = true
    clearTemporaryFeedback()
    try {
      const response = await inspectionVehicleService.lookup(searchQuery())

      if (response.data.length === 0) {
        showTemporaryFeedback('not-found', 'inspection_vehicle_not_found', 'warning')
        return
      }

      if (response.data.length > 1) {
        showTemporaryFeedback('lookup-api', 'inspection_vehicle_lookup_multiple_results_error', 'error')
        return
      }

      matchedVehicle.value = response.data[0]
      applications.value = await inspectionApplicationService.listCitizenApplications()
    } catch (error) {
      showTemporaryFeedback('lookup-api', getErrorMessage(error, 'inspection_vehicle_lookup_error'), 'error')
    } finally {
      searching.value = false
    }
  }

  async function startRenewal () {
    if (matchedVehicle.value === null || matchedVehicleRenewalIsNotYetAvailable.value || creatingDraft.value) return

    creatingDraft.value = true
    clearTemporaryFeedback()
    try {
      const application = await inspectionApplicationService.createDraft(matchedVehicle.value.id)
      await router.push({ path: '/services/inspection/renewal/documents', query: { applicationId: application.id } })
    } catch (error) {
      if (isUnfinishedApplicationError(error)) {
        await handleUnfinishedApplication(matchedVehicle.value.id)
        return
      }

      showTemporaryFeedback('draft-api', getErrorMessage(error, 'inspection_draft_creation_error'), 'error')
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
    firstRegistrationDateInput.value = ''
    clearTemporaryFeedback()
    clearResults()
  }

  function getErrorMessage (error: unknown, fallback: string): string {
    if (!isAxiosError<ApiErrorResponse>(error)) return fallback

    if (error.response?.data?.code === 'UNFINISHED_APPLICATION_ALREADY_EXISTS') {
      return 'inspection_unfinished_application_error'
    }

    if (error.response?.data?.code === 'VEHICLE_CLASSIFICATION_INCOMPLETE') {
      return 'inspection_vehicle_classification_incomplete'
    }

    if (error.response?.data?.code === 'VEHICLE_NOT_YET_ELIGIBLE_FOR_RENEWAL') {
      return 'inspection_renewal_not_yet_eligible'
    }

    return fallback
  }

  function isUnfinishedApplicationError (error: unknown): boolean {
    return isAxiosError<ApiErrorResponse>(error)
      && error.response?.data?.code === 'UNFINISHED_APPLICATION_ALREADY_EXISTS'
  }

  async function handleRenewalAction () {
    if (matchedVehicle.value === null) return
    const action = matchedVehicleRenewalAction.value

    if (action.kind === 'start') {
      await startRenewal()
      return
    }

    if (matchedApplication.value === undefined) return

    await router.push(action.kind === 'resume'
      ? { path: '/services/inspection/renewal/documents', query: { applicationId: matchedApplication.value.id } }
      : { path: `/services/inspection/applications/${matchedApplication.value.id}` })
  }

  async function handleUnfinishedApplication (vehicleId: string) {
    try {
      const citizenApplications = await inspectionApplicationService.listCitizenApplications()
      applications.value = citizenApplications
      const unfinishedApplication = findUnfinishedApplication(citizenApplications, vehicleId)

      if (unfinishedApplication?.status === 'DRAFT') {
        await router.push({ path: '/services/inspection/renewal/documents', query: { applicationId: unfinishedApplication.id } })
        return
      }

      showTemporaryFeedback('draft-api', unfinishedApplicationMessageKey(unfinishedApplication), 'warning')
      return
    } catch {
      // Fall through to the localized error below.
    }

    showTemporaryFeedback('draft-api', 'inspection_unfinished_application_error', 'error')
  }
</script>

<template>
  <section class="renewal-entry">
    <v-breadcrumbs class="renewal-breadcrumbs px-0 pb-5" density="compact">
      <v-breadcrumbs-item to="/services/inspection/dashboard">{{ $t('inspection_dashboard') }}</v-breadcrumbs-item>
      <v-breadcrumbs-divider icon="mdi-chevron-right" />
      <v-breadcrumbs-item active active-color="primary" class="renewal-breadcrumbs__current">{{ $t('inspection_start_renewal') }}</v-breadcrumbs-item>
    </v-breadcrumbs>

    <v-card class="renewal-lookup-card pa-5 pa-md-7" elevation="0" rounded="xl">
      <div class="mb-6">
        <h1 class="text-h5 font-weight-bold mb-2">{{ $t('inspection_vehicle_lookup') }}</h1>
        <p class="text-body-1 text-medium-emphasis mb-0">{{ $t('inspection_vehicle_lookup_description') }}</p>
      </div>

      <v-alert v-if="temporaryFeedback && temporaryFeedbackMessage" class="mb-5" density="compact" :type="temporaryFeedback.type">
        {{ temporaryFeedbackMessage }}
      </v-alert>

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
            <label class="renewal-field-label" for="renewal-plate-number">{{ $t('inspection_plate_number') }} <span>*</span></label>

            <v-text-field
              id="renewal-plate-number"
              v-model.trim="plateNumber"
              density="comfortable"
              hide-details
              maxlength="8"
              placeholder="e.g. 2AY-1234"
              prepend-inner-icon="mdi-car-info"
              variant="outlined"
            />
          </v-col>

          <v-col cols="12" md="6">
            <label class="renewal-field-label" for="renewal-first-registration-date">{{ $t('inspection_first_registration_date') }}</label>

            <v-text-field id="renewal-first-registration-date" density="comfortable" hide-details inputmode="numeric" maxlength="10" :model-value="firstRegistrationDateInput" placeholder="dd/mm/yyyy" variant="outlined" @update:model-value="onFirstRegistrationDateInput" />
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

    <div v-if="searching" class="py-8 text-center">
      <v-progress-circular color="primary" indeterminate />
      <p class="text-medium-emphasis mt-3 mb-0">{{ $t('inspection_searching') }}</p>
    </div>

    <v-card
      v-else-if="matchedVehicle"
      border
      class="vehicle-result mt-6 pa-5"
      elevation="0"
      rounded="lg"
    >
      <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
        <div>
          <h2 class="text-h6 font-weight-bold mb-1">{{ $t('inspection_vehicle_found') }}</h2>
          <p class="text-body-2 text-medium-emphasis mb-0">{{ $t('inspection_vehicle_found_description') }}</p>
        </div>

        <v-chip color="success" prepend-icon="mdi-check-circle" variant="tonal">{{ $t('inspection_vehicle_found') }}</v-chip>
      </div>

      <div class="vehicle-result__details">
        <div>
          <p class="text-caption text-medium-emphasis mb-1">{{ $t('inspection_vehicle_details') }}</p>
          <p class="font-weight-bold mb-0">{{ matchedVehicle.make }} {{ matchedVehicle.model }}<span v-if="matchedVehicle.manufactureYear"> · {{ matchedVehicle.manufactureYear }}</span></p>
        </div>

        <div>
          <p class="text-caption text-medium-emphasis mb-1">{{ $t('inspection_plate_number') }}</p>
          <p class="font-weight-bold mb-0">{{ matchedVehicle.plateNumber }}</p>
        </div>

        <div v-if="matchedVehicle.plateProvince">
          <p class="text-caption text-medium-emphasis mb-1">{{ $t('inspection_plate_province') }}</p>
          <p class="font-weight-bold mb-0">{{ matchedVehicle.plateProvince }}</p>
        </div>

        <div>
          <p class="text-caption text-medium-emphasis mb-1">{{ $t('inspection_chassis_number') }}</p>
          <p class="font-weight-bold mb-0">{{ matchedVehicle.chassisNumber }}</p>
        </div>

        <div>
          <p class="text-caption text-medium-emphasis mb-1">{{ $t('inspection_first_registration_date') }}</p>
          <p class="font-weight-bold mb-0">{{ matchedVehicle.firstRegistrationDate }}</p>
        </div>
      </div>

      <div class="d-flex justify-end mt-5">
        <v-alert v-if="matchedVehicleRenewalIsNotYetAvailable && !matchedApplication" density="compact" type="info" variant="tonal">
          {{ $t('inspection_renewal_not_yet_eligible') }}
        </v-alert>

        <v-btn
          v-else
          color="primary"
          :loading="creatingDraft"
          :prepend-icon="matchedVehicleRenewalAction.icon"
          @click="handleRenewalAction"
        >
          {{ $t(matchedVehicleRenewalAction.labelKey) }}
        </v-btn>
      </div>
    </v-card>
  </section>
</template>

<style scoped>
  .renewal-entry {
    max-width: 1180px;
  }

  .renewal-breadcrumbs :deep(.v-breadcrumbs-item--link) {
    color: #697080;
  }

  .renewal-breadcrumbs :deep(.renewal-breadcrumbs__current) {
    background: #e9ebf8;
    border-radius: 999px;
    color: #2a3472;
    font-weight: 700;
    opacity: 1;
    padding: 4px 10px;
  }

  .renewal-lookup-card {
    border: 1px solid #ececf1;
    min-height: 610px;
  }

  .renewal-lookup-form {
    display: flex;
    flex-direction: column;
    height: calc(610px - 136px);
  }

  .renewal-search-fields {
    flex: 0 0 auto;
    max-width: 980px;
  }

  .renewal-field-label {
    color: #394053;
    display: block;
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 10px;
  }

  .renewal-field-label span {
    color: #cf2025;
    font-weight: 700;
  }

  .vehicle-result__details {
    display: grid;
    gap: 20px;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  }

</style>
