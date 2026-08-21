<script setup lang="ts">
  import { useInspectionAuthStore } from '@/modules/inspection/auth/stores/auth.store'
  import InspectionPagePlaceholder from '@/modules/inspection/shared/components/InspectionPagePlaceholder.vue'

  const authStore = useInspectionAuthStore()
  const sessionCheckComplete = ref(false)

  onMounted(async () => {
    await authStore.restoreSession()
    sessionCheckComplete.value = true
  })
</script>

<template>
  <InspectionPagePlaceholder description="inspection_dashboard_placeholder" title="inspection_dashboard" />

  <div v-if="sessionCheckComplete && !authStore.isCitizen" class="mt-6">
    <v-btn color="primary" prepend-icon="mdi-login" :to="{ path: '/services/inspection/login', query: { redirect: '/services/inspection/dashboard' } }">
      {{ $t('inspection_sign_in') }}
    </v-btn>
  </div>
</template>
