<script setup lang="ts">
  import { useRouter } from 'vue-router'
  import { useInspectionAuthStore } from '@/stores/inspectionAuth'

  const emit = defineEmits<{ 'toggle-navigation': [] }>()
  const router = useRouter()
  const authStore = useInspectionAuthStore()

  const displayName = computed(() => {
    const profile = authStore.currentUser?.citizenProfile
    return profile?.nameKh || profile?.nameEn || authStore.currentUser?.user.email || authStore.currentUser?.user.phone || ''
  })

  async function signOut () {
    await authStore.logout()
    await router.push('/services/inspection')
  }
</script>

<template>
  <v-app-bar border color="surface" elevation="0" height="72">
    <v-btn class="d-md-none" icon="mdi-menu" @click="emit('toggle-navigation')" />

    <v-app-bar-title class="text-subtitle-1 font-weight-bold">
      {{ $t('inspection_service_title') }}
    </v-app-bar-title>

    <v-menu>
      <template #activator="{ props }">
        <v-btn v-bind="props" append-icon="mdi-chevron-down" variant="text">
          {{ displayName }}
        </v-btn>
      </template>

      <v-list density="compact">
        <v-list-item
          prepend-icon="mdi-account-cog-outline"
          :title="$t('inspection_profile_settings')"
          to="/services/inspection/profile"
        />

        <v-divider />

        <v-list-item prepend-icon="mdi-logout" :title="$t('logout')" @click="signOut" />
      </v-list>
    </v-menu>
  </v-app-bar>
</template>
