<script setup lang="ts">
  /* eslint-disable @stylistic/max-statements-per-line */
  import type { RenewalApplication, RenewalApplicationListItem } from '../applications/types/application.types'
  import type { Vehicle } from '../vehicles/types/vehicle.types'
  import { nextTick } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useInspectionAuthStore } from '../../auth/stores/auth.store'
  import { getEnglishNameIssue, getInspectionAuthError, getInspectionAuthErrorCode, getInspectionEmailIssue, getKhmerNameIssue, getPasswordConfirmationIssue, getPasswordIssue, isInspectionPhone } from '../../auth/utils/auth.utils'
  import { combineKhmerName, splitKhmerName } from '../../auth/utils/khmer-name-parts'
  import { formatDisplayDate } from '../../shared/utils/display-date'
  import { inspectionApplicationService } from '../applications/services/application.service'
  import { citizenCardCycleForVehicle, citizenCardIdentifierLabel, resolveCitizenVehicleRenewalStatus } from '../applications/utils/citizen-application-status'
  import RenewalStartConfirmationDialog from '../renewal/components/RenewalStartConfirmationDialog.vue'
  import { useRenewalEntryFlow } from '../renewal/composables/use-renewal-entry-flow'
  import { findUnfinishedApplication, renewalEntryAction } from '../renewal/utils/renewal-entry-action'
  import CitizenVehicleCard from '../vehicles/components/CitizenVehicleCard.vue'
  import { inspectionVehicleService } from '../vehicles/services/vehicle.service'
  import { inspectionExpiryState, type InspectionExpiryState } from '../vehicles/utils/inspection-expiry-status'
  import { formatProvince } from '../vehicles/utils/province-label'
  import { getVehicleTypeIcon } from '../vehicles/utils/vehicle-type-icon'

  const { locale, t } = useI18n(); const auth = useInspectionAuthStore()
  const editing = ref(false); const saving = ref(false); const changing = ref(false)
  const showCurrentPassword = ref(false); const showNewPassword = ref(false); const showPasswordConfirmation = ref(false)
  const profileError = ref(''); const passwordError = ref(''); const noticeKey = ref('')
  type ElementReference = HTMLElement | { $el?: HTMLElement } | null
  const noticeAlert = ref<ElementReference>(null); const passwordPanel = ref<ElementReference>(null); const vehicles = ref<Vehicle[]>([]); const applications = ref<RenewalApplicationListItem[]>([]); const loadingVehicles = ref(true); const renewalError = ref<string | null>(null)
  const form = reactive({ familyNameKh: '', givenNameKh: '', nameEn: '', phone: '', email: '', address: '' }); const passwords = reactive({ current: '', next: '', confirm: '' })
  const profile = computed(() => auth.currentUser?.citizenProfile); const user = computed(() => auth.currentUser?.user)
  const name = computed(() => profile.value?.nameKh || profile.value?.nameEn || user.value?.email || user.value?.phone || '—')
  const verified = computed(() => user.value?.status === 'ACTIVE' && Boolean(user.value.phoneVerifiedAt || user.value.emailVerifiedAt))
  const { confirmationLoading, confirmationOpen, confirmRenewal, isRenewingVehicle, startOrContinueRenewal } = useRenewalEntryFlow({
    onApplicationsLoaded: loaded => applications.value = loaded,
    onError: messageKey => renewalError.value = messageKey || null,
  })
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  function displayLocalPhone (value: string | null | undefined) {
    const normalized = value?.trim() ?? ''
    return normalized.startsWith('+855') ? `0${normalized.slice(4).replace(/^0/u, '')}` : normalized
  }
  function sync () {
    const khmerName = splitKhmerName(profile.value?.nameKh)
    form.familyNameKh = khmerName.familyName; form.givenNameKh = khmerName.givenName; form.nameEn = profile.value?.nameEn ?? ''; form.phone = displayLocalPhone(user.value?.phone); form.email = user.value?.email ?? ''; form.address = profile.value?.address ?? ''
  }
  function clearProfileFeedback () {
    profileError.value = ''; noticeKey.value = ''
  }
  function resolveElement (reference: ElementReference) {
    return reference instanceof HTMLElement ? reference : reference?.$el
  }
  async function revealPasswordError () {
    await nextTick(); const element = resolveElement(passwordPanel.value); element?.scrollIntoView({ behavior: 'smooth', block: 'center' }); element?.querySelector<HTMLInputElement>('input')?.focus()
  }
  async function revealNotice () {
    await nextTick(); resolveElement(noticeAlert.value)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  watch(profile, sync, { immediate: true })
  watch(noticeKey, value => {
    if (noticeTimer !== undefined) clearTimeout(noticeTimer)
    noticeTimer = value ? setTimeout(() => noticeKey.value = '', 5000) : undefined
  })
  onBeforeUnmount(() => {
    if (noticeTimer !== undefined) clearTimeout(noticeTimer)
  })
  onMounted(async () => {
    try {
      const [vehicleResponse, applicationResponse] = await Promise.all([
        inspectionVehicleService.lookup({ limit: 3, sortBy: 'inspectionExpiryDate', sortOrder: 'asc' }),
        inspectionApplicationService.listCitizenApplications({ limit: 100, sortOrder: 'desc' }).catch(() => null),
      ])
      vehicles.value = vehicleResponse.data
      applications.value = applicationResponse?.data ?? []
    } finally {
      loadingVehicles.value = false
    }
  })
  async function save () {
    const nameKh = combineKhmerName(form.familyNameKh, form.givenNameKh)
    const issue = form.familyNameKh.trim()
        ? (form.givenNameKh.trim()
        ? getKhmerNameIssue(nameKh) ?? getEnglishNameIssue(form.nameEn.trim()) ?? (form.phone.trim() && !isInspectionPhone(form.phone.trim()) ? 'inspection_phone_invalid' : undefined) ?? getInspectionEmailIssue(form.email.trim())
        : 'inspection_given_name_kh_required')
      : 'inspection_family_name_kh_required'; if (issue) {
        profileError.value = t(issue); return
      }; saving.value = true; clearProfileFeedback(); try {
        await auth.updateCitizenProfile({ nameKh, nameEn: form.nameEn.trim() || null, phone: form.phone.trim() || undefined, email: form.email.trim(), address: form.address.trim() || null }); editing.value = false
        noticeKey.value = 'inspection_profile_saved'; await revealNotice()
      } catch (error) {
        profileError.value = t(getInspectionAuthErrorCode(error) === 'AUTH_INVALID_CREDENTIALS' ? 'inspection_current_password_incorrect' : getInspectionAuthError(error, 'inspection_profile_save_error'))
      } finally {
        saving.value = false
      }
  }
  async function changePassword () {
    const issue = passwords.current ? getPasswordIssue(passwords.next) ?? getPasswordConfirmationIssue(passwords.next, passwords.confirm) : 'inspection_current_password_required'; if (issue) {
      passwordError.value = t(issue); await revealPasswordError(); return
    }; changing.value = true; passwordError.value = ''; noticeKey.value = ''; try {
      await auth.changePassword({ currentPassword: passwords.current, newPassword: passwords.next }); passwords.current = ''; passwords.next = ''; passwords.confirm = ''; showCurrentPassword.value = false; showNewPassword.value = false; showPasswordConfirmation.value = false; noticeKey.value = 'inspection_password_changed'; await revealNotice()
    } catch (error) {
      const errorKey = getInspectionAuthErrorCode(error) === 'AUTH_INVALID_CREDENTIALS'
        ? 'inspection_current_password_incorrect'
        : getInspectionAuthError(error, 'inspection_profile_save_error')
      passwordError.value = t(errorKey); await revealPasswordError()
    } finally {
      changing.value = false
    }
  }
  function vehicleState (vehicle: Vehicle): InspectionExpiryState {
    return inspectionExpiryState(vehicle.inspectionExpiryDate)
  }
  function vehicleStateColor (vehicle: Vehicle): 'error' | 'warning' | 'success' {
    return ({ expired: 'error', expiring: 'warning', valid: 'success' } as const)[vehicleState(vehicle)]
  }
  function vehicleName (vehicle: Vehicle) {
    return [vehicle.make, vehicle.model, vehicle.manufactureYear].filter(Boolean).join(' ')
  }
  function plateTypeLabel (vehicle: Vehicle) {
    if (vehicle.plateCategory === 'PERSONALIZED_CAMBODIA') return t('inspection_plate_cambodia')
    return formatProvince(vehicle.plateProvince, locale.value)
  }
  function unfinishedApplication (vehicle: Vehicle): RenewalApplication | undefined {
    return findUnfinishedApplication(applications.value, vehicle.id)
  }
  function vehicleApplication (vehicle: Vehicle): RenewalApplicationListItem | undefined {
    return citizenCardCycleForVehicle(applications.value, vehicle.id)
  }
  function vehicleRenewalAction (vehicle: Vehicle) {
    return renewalEntryAction(unfinishedApplication(vehicle))
  }
  function vehicleRenewalStatusPresentation (vehicle: Vehicle) {
    const status = resolveCitizenVehicleRenewalStatus(vehicleApplication(vehicle), vehicle.inspectionExpiryDate)
    return status === undefined ? undefined : { ...status, label: t(status.labelKey), modifier: status.color }
  }
  function vehicleIdentifier (vehicle: Vehicle, identifier: 'certificate' | 'transaction') {
    return citizenCardIdentifierLabel(vehicleApplication(vehicle), identifier)
  }
  async function handleRenewalAction (vehicle: Vehicle) {
    renewalError.value = null
    await startOrContinueRenewal(vehicle)
  }
</script>
<template>
  <section class="profile-view citizen-auth-type-scale"><header><h1>{{ $t('inspection_profile_settings') }}</h1><p>{{ $t('inspection_profile_description') }}</p></header>

    <v-alert
      v-if="noticeKey"
      ref="noticeAlert"
      class="mt-4"
      closable
      type="success"
      @click:close="noticeKey = ''"
    >{{ $t(noticeKey) }}</v-alert>

    <div class="layout mt-5"><div><v-card class="summary" elevation="0"><v-avatar color="primary" size="76"><v-img v-if="profile?.profileImageUrl" :src="profile.profileImageUrl" /><span v-else>{{ name.charAt(0) }}</span></v-avatar>

                                    <div><h2>{{ name }}</h2>

                                      <v-chip
                                        v-if="verified"
                                        class="profile-verified"
                                        color="success"
                                        prepend-icon="mdi-shield-check-outline"
                                        size="small"
                                        variant="tonal"
                                      >{{ $t('inspection_verified_account') }}</v-chip></div></v-card>

                               <v-card class="card mt-5" elevation="0"><div class="card-title"><h2><v-icon icon="mdi-account-outline" /> {{ $t('inspection_personal_information') }}</h2>

                                                                         <v-btn
                                                                           v-if="!editing"
                                                                           class="edit-button"
                                                                           color="primary"
                                                                           prepend-icon="mdi-pencil-outline"
                                                                           variant="outlined"
                                                                           @click="editing = true; clearProfileFeedback()"
                                                                         >{{ $t('inspection_edit') }}</v-btn></div>

                                 <v-alert
                                   v-if="profileError"
                                   class="mb-4"
                                   closable
                                   density="compact"
                                   type="error"
                                   @click:close="profileError = ''"
                                 >{{ profileError }}</v-alert>

                                 <div class="fields"><v-text-field v-model="form.familyNameKh" :label="$t('inspection_family_name_kh')" :readonly="!editing" variant="outlined" /><v-text-field v-model="form.givenNameKh" :label="$t('inspection_given_name_kh')" :readonly="!editing" variant="outlined" /><v-text-field v-model="form.nameEn" :label="$t('inspection_name_en')" :readonly="!editing" variant="outlined" /><v-text-field v-model="form.phone" :label="$t('inspection_phone')" :readonly="!editing" variant="outlined" /><v-text-field v-model="form.email" :label="$t('inspection_email')" :readonly="!editing" variant="outlined" /><v-text-field :label="$t('inspection_national_id')" :model-value="profile?.nationalIdNumber || '—'" readonly variant="outlined" />

                                   <v-textarea
                                     v-model="form.address"
                                     :label="$t('inspection_address')"
                                     :readonly="!editing"
                                     rows="2"
                                     variant="outlined"
                                   /></div>

                                 <div v-if="editing" class="form-actions"><v-btn class="cancel-button" variant="flat" @click="sync(); editing = false; clearProfileFeedback()">{{ $t('inspection_cancel') }}</v-btn><v-btn color="primary" :loading="saving" @click="save">{{ $t('inspection_profile_save') }}</v-btn></div></v-card></div>

      <v-card ref="passwordPanel" class="card security" elevation="0"><div class="card-title"><h2><v-icon icon="mdi-shield-lock-outline" /> {{ $t('inspection_account_security') }}</h2></div><p class="security-copy">{{ $t('inspection_security_description') }}</p>

        <v-alert
          v-if="passwordError"
          class="mb-5"
          closable
          density="compact"
          type="error"
          @click:close="passwordError = ''"
        >{{ passwordError }}</v-alert>

        <div class="password-fields"><v-text-field
                                       v-model="passwords.current"
                                       :append-inner-icon="showCurrentPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                                       autocomplete="current-password"
                                       :label="$t('inspection_current_password')"
                                       :type="showCurrentPassword ? 'text' : 'password'"
                                       variant="outlined"
                                       @click:append-inner="showCurrentPassword = !showCurrentPassword"
                                     />

          <v-text-field
            v-model="passwords.next"
            :append-inner-icon="showNewPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            autocomplete="new-password"
            :label="$t('inspection_password_minimum')"
            :type="showNewPassword ? 'text' : 'password'"
            variant="outlined"
            @click:append-inner="showNewPassword = !showNewPassword"
          />

          <v-text-field
            v-model="passwords.confirm"
            :append-inner-icon="showPasswordConfirmation ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            autocomplete="new-password"
            :label="$t('inspection_confirm_new_password')"
            :type="showPasswordConfirmation ? 'text' : 'password'"
            variant="outlined"
            @click:append-inner="showPasswordConfirmation = !showPasswordConfirmation"
          /></div>

        <v-btn
          block
          class="password-action"
          color="primary"
          :loading="changing"
          @click="changePassword"
        >{{ $t('inspection_change_password') }}</v-btn></v-card></div>

    <div class="vehicle-title mt-8"><h2><v-icon icon="mdi-car-outline" /> {{ $t('inspection_my_vehicles') }}</h2><v-btn color="primary" to="/services/inspection/vehicles" variant="text">{{ $t('inspection_dashboard_view_all') }}</v-btn></div><div v-if="loadingVehicles" class="py-6 text-center"><v-progress-circular indeterminate /></div>

    <template v-else>
      <v-alert
        v-if="renewalError"
        class="mt-4"
        closable
        type="error"
        @click:close="renewalError = null"
      >{{ $t(renewalError) }}</v-alert>

      <v-alert v-if="vehicles.length === 0" class="mt-4" type="info" variant="tonal">{{ $t('inspection_dashboard_no_vehicles') }}</v-alert>

      <div v-else class="vehicles">
        <CitizenVehicleCard
          v-for="vehicle in vehicles"
          :key="vehicle.id"
          :action-icon="vehicleRenewalAction(vehicle).icon"
          :action-label="$t(vehicleRenewalAction(vehicle).labelKey)"
          :action-loading="isRenewingVehicle(vehicle.id)"
          :certificate-number="vehicleIdentifier(vehicle, 'certificate')"
          :expiry-date="formatDisplayDate(vehicle.inspectionExpiryDate)"
          :has-certificate-number="Boolean(vehicleApplication(vehicle)?.certificate?.certificateNumber)"
          :has-transaction-number="Boolean(vehicleApplication(vehicle)?.payment?.transactionNumber)"
          :inspection-status="{ color: vehicleStateColor(vehicle), label: $t(`inspection_dashboard_${vehicleState(vehicle)}`), modifier: vehicleState(vehicle) }"
          :plate-label="plateTypeLabel(vehicle)"
          :renewal-status="vehicleRenewalStatusPresentation(vehicle)"
          :transaction-number="vehicleIdentifier(vehicle, 'transaction')"
          :vehicle="vehicle"
          :vehicle-icon="getVehicleTypeIcon(vehicle.vehicleType)"
          :vehicle-name="vehicleName(vehicle)"
          @renew="handleRenewalAction(vehicle)"
        />
      </div>
    </template>

    <RenewalStartConfirmationDialog v-model="confirmationOpen" :loading="confirmationLoading" @confirm="confirmRenewal" />
  </section>
</template>
<style scoped>
.profile-view{max-width:1120px;padding-bottom:28px}.profile-view h1{color:#151925;font-size:clamp(1.5rem,2.5vw,2rem)}header p{color:#656776;line-height:1.6}.layout{align-items:start;display:grid;gap:24px;grid-template-columns:minmax(0,2fr) minmax(300px,1fr)}.summary,.card{border:1px solid #dfe1e8;border-radius:16px;box-shadow:none}.summary{align-items:center;display:flex;gap:18px;padding:24px}.summary h2,.card-title h2,.vehicle-title h2{color:#171b28;font-size:1.12rem}.summary p{color:#555a67;margin:5px 0}.card{padding:0 24px 28px}.card-title{align-items:center;border-bottom:1px solid #e2e3e9;display:flex;justify-content:space-between;margin:0 -24px 24px;padding:20px 24px}.edit-button{text-transform:none}.fields{display:grid;gap:4px 18px;grid-template-columns:1fr 1fr}.fields :last-child{grid-column:1/-1}.form-actions{display:flex;gap:8px;justify-content:flex-end}.cancel-button{background:#a6a6a6!important;color:#fff!important;font-weight:700}.security-copy{color:#656776;line-height:1.75;margin:0 0 24px;white-space:pre-line}.password-fields{display:grid;gap:14px}.password-fields :deep(.v-text-field){margin:0}.password-action{margin-top:24px;min-height:46px}.vehicle-title{align-items:center;display:flex;justify-content:space-between}.vehicles{display:grid;gap:18px;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:16px}.vehicles :deep(.vehicle-card){box-shadow:none}@media(max-width:900px){.layout{grid-template-columns:1fr}.vehicles{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.fields,.vehicles{grid-template-columns:1fr}.fields :last-child{grid-column:auto}.card{padding-inline:18px}.card-title{margin-inline:-18px;padding-inline:18px}.security-copy{margin-bottom:20px}.password-fields{gap:12px}}
  .profile-verified { background: #e8f5ea !important; color: #2f9e44 !important; font-weight: 400 !important; }
  .profile-verified :deep(.v-icon) { color: #2f9e44 !important; }
</style>
