<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import InspectionAuthShell from '../components/InspectionAuthShell.vue'
  import { useInspectionAuthStore } from '../stores/auth.store'
  import { getInspectionAuthError, getInspectionIdentifierIssue, getPasswordIssue, inspectionRedirectOrDashboard } from '../utils/auth.utils'

  type ErrorKind = 'api' | 'validation'

  const RESET_SUCCESS_DURATION_MS = 5000
  const router = useRouter()
  const route = useRoute()
  const authStore = useInspectionAuthStore()
  const { t } = useI18n()
  const identifier = ref('')
  const password = ref('')
  const showPassword = ref(false)
  const loading = ref(false)
  const errorMessage = ref('')
  const errorKind = ref<ErrorKind | null>(null)
  const resetSuccessMessage = ref('')
  let resetSuccessTimer: ReturnType<typeof setTimeout> | undefined
  let clearingSubmittedPassword = false

  watch([identifier, password], () => {
    if (clearingSubmittedPassword) return

    if (errorKind.value === 'api') {
      clearError()
      return
    }

    if (errorKind.value === 'validation' && getLoginIssues().length === 0) {
      clearError()
    }
  })

  onMounted(() => {
    if (route.query.reset !== 'true') return

    resetSuccessMessage.value = t('inspection_reset_success')
    void removeResetQueryFlag()
    resetSuccessTimer = setTimeout(clearResetSuccess, RESET_SUCCESS_DURATION_MS)
  })

  onBeforeUnmount(() => {
    if (resetSuccessTimer !== undefined) clearTimeout(resetSuccessTimer)
  })

  function getLoginIssues () {
    const issues: string[] = []
    const identifierIssue = getInspectionIdentifierIssue(identifier.value)
    const passwordIssue = getPasswordIssue(password.value)

    if (identifierIssue) issues.push(t(identifierIssue))
    if (passwordIssue) issues.push(t(passwordIssue))

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

  function clearResetSuccess () {
    resetSuccessMessage.value = ''
    if (resetSuccessTimer !== undefined) clearTimeout(resetSuccessTimer)
    resetSuccessTimer = undefined
  }

  async function removeResetQueryFlag () {
    const { reset: _reset, ...query } = route.query
    await router.replace({ query })
  }

  async function signIn () {
    if (loading.value) return

    clearResetSuccess()

    const issues = getLoginIssues()
    if (issues.length > 0) {
      showError('validation', t('inspection_validation_error', { fields: issues.join(', ') }))
      return
    }

    loading.value = true
    clearError()
    try {
      await authStore.login({ identifier: identifier.value, password: password.value })
      if (!authStore.isCitizen) {
        await authStore.logout()
        showError('api', t('inspection_error_citizen_only'))
        return
      }

      await router.push(inspectionRedirectOrDashboard(route.query.redirect))
    } catch (error) {
      showError('api', t(getInspectionAuthError(error, 'inspection_login_error')))
    } finally {
      clearingSubmittedPassword = true
      password.value = ''
      loading.value = false
      await nextTick()
      clearingSubmittedPassword = false
    }
  }
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/padding-line-between-tags -->
  <InspectionAuthShell compact :description="$t('inspection_login_description')" :title="$t('inspection_sign_in')">
    <v-alert v-if="resetSuccessMessage" class="mb-5" density="comfortable" type="success">
      {{ resetSuccessMessage }}
    </v-alert>

    <v-alert v-if="errorMessage" class="mb-5" density="comfortable" type="error">
      {{ errorMessage }}
    </v-alert>

    <v-form @submit.prevent="signIn">
      <v-text-field
        v-model.trim="identifier"
        autocomplete="username"
        :label="$t('inspection_identifier')"
        prepend-inner-icon="mdi-account-outline"
      />
      <v-text-field
        v-model="password"
        :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
        autocomplete="current-password"
        :label="$t('inspection_password')"
        maxlength="128"
        prepend-inner-icon="mdi-lock-outline"
        :type="showPassword ? 'text' : 'password'"
        @click:append-inner="showPassword = !showPassword"
      />
      <div class="d-flex justify-end mb-6">
        <v-btn
          color="primary"
          :disabled="loading"
          :to="{ path: '/services/inspection/forgot-password', query: { redirect: route.query.redirect } }"
          variant="text"
        >
          {{ $t('inspection_forgot_password') }}
        </v-btn>
      </div>
      <v-btn block color="primary" :disabled="loading" :loading="loading" size="large" type="submit">
        {{ $t('inspection_sign_in') }}
      </v-btn>
    </v-form>

    <p class="text-center mt-6 mb-0">
      {{ $t('inspection_no_account') }}
      <router-link :to="{ path: '/services/inspection/register', query: { redirect: route.query.redirect } }">
        {{ $t('inspection_register') }}
      </router-link>
    </p>
  </InspectionAuthShell>
</template>
