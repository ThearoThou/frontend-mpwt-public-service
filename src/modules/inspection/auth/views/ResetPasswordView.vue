<script setup lang="ts">
  /* eslint-disable @stylistic/brace-style, @stylistic/max-statements-per-line */
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import InspectionAuthShell from '../components/InspectionAuthShell.vue'
  import { inspectionAuthService } from '../services/auth.service'
  import { useInspectionAuthStore } from '../stores/auth.store'
  import { getInspectionAuthError, getPasswordConfirmationIssue, getPasswordIssue } from '../utils/auth.utils'
  const route = useRoute(); const router = useRouter(); const { t } = useI18n()
  const authStore = useInspectionAuthStore()
  const password = ref(''); const confirmation = ref(''); const showPassword = ref(false); const loading = ref(false); const errorMessage = ref('')

  onMounted(async () => {
    if (authStore.passwordResetIdentifier === null || authStore.passwordResetCode === null) {
      await router.replace({ path: '/services/inspection/forgot-password', query: { redirect: route.query.redirect } })
    }
  })

  function getResetIssues () {
    const issues: string[] = []
    const passwordIssue = getPasswordIssue(password.value)
    const confirmationIssue = getPasswordConfirmationIssue(password.value, confirmation.value)

    if (passwordIssue) issues.push(t(passwordIssue))
    if (confirmationIssue) issues.push(t(confirmationIssue))
    return issues
  }

  async function resetPassword () {
    if (loading.value) return
    const issues = getResetIssues()
    if (issues.length > 0) { errorMessage.value = t('inspection_validation_error', { fields: issues.join(', ') }); return }
    if (authStore.passwordResetIdentifier === null || authStore.passwordResetCode === null) { await router.replace({ path: '/services/inspection/forgot-password', query: { redirect: route.query.redirect } }); return }
    loading.value = true; errorMessage.value = ''
    try { await inspectionAuthService.confirmPasswordReset({ identifier: authStore.passwordResetIdentifier, code: authStore.passwordResetCode, newPassword: password.value }); authStore.clearPasswordResetVerification(); await router.push({ path: '/services/inspection/login', query: { redirect: route.query.redirect, reset: 'true' } }) } catch (error) { errorMessage.value = t(getInspectionAuthError(error, 'inspection_reset_error')) } finally { password.value = ''; confirmation.value = ''; loading.value = false }
  }
</script>
<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <InspectionAuthShell compact :description="$t('inspection_reset_description')" icon="mdi-lock-reset" :title="$t('inspection_reset_password')">
    <v-alert v-if="errorMessage" class="mb-5" type="error">{{ errorMessage }}</v-alert>
    <v-form @submit.prevent="resetPassword"><v-text-field v-model="password" :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" autocomplete="new-password" :label="$t('inspection_new_password')" maxlength="128" prepend-inner-icon="mdi-lock-outline" :type="showPassword ? 'text' : 'password'" @click:append-inner="showPassword = !showPassword" /><v-text-field v-model="confirmation" autocomplete="new-password" :error="Boolean(confirmation) && confirmation !== password" :label="$t('inspection_confirm_password')" maxlength="128" prepend-inner-icon="mdi-lock-check-outline" :type="showPassword ? 'text' : 'password'" /><v-btn block color="primary" :disabled="loading" :loading="loading" size="large" type="submit">{{ $t('inspection_reset_password') }}</v-btn></v-form>
    <p class="text-center mt-6 mb-0"><router-link :to="{ path: '/services/inspection/login', query: { redirect: route.query.redirect } }">{{ $t('inspection_back_to_login') }}</router-link></p>
  </InspectionAuthShell>
</template>
