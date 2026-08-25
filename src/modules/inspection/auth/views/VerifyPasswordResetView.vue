<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import InspectionAuthShell from '../components/InspectionAuthShell.vue'
  import { inspectionAuthService } from '../services/auth.service'
  import { useInspectionAuthStore } from '../stores/auth.store'
  import { getInspectionAuthError, getInspectionIdentifierIssue, getVerificationCodeIssue } from '../utils/auth.utils'

  type ErrorKind = 'api' | 'identifier' | 'validation'

  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const authStore = useInspectionAuthStore()
  const identifier = ref(typeof route.query.identifier === 'string' ? route.query.identifier : '')
  const code = ref('')
  const loading = ref(false)
  const resendLoading = ref(false)
  const errorMessage = ref('')
  const errorKind = ref<ErrorKind | null>(null)
  const successMessage = ref(route.query.requested === 'true' ? t('inspection_reset_request_success') : '')
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

    if (identifierIssue) issues.push(t(identifierIssue))
    if (codeIssue) issues.push(t(codeIssue))

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

  async function verify () {
    if (loading.value) return

    const issues = getVerificationIssues()
    if (issues.length > 0) {
      showError('validation', t('inspection_validation_error', { fields: issues.join(', ') }))
      return
    }

    loading.value = true
    clearError()
    try {
      await inspectionAuthService.verifyPasswordReset({ identifier: identifier.value, code: code.value })
      authStore.setPasswordResetVerification(identifier.value, code.value)
      await router.push({ path: '/services/inspection/reset-password', query: { redirect: route.query.redirect } })
    } catch (error) {
      showError('api', t(getInspectionAuthError(error, 'inspection_verify_error')))
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
      showError('validation', t('inspection_validation_error', { fields: t(identifierIssue) }))
      return
    }

    resendLoading.value = true
    clearError()
    try {
      await inspectionAuthService.requestPasswordReset(identifier.value)
      code.value = ''
      successMessage.value = t('inspection_reset_resend_success')
    } catch (error) {
      showError('identifier', t(getInspectionAuthError(error, 'inspection_reset_resend_error')))
    } finally {
      resendLoading.value = false
    }
  }
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <InspectionAuthShell compact :description="$t('inspection_reset_verify_description')" icon="mdi-shield-key-outline" :title="$t('inspection_reset_verify_code')">
    <v-alert v-if="successMessage" class="mb-3" density="compact" type="success">
      {{ successMessage }}
    </v-alert>

    <v-alert v-if="errorMessage" class="mb-5" density="compact" type="error">
      {{ errorMessage }}
    </v-alert>

    <v-form @submit.prevent="verify">
      <v-text-field
        v-model.trim="identifier"
        autocomplete="username"
        :label="$t('inspection_identifier')"
        prepend-inner-icon="mdi-account-outline"
      />
      <v-otp-input v-model="code" class="mb-5" :length="6" :loading="loading" variant="outlined" />
      <v-btn block color="primary" :disabled="loading" :loading="loading" size="large" type="submit">
        {{ $t('inspection_verify') }}
      </v-btn>
    </v-form>

    <div class="text-center mt-5">
      <v-btn color="primary" :loading="resendLoading" type="button" variant="text" @click="resend">
        {{ $t('inspection_resend_reset_code') }}
      </v-btn>
    </div>
    <p class="text-center mt-2 mb-0">
      <router-link :to="{ path: '/services/inspection/login', query: { redirect: route.query.redirect } }">
        {{ $t('inspection_back_to_login') }}
      </router-link>
    </p>
  </InspectionAuthShell>
</template>
