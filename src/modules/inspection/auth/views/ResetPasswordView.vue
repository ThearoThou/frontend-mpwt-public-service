<script setup lang="ts">
  import { useRoute, useRouter } from 'vue-router'
  import InspectionAuthShell from '../components/InspectionAuthShell.vue'
  import { useInspectionAuthError } from '../composables/useInspectionAuthError'
  import { inspectionAuthService } from '../services/auth.service'
  import { useInspectionAuthStore } from '../stores/auth.store'
  import { getInspectionAuthError, getInspectionAuthErrorCode, getPasswordConfirmationIssue, getPasswordIssue } from '../utils/auth.utils'

  type ErrorKind = 'api' | 'validation'

  const route = useRoute()
  const router = useRouter()
  const authStore = useInspectionAuthStore()
  const password = ref('')
  const confirmation = ref('')
  const showPassword = ref(false)
  const loading = ref(false)
  const requestNewCodeLoading = ref(false)
  const { clearError, errorKind, errorMessage, showError } = useInspectionAuthError<ErrorKind>()
  const now = ref(Date.now())
  const serverRejectedAsExpired = ref(false)
  const authorization = computed(() => authStore.passwordResetAuthorization)
  const authorizationExpired = computed(() => serverRejectedAsExpired.value
    || (authorization.value !== null && authorization.value.expiresAt <= now.value))
  let clearingSubmittedPasswords = false
  let expiryTimer: ReturnType<typeof setTimeout> | undefined

  function stopExpiryTimer () {
    if (expiryTimer !== undefined) clearTimeout(expiryTimer)
    expiryTimer = undefined
  }

  function scheduleExpiry () {
    stopExpiryTimer()
    now.value = Date.now()
    if (authorization.value === null) return

    const remainingMilliseconds = authorization.value.expiresAt - now.value
    if (remainingMilliseconds <= 0) return

    expiryTimer = setTimeout(() => {
      now.value = Date.now()
      expiryTimer = undefined
    }, remainingMilliseconds)
  }

  watch(() => authorization.value?.expiresAt, scheduleExpiry, { immediate: true })
  onBeforeUnmount(stopExpiryTimer)

  watch([password, confirmation], () => {
    if (clearingSubmittedPasswords) return

    if (errorKind.value === 'api') {
      clearError()
      return
    }

    if (errorKind.value === 'validation' && getResetIssues().length === 0) {
      clearError()
    }
  })

  onMounted(async () => {
    if (authorization.value === null) {
      await router.replace({ path: '/services/inspection/forgot-password', query: { redirect: route.query.redirect } })
    }
  })

  function getResetIssues () {
    const issues: string[] = []
    const passwordIssue = getPasswordIssue(password.value)
    const confirmationIssue = getPasswordConfirmationIssue(password.value, confirmation.value)

    if (passwordIssue) issues.push(passwordIssue)
    if (confirmationIssue) issues.push(confirmationIssue)

    return issues
  }

  async function resetPassword () {
    now.value = Date.now()
    if (loading.value || authorizationExpired.value) return

    const issues = getResetIssues()
    if (issues.length > 0) {
      showError('validation', 'inspection_validation_error', issues)
      return
    }

    if (authorization.value === null) {
      await router.replace({ path: '/services/inspection/forgot-password', query: { redirect: route.query.redirect } })
      return
    }

    loading.value = true
    clearError()
    try {
      await inspectionAuthService.confirmPasswordReset({
        resetToken: authorization.value.resetToken,
        newPassword: password.value,
      })
      authStore.clearPasswordResetVerification()
      await router.push({ path: '/services/inspection/login', query: { redirect: route.query.redirect, reset: 'true' } })
    } catch (error) {
      if (getInspectionAuthErrorCode(error) === 'RESET_TOKEN_EXPIRED') {
        serverRejectedAsExpired.value = true
        clearError()
      } else {
        showError('api', getInspectionAuthError(error, 'inspection_reset_error'))
      }
    } finally {
      clearingSubmittedPasswords = true
      password.value = ''
      confirmation.value = ''
      loading.value = false
      await nextTick()
      clearingSubmittedPasswords = false
    }
  }

  async function requestNewCode () {
    if (!authorizationExpired.value || authorization.value === null || requestNewCodeLoading.value) return

    const identifier = authorization.value.identifier
    requestNewCodeLoading.value = true
    clearError()
    try {
      await authStore.requestPasswordReset(identifier)
      await router.replace({
        path: '/services/inspection/verify-reset-password',
        query: { identifier, redirect: route.query.redirect, requested: 'true' },
      })
    } catch (error) {
      showError('api', getInspectionAuthError(error, 'inspection_reset_resend_error'))
    } finally {
      requestNewCodeLoading.value = false
    }
  }
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <InspectionAuthShell compact :description="$t('inspection_reset_description')" icon="mdi-lock-reset" :title="$t('inspection_reset_password')">
    <template v-if="authorization !== null">
      <div v-if="authorizationExpired" class="reset-authorization-expired text-center" role="status">
        <v-alert v-if="errorMessage" class="mb-5 text-start" density="compact" type="error">
          {{ errorMessage }}
        </v-alert>
        <v-icon class="mb-4" color="error" icon="mdi-clock-alert-outline" size="40" />
        <p class="text-medium-emphasis mb-5">{{ $t('inspection_reset_authorization_expired') }}</p>
        <v-btn color="primary" :disabled="requestNewCodeLoading" :loading="requestNewCodeLoading" size="large" type="button" @click="requestNewCode">
          {{ $t('inspection_request_new_code') }}
        </v-btn>
      </div>

      <template v-else>
        <v-alert v-if="errorMessage" class="mb-5" density="compact" type="error">
          {{ errorMessage }}
        </v-alert>

        <v-form @submit.prevent="resetPassword">
          <v-text-field
            v-model="password"
            :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            autocomplete="new-password"
            :label="$t('inspection_new_password')"
            maxlength="128"
            prepend-inner-icon="mdi-lock-outline"
            :type="showPassword ? 'text' : 'password'"
            @click:append-inner="showPassword = !showPassword"
          />
          <v-text-field
            v-model="confirmation"
            autocomplete="new-password"
            :error="Boolean(confirmation) && confirmation !== password"
            :label="$t('inspection_confirm_password')"
            maxlength="128"
            prepend-inner-icon="mdi-lock-check-outline"
            :type="showPassword ? 'text' : 'password'"
          />
          <v-btn block color="primary" :disabled="loading" :loading="loading" size="large" type="submit">
            {{ $t('inspection_reset_password') }}
          </v-btn>
        </v-form>
      </template>
    </template>

    <p class="auth-account-prompt text-center mt-6 mb-0">
      <router-link :to="{ path: '/services/inspection/login', query: { redirect: route.query.redirect } }">
        {{ $t('inspection_back_to_login') }}
      </router-link>
    </p>
  </InspectionAuthShell>
</template>

<style scoped>
  .reset-authorization-expired { padding: 1rem 0; }
</style>
