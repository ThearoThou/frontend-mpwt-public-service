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
    { icon: 'mdi-bell-outline', title: 'inspection_history', to: '/services/inspection/inspection-history' },
    { icon: 'mdi-account-outline', title: 'inspection_profile_settings', to: '/services/inspection/profile' },
  ])

  async function leaveService () {
    if (authStore.isAuthenticated) {
      await authStore.logout()
      await router.push('/services/inspection')
      return
    }

    await router.push({
      path: '/services/inspection/login',
      query: { redirect: '/services/inspection/dashboard' },
    })
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
    <div class="sidebar-brand pa-5 pt-6">
      <v-img alt="MPWT" class="sidebar-logo mx-auto" :src="ministryLogo" />
      <div class="sidebar-ministry mt-5">ក្រសួងសាធារណការ<br>និង ដឹកជញ្ជូន</div>
      <div class="sidebar-ministry-subtitle mt-2">MINISTRY OF PUBLIC WORKS<br>AND TRANSPORT</div>
    </div>

    <v-list class="sidebar-navigation px-4" nav>
      <v-list-item
        v-for="item in navigationItems"
        :key="item.to"
        active-color="white"
        base-color="white"
        class="sidebar-navigation-item mb-3"
        :prepend-icon="item.icon"
        :title="$t(item.title)"
        :to="item.to"
      />
    </v-list>

    <template #append>
      <div class="pa-4 pb-7">
        <v-btn
          block
          class="sidebar-leave-action justify-start"
          prepend-icon="mdi-logout"
          variant="text"
          @click="leaveService"
        >
          {{ authStore.isAuthenticated ? $t('logout') : $t('inspection_sign_in') }}
        </v-btn>
      </div>
    </template>
  </v-navigation-drawer>
</template>

<style scoped>
  .inspection-sidebar { color: white; }
  .sidebar-brand { text-align: center; }
  .sidebar-logo { width: 64px; max-height: 64px; }
  .sidebar-ministry { color: white; font-size: 1.35rem; font-weight: 700; line-height: 1.25; }
  .sidebar-ministry-subtitle { color: white; font-size: .75rem; font-weight: 700; letter-spacing: .03em; line-height: 1.7; margin-inline: auto; max-width: 180px; text-align: center; }
  .sidebar-navigation :deep(.v-list-item) { min-height: 52px; border-radius: 10px; font-size: .94rem; font-weight: 700; }
  .sidebar-navigation :deep(.v-list-item--active) { background: #8698ca; }
  .sidebar-navigation :deep(.v-list-item__prepend > .v-icon) { margin-inline-end: 14px; opacity: 1; }
  .sidebar-leave-action { color: #ffd8d2; font-weight: 700; }
  .sidebar-leave-action :deep(.v-btn__prepend) { margin-inline-end: 20px; }
</style>
