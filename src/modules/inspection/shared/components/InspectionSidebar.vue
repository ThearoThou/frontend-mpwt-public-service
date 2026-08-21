<script setup lang="ts">
  import { useDisplay } from 'vuetify'
  const model = defineModel<boolean>({ default: true })
  const { mdAndUp } = useDisplay()
  const navigationItems = computed(() => [
    { icon: 'mdi-view-dashboard-outline', title: 'inspection_dashboard', to: '/services/inspection/dashboard' },
    { icon: 'mdi-car-outline', title: 'inspection_my_vehicles', to: '/services/inspection/vehicles' },
    { icon: 'mdi-file-document-outline', title: 'inspection_my_applications', to: '/services/inspection/applications' },
    { icon: 'mdi-history', title: 'inspection_history', to: '/services/inspection/inspection-history' },
    { icon: 'mdi-account-cog-outline', title: 'inspection_profile_settings', to: '/services/inspection/profile' },
  ])
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line -->
  <v-navigation-drawer v-model="model" color="surface" :permanent="mdAndUp" :temporary="!mdAndUp" width="272">
    <div class="pa-5"><div class="d-flex align-center ga-3"><v-avatar color="primary" icon="mdi-car-wrench" rounded="lg" /><div><div class="text-subtitle-1 font-weight-bold">{{ $t('inspection_service_title') }}</div><div class="text-caption text-medium-emphasis">{{ $t('inspection_service_label') }}</div></div></div></div>
    <v-divider />
    <v-list class="pa-3" nav><v-list-item v-for="item in navigationItems" :key="item.to" active-color="primary" :prepend-icon="item.icon" :title="$t(item.title)" :to="item.to" /></v-list>
    <template #append><div class="pa-3"><v-btn block prepend-icon="mdi-arrow-left" to="/" variant="text">{{ $t('inspection_return_to_portal') }}</v-btn></div></template>
  </v-navigation-drawer>
</template>
