<script setup lang="ts">
  import { isAxiosError } from 'axios'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { useInspectionAuthStore } from '@/stores/inspectionAuth'

  const router = useRouter()
  const route = useRoute()
  const authStore = useInspectionAuthStore()
  const { t } = useI18n()
  const identifier = ref('')
  const password = ref('')
  const loading = ref(false)
  const errorMessage = ref('')

  async function signIn () {
    loading.value = true
    errorMessage.value = ''

    try {
      await authStore.login({ identifier: identifier.value, password: password.value })
      const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/services/inspection/dashboard'
      await router.push(redirect)
    } catch (error) {
      errorMessage.value = isAxiosError(error)
        ? (error.response?.data as { message?: string } | undefined)?.message || t('inspection_login_error')
        : t('inspection_login_error')
    } finally {
      loading.value = false
    }
  }
</script>

<template>
  <v-container class="py-12" max-width="480">
    <v-card border class="pa-6" elevation="0" rounded="lg">
      <h1 class="text-h5 font-weight-bold mb-2">{{ $t('inspection_sign_in') }}</h1>

      <p class="text-body-2 text-medium-emphasis mb-6">{{ $t('inspection_login_description') }}</p>

      <v-alert v-if="errorMessage" class="mb-4" density="compact" type="error">{{ errorMessage }}</v-alert>

      <v-form @submit.prevent="signIn">
        <v-text-field v-model="identifier" autocomplete="username" :label="$t('inspection_identifier')" required />

        <v-text-field
          v-model="password"
          autocomplete="current-password"
          :label="$t('inspection_password')"
          required
          type="password"
        />

        <v-btn block color="primary" :loading="loading" type="submit">{{ $t('inspection_sign_in') }}</v-btn>
      </v-form>
    </v-card>
  </v-container>
</template>
