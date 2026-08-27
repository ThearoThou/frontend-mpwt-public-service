<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import InspectionAuthShell from '../components/InspectionAuthShell.vue'
  import { inspectionAuthService } from '../services/auth.service'
  import { getEnglishNameIssue, getInspectionAuthError, getInspectionEmailIssue, getKhmerNameIssue, getPasswordConfirmationIssue, getPasswordIssue, isInspectionPhone } from '../utils/auth.utils'

  type ErrorKind = 'api' | 'validation'

  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const form = reactive({ nameKh: '', nameEn: '', phone: '', email: '', password: '', passwordConfirmation: '' })
  const showPassword = ref(false)
  const loading = ref(false)
  const errorMessage = ref('')
  const errorKind = ref<ErrorKind | null>(null)
  let clearingSubmittedPasswords = false

  watch(
    () => [form.nameKh, form.nameEn, form.phone, form.email, form.password, form.passwordConfirmation],
    () => {
      if (clearingSubmittedPasswords) return

      if (errorKind.value === 'api') {
        clearError()
        return
      }

      if (errorKind.value === 'validation' && getRegistrationIssues().length === 0) {
        clearError()
      }
    },
  )

  function getRegistrationIssues () {
    const issues: string[] = []
    const nameKhIssue = getKhmerNameIssue(form.nameKh)
    const nameEnIssue = getEnglishNameIssue(form.nameEn)
    const emailIssue = form.email ? getInspectionEmailIssue(form.email) : undefined
    const passwordIssue = getPasswordIssue(form.password)
    const passwordConfirmationIssue = getPasswordConfirmationIssue(form.password, form.passwordConfirmation)

    if (nameKhIssue) issues.push(t(nameKhIssue))
    if (nameEnIssue) issues.push(t(nameEnIssue))
    if (!form.phone) issues.push(t('inspection_phone'))
    if (form.phone && !isInspectionPhone(form.phone)) issues.push(t('inspection_phone_invalid'))
    if (emailIssue) issues.push(t(emailIssue))
    if (passwordIssue) issues.push(t(passwordIssue))
    if (passwordConfirmationIssue) issues.push(t(passwordConfirmationIssue))

    return issues
  }

  function clearError () {
    errorMessage.value = ''
    errorKind.value = null
  }

  function showError (kind: ErrorKind, message: string) {
    errorMessage.value = message
    errorKind.value = kind
  }

  async function register () {
    if (loading.value) return

    const issues = getRegistrationIssues()
    if (issues.length > 0) {
      showError('validation', t('inspection_validation_error', { fields: issues.join(', ') }))
      return
    }

    loading.value = true
    clearError()
    try {
      const identifier = form.phone || form.email
      await inspectionAuthService.register({
        nameKh: form.nameKh,
        nameEn: form.nameEn || null,
        phone: form.phone || undefined,
        email: form.email || undefined,
        verificationIdentifier: identifier,
        password: form.password,
      })
      await router.push({
        path: '/services/inspection/verify',
        query: { identifier, redirect: route.query.redirect, requested: 'true' },
      })
    } catch (error) {
      showError('api', t(getInspectionAuthError(error, 'inspection_register_error')))
    } finally {
      clearingSubmittedPasswords = true
      form.password = ''
      form.passwordConfirmation = ''
      loading.value = false
      await nextTick()
      clearingSubmittedPasswords = false
    }
  }
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <InspectionAuthShell dense :description="$t('inspection_register_description')" :title="$t('inspection_register')">
    <v-alert v-if="errorMessage" class="mb-5" density="comfortable" type="error">
      {{ errorMessage }}
    </v-alert>

    <v-form @submit.prevent="register">
      <v-row dense>
        <v-col cols="12">
          <v-text-field v-model.trim="form.nameKh" class="inspection-required-field" maxlength="150" prepend-inner-icon="mdi-account-outline" required variant="outlined">
            <template #label>{{ $t('inspection_name_kh') }} <span class="inspection-required-mark">*</span></template>
          </v-text-field>
        </v-col>
        <v-col cols="12">
          <v-text-field v-model.trim="form.nameEn" :label="$t('inspection_name_en_optional')" maxlength="150" prepend-inner-icon="mdi-account-outline" variant="outlined" />
        </v-col>
        <v-col cols="12">
          <v-text-field v-model.trim="form.phone" autocomplete="tel" class="inspection-required-field" prepend-inner-icon="mdi-phone-outline" required variant="outlined">
            <template #label>{{ $t('inspection_phone') }} <span class="inspection-required-mark">*</span></template>
          </v-text-field>
        </v-col>
        <v-col cols="12">
          <v-text-field v-model.trim="form.email" autocomplete="email" :label="$t('inspection_email_optional')" maxlength="254" prepend-inner-icon="mdi-email-outline" type="text" variant="outlined" />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field v-model="form.password" :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" autocomplete="new-password" class="inspection-required-field" maxlength="128" prepend-inner-icon="mdi-lock-outline" required :type="showPassword ? 'text' : 'password'" variant="outlined" @click:append-inner="showPassword = !showPassword">
            <template #label>{{ $t('inspection_password') }} <span class="inspection-required-mark">*</span></template>
          </v-text-field>
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field v-model="form.passwordConfirmation" :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" autocomplete="new-password" class="inspection-required-field" :error="Boolean(form.passwordConfirmation) && form.password !== form.passwordConfirmation" maxlength="128" prepend-inner-icon="mdi-lock-check-outline" required :type="showPassword ? 'text' : 'password'" variant="outlined" @click:append-inner="showPassword = !showPassword">
            <template #label>{{ $t('inspection_confirm_password') }} <span class="inspection-required-mark">*</span></template>
          </v-text-field>
        </v-col>
      </v-row>
      <v-btn block color="primary" :disabled="loading" :loading="loading" prepend-icon="mdi-account-check-outline" size="large" type="submit">
        {{ $t('inspection_register') }}
      </v-btn>
    </v-form>

    <p class="text-center mt-6 mb-0">
      {{ $t('inspection_have_account') }}
      <router-link :to="{ path: '/services/inspection/login', query: { redirect: route.query.redirect } }">
        {{ $t('inspection_sign_in') }}
      </router-link>
    </p>
  </InspectionAuthShell>
</template>

<style scoped>
  .inspection-required-field :deep(.v-label) {
    opacity: 1;
  }

  .inspection-required-mark {
    color: #d32f2f;
    font-size: 1em;
    font-weight: 500;
    line-height: 0;
  }
</style>
