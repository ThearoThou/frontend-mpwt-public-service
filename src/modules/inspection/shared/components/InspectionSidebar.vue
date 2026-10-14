<script setup lang="ts">
  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import ministryLogo from '@/assets/mpwt-logo-sm.svg'
  import { useInspectionAuthStore } from '@/modules/inspection/auth/stores/auth.store'

  const model = defineModel<boolean>({ default: true })
  const { mdAndUp } = useDisplay()
  const router = useRouter()
  const authStore = useInspectionAuthStore()
  const navigationItems = computed(() => [
    { icon: 'mdi-home', title: 'inspection_dashboard', to: '/services/inspection/dashboard' },
    { icon: 'mdi-car-outline', title: 'inspection_my_vehicles', to: '/services/inspection/vehicles' },
    { icon: 'mdi-file-document-outline', title: 'inspection_my_applications', to: '/services/inspection/applications' },
    { icon: 'mdi-history', title: 'inspection_history', to: '/services/inspection/inspection-history' },
    { icon: 'mdi-account-outline', title: 'inspection_profile_settings', to: '/services/inspection/profile' },
  ])

  async function leaveService () {
    if (authStore.logoutInProgress) return

    if (authStore.isAuthenticated) {
      await authStore.logout()
    }

    await router.push('/services/inspection')
  }
</script>

<template>
  <v-navigation-drawer
    v-model="model"
    class="inspection-sidebar"
    color="#2a3472"
    :permanent="mdAndUp"
    :temporary="!mdAndUp"
    width="250"
  >
    <div class="sidebar-brand pa-4 pt-5">
      <v-img alt="MPWT" class="sidebar-logo mx-auto" :src="ministryLogo" />
      <div class="sidebar-ministry mt-5">ក្រសួងសាធារណការ<br>និងដឹកជញ្ជូន</div>
      <div class="sidebar-ministry-subtitle mt-2">MINISTRY OF PUBLIC WORKS<br>AND TRANSPORT</div>
    </div>

    <v-list class="sidebar-navigation px-4" nav>
      <v-list-item
        v-for="item in navigationItems"
        :key="item.to"
        active-color="white"
        base-color="white"
        class="sidebar-navigation-item mb-2"
        :prepend-icon="item.icon"
        :title="$t(item.title)"
        :to="item.to"
      />

      <v-list-item
        class="sidebar-navigation-item sidebar-leave-action mb-2"
        :disabled="authStore.logoutInProgress"
        :prepend-icon="authStore.isAuthenticated ? 'mdi-logout' : 'mdi-exit-to-app'"
        :title="authStore.isAuthenticated ? $t('logout') : $t('inspection_exit')"
        @click="leaveService"
      >
        <template v-if="authStore.logoutInProgress" #append>
          <v-progress-circular indeterminate size="18" width="2" />
        </template>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<style scoped>
  .inspection-sidebar { color: white; position: fixed !important; }
  .inspection-sidebar :deep(.v-navigation-drawer__content) { display: flex; flex-direction: column; min-height: 0; }
  .inspection-sidebar :deep(.v-navigation-drawer__append) { background: #2a3472; border-top: 1px solid rgba(255, 255, 255, .2); flex: 0 0 auto; }
  .sidebar-brand { padding-bottom: 6px !important; text-align: center; }
  .sidebar-logo { width: 58px; max-height: 58px; }
  .sidebar-ministry { color: white; font-family: 'Moul', Calibri, 'Siemreap', sans-serif !important; font-size: .95rem; font-weight: 400 !important; line-height: 1.65; }
  .sidebar-ministry-subtitle { color: white; font-size: .7rem; font-weight: 400 !important; letter-spacing: .02em; line-height: 1.6; margin-inline: auto; max-width: none; text-align: center; white-space: nowrap; }
  .sidebar-navigation { flex: 1 1 auto; overflow-y: auto; }
  .sidebar-navigation :deep(.v-list-item) { align-items: center; min-height: 54px; padding-inline: 16px; border-radius: 10px; font-weight: 400; overflow: visible; }
  .sidebar-navigation :deep(.v-list-item__content) { align-self: center; overflow: visible; }
  .sidebar-navigation :deep(.v-list-item-title) { display: flex; align-items: center; min-height: 22px; padding-block: 1px; font-size: 14px; line-height: 1.55; overflow: visible; text-overflow: clip; white-space: normal; }
  .sidebar-navigation :deep(.v-list-item--active) { background: rgba(255, 255, 255, .14); clip-path: inset(0 4px round 10px); }
  .sidebar-navigation :deep(.v-list-item__prepend > .v-icon) { font-size: 21px !important; margin-inline-end: 12px; opacity: 1; }
  .sidebar-leave-action, .sidebar-leave-action :deep(.v-icon), .sidebar-leave-action :deep(.v-list-item-title) { color: #ff9b9b !important; font-weight: 400; }
</style>
