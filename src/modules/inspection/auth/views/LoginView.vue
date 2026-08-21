<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import InspectionAuthShell from '../components/InspectionAuthShell.vue'
  import { useInspectionAuthStore } from '../stores/auth.store'
  import { getInspectionAuthError, getInspectionIdentifierIssue, getPasswordIssue, inspectionRedirectOrDashboard } from '../utils/auth.utils'

  const router = useRouter()
  const route = useRoute()
  const authStore = useInspectionAuthStore()
  const { t } = useI18n()
  const identifier = ref('')
  const password = ref('')
  const showPassword = ref(false)
  const loading = ref(false)
  const errorMessage = ref('')
  const successMessage = computed(() => route.query.reset === 'true' ? t('inspection_reset_success') : '')

  function getLoginIssues () {
    const issues: string[] = []

    const identifierIssue = getInspectionIdentifierIssue(identifier.value)
    const passwordIssue = getPasswordIssue(password.value)

    if (identifierIssue) issues.push(t(identifierIssue))
    if (passwordIssue) issues.push(t(passwordIssue))

    return issues
  }

  async function signIn () {
    if (loading.value) return

    const issues = getLoginIssues()
    if (issues.length > 0) {
      errorMessage.value = t('inspection_validation_error', { fields: issues.join(', ') })
      return
    }

    loading.value = true
    errorMessage.value = ''
    try {
      await authStore.login({ identifier: identifier.value, password: password.value })
      if (!authStore.isCitizen) {
        await authStore.logout()
        errorMessage.value = t('inspection_error_citizen_only')
        return
      }
      await router.push(inspectionRedirectOrDashboard(route.query.redirect))
    } catch (error) {
      errorMessage.value = t(getInspectionAuthError(error, 'inspection_login_error'))
    } finally {
      password.value = ''
      loading.value = false
    }
  }
</script>
<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <InspectionAuthShell compact :description="$t('inspection_login_description')" :title="$t('inspection_sign_in')">
    <v-alert v-if="successMessage" class="mb-5" density="comfortable" type="success">{{ successMessage }}</v-alert>
    <v-alert v-if="errorMessage" class="mb-5" density="comfortable" type="error">{{ errorMessage }}</v-alert>
    <v-form @submit.prevent="signIn">
      <v-text-field v-model.trim="identifier" autocomplete="username" :label="$t('inspection_identifier')" prepend-inner-icon="mdi-account-outline" />
      <v-text-field v-model="password" :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" autocomplete="current-password" :label="$t('inspection_password')" maxlength="128" prepend-inner-icon="mdi-lock-outline" :type="showPassword ? 'text' : 'password'" @click:append-inner="showPassword = !showPassword" />
      <div class="d-flex justify-end mb-6"><v-btn color="primary" :disabled="loading" :to="{ path: '/services/inspection/forgot-password', query: { redirect: route.query.redirect } }" variant="text">{{ $t('inspection_forgot_password') }}</v-btn></div>
      <v-btn block color="primary" :disabled="loading" :loading="loading" size="large" type="submit">{{ $t('inspection_sign_in') }}</v-btn>
    </v-form>
    <p class="text-center mt-6 mb-0">{{ $t('inspection_no_account') }} <router-link :to="{ path: '/services/inspection/register', query: { redirect: route.query.redirect } }">{{ $t('inspection_register') }}</router-link></p>
  </InspectionAuthShell>
</template>
