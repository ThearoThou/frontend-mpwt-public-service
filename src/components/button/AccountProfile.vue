<script lang="ts" setup>
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useTheme } from 'vuetify'
  import { useKeycloak } from '@/composables/useKeycloak.ts'
  import { useAuthStore } from '@/stores/auth.ts'

  const router = useRouter()
  const theme = useTheme()
  const menu = ref(false)
  const { isAuthenticated, user, logout } = useAuthStore()
  // Mock user data

  // Menu items
  const menuItems = [
    {
      title: 'ប្រវត្តិរូប',
      icon: 'gg:profile',
      action: 'profile',
    },
    {
      title: 'ថតឯកសារ',
      icon: 'gravity-ui:folder',
      action: 'folder',
    },
    {
      title: 'សុវត្ថិភាព',
      icon: 'iconamoon:lock',
      action: 'security',
    },
    {
      title: 'ការកំណត់',
      icon: 'uil:setting',
      action: 'settings',
    },
  ]

  function handleMenuAction (action: string) {
    menu.value = false
    switch (action) {
      case 'profile': {
        router.push('/account/profile')
        break
      }
      case 'security': {
        router.push('/account/security')
        break
      }
      case 'settings': {
        router.push('/account/settings')
        break
      }
    }
  }

  async function handleLogout () {
    menu.value = false
    await logout()
    // Add logout logic here
    await router.push('/')
  }
</script>

<template>
  <v-menu v-model="menu" :close-on-content-click="false" location="bottom end">
    <template #activator="{ props }">
      <v-btn
        v-bind="props"
        aria-label="Account menu"
        icon
        variant="text"
      >
        <v-avatar
          class="border border-md"
          :class="{ 'border-primary': !theme.current.value.dark }"
          :image="user?.avatar"
          size="46"
        />
      </v-btn>
    </template>

    <!-- Menu Content -->
    <v-card class="elevation-4" width="280">
      <!-- User Info Header -->
      <div class="pa-4 d-flex align-center gap-3 border-b">
        <v-avatar
          class="border border-md"
          :class="{ 'border-primary': !theme.current.value.dark }"
          :image="user?.avatar"
          size="48"
        />
        <div class="flex-grow-1 ml-2">
          <div class="text-body2 font-weight-600">{{ user?.name }}</div>
          <div class="text-caption text-medium-emphasis">{{ user?.email }}</div>
          <v-chip class="mt-1" size="x-small" variant="outlined">
            {{ user?.phone }}
          </v-chip>
        </div>
      </div>

      <!-- Menu Items -->
      <v-list class="py-2" density="compact">
        <v-list-item
          v-for="item in menuItems"
          :key="item.action"
          class="text-body2"
          :prepend-icon="item.icon"
          @click="handleMenuAction(item.action)"
        >
          <v-list-item-title>{{ item.title }}</v-list-item-title>
        </v-list-item>
      </v-list>

      <v-divider />

      <!-- Logout Button -->
      <div class="pa-2">
        <v-btn
          block
          class="text-body2"
          color="error"
          prepend-icon="ri:logout-circle-r-line"
          variant="text"
          @click="() => handleLogout()"
        >
          {{ $t('logout') }}
        </v-btn>
      </div>
    </v-card>
  </v-menu>
</template>

<style scoped>
  .border-b {
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  }

  .border {
    border: 2px solid transparent;
  }

  .border-primary {
    border-color: #1976d2 !important;
  }
</style>
