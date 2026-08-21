<script setup lang="ts">
  /* eslint-disable @stylistic/brace-style, @stylistic/max-statements-per-line */
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import InspectionAuthShell from '../components/InspectionAuthShell.vue'
  import { inspectionAuthService } from '../services/auth.service'
  import { useInspectionAuthStore } from '../stores/auth.store'
  import { getInspectionAuthError, getInspectionIdentifierIssue } from '../utils/auth.utils'
  const route = useRoute(); const router = useRouter(); const { t } = useI18n()
  const authStore = useInspectionAuthStore()
  const identifier = ref(typeof route.query.identifier === 'string' ? route.query.identifier : '')
  const loading = ref(false); const errorMessage = ref('')

  async function requestReset () {
    if (loading.value) return
    const identifierIssue = getInspectionIdentifierIssue(identifier.value)
    if (identifierIssue) { errorMessage.value = t('inspection_validation_error', { fields: t(identifierIssue) }); return }
    loading.value = true; errorMessage.value = ''
    try {
      authStore.clearPasswordResetVerification()
      await inspectionAuthService.requestPasswordReset(identifier.value)
    } catch (error) {
      errorMessage.value = t(getInspectionAuthError(error, 'inspection_forgot_error'))
      loading.value = false
      return
    }

    try {
      await router.push({ path: '/services/inspection/verify-reset-password', query: { identifier: identifier.value, redirect: route.query.redirect, requested: 'true' } })
    } finally {
      loading.value = false
    }
  }
</script>
<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <InspectionAuthShell compact :description="$t('inspection_forgot_description')" :title="$t('inspection_forgot_password')">
    <v-alert v-if="errorMessage" class="mb-5" type="error">{{ errorMessage }}</v-alert>
    <v-form @submit.prevent="requestReset"><v-text-field v-model.trim="identifier" autocomplete="username" :label="$t('inspection_identifier')" prepend-inner-icon="mdi-account-outline" /><v-btn block color="primary" :disabled="loading" :loading="loading" size="large" type="submit">{{ $t('inspection_send_reset_code') }}</v-btn></v-form>
    <p class="text-center mt-6 mb-0"><router-link :to="{ path: '/services/inspection/login', query: { redirect: route.query.redirect } }">{{ $t('inspection_back_to_login') }}</router-link></p>
  </InspectionAuthShell>
</template>
