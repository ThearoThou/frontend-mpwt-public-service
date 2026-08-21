<script setup lang="ts">
  /* eslint-disable @stylistic/brace-style, @stylistic/max-statements-per-line */
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import InspectionAuthShell from '../components/InspectionAuthShell.vue'
  import { inspectionAuthService } from '../services/auth.service'
  import { useInspectionAuthStore } from '../stores/auth.store'
  import { getInspectionAuthError, getInspectionIdentifierIssue, getVerificationCodeIssue, inspectionRedirectOrDashboard } from '../utils/auth.utils'

  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const authStore = useInspectionAuthStore()
  const identifier = ref(typeof route.query.identifier === 'string' ? route.query.identifier : '')
  const code = ref('')
  const loading = ref(false)
  const resendLoading = ref(false)
  const errorMessage = ref('')
  const successMessage = ref('')

  function getVerificationIssues () {
    const issues: string[] = []
    const identifierIssue = getInspectionIdentifierIssue(identifier.value)
    const codeIssue = getVerificationCodeIssue(code.value)
    if (identifierIssue) issues.push(t(identifierIssue))
    if (codeIssue) issues.push(t(codeIssue))
    return issues
  }

  async function verify () {
    if (loading.value) return
    const issues = getVerificationIssues()
    if (issues.length > 0) { errorMessage.value = t('inspection_validation_error', { fields: issues.join(', ') }); return }
    loading.value = true
    errorMessage.value = ''
    try {
      await authStore.applySession(await inspectionAuthService.verifyAccount({ identifier: identifier.value, code: code.value }))
      if (!authStore.isCitizen) {
        await authStore.logout()
        errorMessage.value = t('inspection_error_citizen_only')
        return
      }
      await router.push(inspectionRedirectOrDashboard(route.query.redirect))
    } catch (error) {
      errorMessage.value = t(getInspectionAuthError(error, 'inspection_verify_error'))
    } finally { code.value = ''; loading.value = false }
  }
  async function resend () {
    if (resendLoading.value) return
    const identifierIssue = getInspectionIdentifierIssue(identifier.value)
    if (identifierIssue) { errorMessage.value = t('inspection_validation_error', { fields: t(identifierIssue) }); return }
    resendLoading.value = true
    errorMessage.value = ''
    try { await inspectionAuthService.resendVerification(identifier.value); successMessage.value = t('inspection_resend_success') } catch (error) { errorMessage.value = t(getInspectionAuthError(error, 'inspection_resend_error')) } finally { resendLoading.value = false }
  }
</script>
<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <InspectionAuthShell compact :description="$t('inspection_verify_description')" :title="$t('inspection_verify_account')">
    <v-alert v-if="successMessage" class="mb-5" type="success">{{ successMessage }}</v-alert><v-alert v-if="errorMessage" class="mb-5" type="error">{{ errorMessage }}</v-alert>
    <v-form @submit.prevent="verify"><v-text-field v-model.trim="identifier" autocomplete="username" :label="$t('inspection_identifier')" prepend-inner-icon="mdi-account-outline" /><v-otp-input v-model="code" class="mb-5" :length="6" :loading="loading" variant="outlined" /><v-btn block color="primary" :disabled="loading" :loading="loading" size="large" type="submit">{{ $t('inspection_verify') }}</v-btn></v-form>
    <div class="text-center mt-5"><v-btn color="primary" :loading="resendLoading" type="button" variant="text" @click="resend">{{ $t('inspection_resend_code') }}</v-btn></div>
    <p class="text-center mt-2 mb-0"><router-link :to="{ path: '/services/inspection/login', query: { redirect: route.query.redirect } }">{{ $t('inspection_back_to_login') }}</router-link></p>
  </InspectionAuthShell>
</template>
