<script setup lang="ts">
  import { useRoute, useRouter } from 'vue-router'
  import InspectionAuthShell from '../components/InspectionAuthShell.vue'
  import VerificationCodeExpiry from '../components/VerificationCodeExpiry.vue'
  import { useInspectionAuthError } from '../composables/useInspectionAuthError'
  import { inspectionAuthService } from '../services/auth.service'
  import { useInspectionAuthStore } from '../stores/auth.store'
  import { getInspectionAuthError, getInspectionAuthErrorCode, getInspectionIdentifierIssue, getVerificationCodeIssue, inspectionRedirectOrDashboard } from '../utils/auth.utils'

  type ErrorKind = 'api' | 'identifier' | 'validation'

  const route = useRoute()
  const router = useRouter()
  const authStore = useInspectionAuthStore()
  const identifier = computed(() => authStore.registrationVerification?.identifier
    ?? (typeof route.query.identifier === 'string' ? route.query.identifier : ''))
  const code = ref('')
  const loading = ref(false)
  const resendLoading = ref(false)
  const { clearError, errorKind, errorMessage, showError } = useInspectionAuthError<ErrorKind>()
  const expiresAt = computed(() => authStore.registrationVerification?.identifier === identifier.value
    ? authStore.registrationVerification.expiresAt
    : null)
  let clearingSubmittedCode = false

  watch(identifier, () => {
    if (errorKind.value === 'api' || errorKind.value === 'identifier') {
      clearError()
      return
    }

    if (errorKind.value === 'validation' && getVerificationIssues().length === 0) clearError()
  })

  watch(code, () => {
    if (clearingSubmittedCode) return

    if (errorKind.value === 'api') {
      clearError()
      return
    }

    if (errorKind.value === 'validation' && getVerificationIssues().length === 0) clearError()
  })

  function getVerificationIssues () {
    const issues: string[] = []
    const identifierIssue = getInspectionIdentifierIssue(identifier.value)
    const codeIssue = getVerificationCodeIssue(code.value)

    if (identifierIssue) issues.push(identifierIssue)
    if (codeIssue) issues.push(codeIssue)

    return issues
  }

  async function verify () {
    if (loading.value) return

    const issues = getVerificationIssues()
    if (issues.length > 0) {
      showError('validation', 'inspection_validation_error', issues)
      return
    }

    loading.value = true
    clearError()
    try {
      await authStore.applySession(await inspectionAuthService.verifyAccount({ identifier: identifier.value, code: code.value }))
      if (!authStore.isCitizen) {
        await authStore.logout()
        showError('identifier', 'inspection_error_citizen_only')
        return
      }

      authStore.clearRegistrationVerification()
      await router.push(inspectionRedirectOrDashboard(route.query.redirect))
    } catch (error) {
      const timerAlreadyShowsExpiry = expiresAt.value !== null && expiresAt.value <= Date.now()
      if (getInspectionAuthErrorCode(error) === 'AUTH_VERIFICATION_CODE_EXPIRED' && timerAlreadyShowsExpiry) {
        clearError()
      } else {
        showError('api', getInspectionAuthError(error, 'inspection_verify_error'))
      }
    } finally {
      clearingSubmittedCode = true
      code.value = ''
      loading.value = false
      await nextTick()
      clearingSubmittedCode = false
    }
  }

  async function resend () {
    if (resendLoading.value) return

    const identifierIssue = getInspectionIdentifierIssue(identifier.value)
    if (identifierIssue) {
      showError('validation', 'inspection_validation_error', [identifierIssue])
      return
    }

    resendLoading.value = true
    clearError()
    try {
      await authStore.resendRegistrationVerification(identifier.value)
      code.value = ''
    } catch (error) {
      showError('identifier', getInspectionAuthError(error, 'inspection_resend_error'))
    } finally {
      resendLoading.value = false
    }
  }
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <InspectionAuthShell compact :description="$t('inspection_verify_description')" :title="$t('inspection_verify_account')">
    <v-alert v-if="errorMessage" class="mb-5" density="compact" type="error">
      {{ errorMessage }}
    </v-alert>

    <v-form @submit.prevent="verify">
      <v-text-field
        autocomplete="username"
        :label="$t('inspection_identifier')"
        :model-value="identifier"
        prepend-inner-icon="mdi-account-outline"
        readonly
      />
      <v-otp-input v-model="code" class="mb-2" :length="6" :loading="loading" variant="outlined" />
      <VerificationCodeExpiry :expires-at="expiresAt" />
      <v-btn block color="primary" :disabled="loading" :loading="loading" size="large" type="submit">
        {{ $t('inspection_verify') }}
      </v-btn>
    </v-form>

    <div class="text-center mt-5">
      <v-btn color="primary" :loading="resendLoading" type="button" variant="text" @click="resend">
        {{ $t('inspection_resend_code') }}
      </v-btn>
    </div>
    <p class="auth-account-prompt text-center mt-2 mb-0">
      <router-link :to="{ path: '/services/inspection/register', query: { redirect: route.query.redirect } }">
        {{ $t('inspection_back_to_register') }}
      </router-link>
    </p>
  </InspectionAuthShell>
</template>
