<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { useInspectionAuthStore } from '@/modules/inspection/auth/stores/auth.store'
  import { displayCitizenName } from '../utils/citizen-display-name'

  const emit = defineEmits<{ 'toggle-navigation': [] }>()
  const router = useRouter()
  const { locale } = useI18n()
  const authStore = useInspectionAuthStore()
  const displayName = computed(() => {
    const profile = authStore.currentUser?.citizenProfile
    return displayCitizenName(profile, locale.value, authStore.currentUser?.user.email || authStore.currentUser?.user.phone || '')
  })
  async function signOut () {
    await authStore.logout()
    await router.push('/services/inspection')
  }

</script>

<template>
  <v-app-bar border color="surface" elevation="0" height="76">
    <v-btn class="d-md-none" icon="mdi-menu" @click="emit('toggle-navigation')" />
    <v-app-bar-title class="inspection-header-title">{{ $t('inspection_service_title') }}</v-app-bar-title>

    <div class="inspection-header-actions">
      <v-btn aria-label="Notifications" icon="mdi-bell-outline" to="/services/inspection/inspection-history" />
      <LanguageSwitcher />
      <v-btn aria-label="Theme" icon="mdi-weather-night" />

      <v-menu>
        <template #activator="{ props }">
          <v-btn v-bind="props" icon variant="text">
            <v-avatar color="primary" size="42">
              <span class="text-subtitle-2 font-weight-bold">{{ displayName.slice(0, 1).toUpperCase() || 'G' }}</span>
            </v-avatar>
          </v-btn>
        </template>

        <v-list density="compact">
          <v-list-item prepend-icon="mdi-account-cog-outline" :title="$t('inspection_profile_settings')" to="/services/inspection/profile" />
          <v-divider />
          <v-list-item prepend-icon="mdi-logout" :title="$t('logout')" @click="signOut" />
        </v-list>
      </v-menu>
    </div>
  </v-app-bar>
</template>

<style scoped>
  .inspection-header-title {
    color: #10172d;
    font-size: clamp(1rem, 1.3vw, 1.4rem);
    font-weight: 700;
    line-height: 1.25;
    overflow: visible;
    text-overflow: clip;
    white-space: nowrap;
  }

  .inspection-header-actions {
    align-items: center;
    display: flex;
    gap: 12px;
    padding-inline-end: 12px;
  }

  @media (max-width: 600px) {
    .inspection-header-actions { gap: 6px; padding-inline-end: 0; }
  }
</style>
