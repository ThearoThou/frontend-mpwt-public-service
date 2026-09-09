<script setup lang="ts">
  import { useRoute, useRouter } from 'vue-router'
  import InspectionAuthShell from '../components/InspectionAuthShell.vue'
  import VerificationCodeExpiry from '../components/VerificationCodeExpiry.vue'
  import { useInspectionAuthError } from '../composables/useInspectionAuthError'
  import { inspectionAuthService } from '../services/auth.service'
  import { useInspectionAuthStore } from '../stores/auth.store'
  import { getInspectionAuthError, getInspectionIdentifierIssue, getVerificationCodeIssue } from '../utils/auth.utils'

  type ErrorKind = 'api' | 'identifier' | 'validation'

  const route = useRoute()
  const router = useRouter()
  const authStore = useInspectionAuthStore()
  const identifier = computed(() => authStore.passwordResetRequest?.identifier
    ?? (typeof route.query.identifier === 'string' ? route.query.identifier : ''))
  const code = ref('')
  const loading = ref(false)
  const resendLoading = ref(false)
  const { clearError, errorKind, errorMessage, showError } = useInspectionAuthError<ErrorKind>()
  const expiresAt = computed(() => authStore.passwordResetRequest?.identifier === identifier.value
    ? authStore.passwordResetRequest.expiresAt
    : null)
  const hasCompleteCode = computed(() => getVerificationCodeIssue(code.value) === undefined)
  watch(identifier, () => {
    if (errorKind.value === 'api' || errorKind.value === 'identifier') {
      clearError()
      return
    }

    if (errorKind.value === 'validation' && getVerificationIssues().length === 0) clearError()
  })

  watch(code, () => {
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
    if (loading.value || resendLoading.value || !hasCompleteCode.value) return

    const issues = getVerificationIssues()
    if (issues.length > 0) {
      showError('validation', 'inspection_validation_error', issues)
      return
    }

    loading.value = true
    clearError()
    const verificationStartedAt = Date.now()
    try {
      const response = await inspectionAuthService.verifyPasswordReset({ identifier: identifier.value, code: code.value })
      authStore.setPasswordResetAuthorization(identifier.value, response, verificationStartedAt)
      await router.push({ path: '/services/inspection/reset-password', query: { redirect: route.query.redirect } })
    } catch (error) {
      showError('api', getInspectionAuthError(error, 'inspection_verify_error'))
    } finally {
      loading.value = false
    }
  }

  async function resend () {
    if (resendLoading.value || loading.value) return

    const identifierIssue = getInspectionIdentifierIssue(identifier.value)
    if (identifierIssue) {
      showError('validation', 'inspection_validation_error', [identifierIssue])
      return
    }

    resendLoading.value = true
    clearError()
    try {
      await authStore.requestPasswordReset(identifier.value)
      code.value = ''
    } catch (error) {
      showError('identifier', getInspectionAuthError(error, 'inspection_reset_resend_error'))
    } finally {
      resendLoading.value = false
    }
  }
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <InspectionAuthShell compact :description="$t('inspection_reset_verify_description')" icon="mdi-shield-key-outline" :title="$t('inspection_reset_verify_code')">
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
      <v-btn block color="primary" :disabled="loading || resendLoading || !hasCompleteCode" :loading="loading" size="large" type="submit">
        {{ $t('inspection_verify') }}
      </v-btn>
    </v-form>

    <div class="text-center mt-5">
      <v-btn color="primary" :disabled="loading" :loading="resendLoading" type="button" variant="text" @click="resend">
        {{ $t('inspection_resend_reset_code') }}
      </v-btn>
    </div>
    <p class="auth-account-prompt text-center mt-2 mb-0">
      <router-link :to="{ path: '/services/inspection/forgot-password', query: { redirect: route.query.redirect } }">
        {{ $t('inspection_back_to_forgot_password') }}
      </router-link>
    </p>
  </InspectionAuthShell>
</template>
