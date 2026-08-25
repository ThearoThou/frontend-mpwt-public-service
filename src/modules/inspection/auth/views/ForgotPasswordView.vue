<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import InspectionAuthShell from '../components/InspectionAuthShell.vue'
  import { inspectionAuthService } from '../services/auth.service'
  import { useInspectionAuthStore } from '../stores/auth.store'
  import { getInspectionAuthError, getInspectionIdentifierIssue } from '../utils/auth.utils'

  type ErrorKind = 'api' | 'validation'

  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const authStore = useInspectionAuthStore()
  const identifier = ref('')
  const loading = ref(false)
  const errorMessage = ref('')
  const errorKind = ref<ErrorKind | null>(null)

  watch(identifier, () => {
    if (errorKind.value === 'api') {
      clearError()
      return
    }

    if (errorKind.value === 'validation' && getInspectionIdentifierIssue(identifier.value) === undefined) {
      clearError()
    }
  })

  function clearError () {
    errorMessage.value = ''
    errorKind.value = null
  }

  function showError (kind: ErrorKind, message: string) {
    errorMessage.value = message
    errorKind.value = kind
  }

  async function requestReset () {
    if (loading.value) return

    const identifierIssue = getInspectionIdentifierIssue(identifier.value)
    if (identifierIssue) {
      showError('validation', t('inspection_validation_error', { fields: t(identifierIssue) }))
      return
    }

    loading.value = true
    clearError()
    try {
      authStore.clearPasswordResetVerification()
      await inspectionAuthService.requestPasswordReset(identifier.value)
    } catch (error) {
      showError('api', t(getInspectionAuthError(error, 'inspection_forgot_error')))
      return
    } finally {
      loading.value = false
    }

    await router.push({
      path: '/services/inspection/verify-reset-password',
      query: { identifier: identifier.value, redirect: route.query.redirect, requested: 'true' },
    })
  }
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <InspectionAuthShell compact :description="$t('inspection_forgot_description')" :title="$t('inspection_forgot_password')">
    <v-alert v-if="errorMessage" class="mb-5" density="compact" type="error">
      {{ errorMessage }}
    </v-alert>

    <v-form @submit.prevent="requestReset">
      <v-text-field
        v-model.trim="identifier"
        autocomplete="username"
        :label="$t('inspection_identifier')"
        prepend-inner-icon="mdi-account-outline"
      />
      <v-btn block color="primary" :disabled="loading" :loading="loading" size="large" type="submit">
        {{ $t('inspection_send_reset_code') }}
      </v-btn>
    </v-form>

    <p class="text-center mt-6 mb-0">
      <router-link :to="{ path: '/services/inspection/login', query: { redirect: route.query.redirect } }">
        {{ $t('inspection_back_to_login') }}
      </router-link>
    </p>
  </InspectionAuthShell>
</template>
