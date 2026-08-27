<script lang="ts" setup>
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import logo from '@/assets/mpwt-logo-sm.svg'
  import NotificationButton from '@/components/button/NotificationButton.vue'
  import ThemeToggle from '@/components/button/ThemeToggle.vue'
  import { useAuthStore } from '@/stores/auth.ts'

  const emit = defineEmits(['theme-changed'])
  const router = useRouter()
  const { t } = useI18n()
  const authStore = useAuthStore()

  async function handleLogin () {
    await authStore.login()
  }

  const items = computed(() => [
    { title: t('home'), to: '/' },
    { title: t('app'), to: '/apps' },
    { title: t('service'), to: '/service' },
    { title: t('notify'), to: '/news' },
    { title: t('contact'), to: '/contact-us' },
  ])

  function onNavigate (item: { title: string, to?: string }) {
    if (item.to) {
      router.push(item.to)
    }
  }
</script>

<template>
  <nav class="glass-nav">
    <v-container max-width="1200">
      <header class="d-flex justify-space-between align-content-center">
        <div class="search-card d-sm-flex align-center">
          <v-text-field
            append-inner-icon="mdi-magnify"
            density="compact"
            hide-details
            :label="`${t('search')}...`"
            rounded="xl"
            single-line
            variant="outlined"
          />
        </div>

        <router-link class="text-decoration-none text--primary" to="/">
          <v-img
            aspect-ratio="1/1"
            class="logo"
            cover
            :src="logo"
            :width="70"
          />
        </router-link>
        <!-- Desktop controls -->
        <div class="d-none d-sm-flex align-center ga-2">
          <!-- Notification button -->
          <NotificationButton />
          <!-- Language Switcher -->
          <LanguageSwitcher />
          <!-- Theme toggle -->
          <ThemeToggle @theme-changed="val => emit('theme-changed', val)" />
          <AccountProfile v-if="authStore.isAuthenticated" />
        </div>
      </header>
    </v-container>
    <!--    <v-divider class="custom-divider" />-->
    <hr>

    <v-container width="1200">
      <!-- Mobile: collapse into menu -->
      <div class="d-sm-none d-flex align-center gap-1">
        <!-- Notification button for mobile -->
        <NotificationButton />
        <LanguageSwitcher />

        <!-- Mobile menu button -->
        <v-menu open-on-click>
          <template #activator="{ props }">
            <v-btn v-bind="props" aria-label="Open navigation" icon>
              <v-icon>mdi-menu</v-icon>
            </v-btn>
          </template>

          <v-list>
            <v-list-item
              v-for="(item, index) in items"
              :key="index"
              @click="onNavigate(item)"
            >
              <v-list-item-title>{{ item.title }}</v-list-item-title>
            </v-list-item>

            <v-divider />

            <!-- Mobile theme toggle -->
            <v-list-item>
              <v-list-item-title class="d-flex align-center">
                <ThemeToggle @theme-changed="val => emit('theme-changed', val)" />
                <span class="ml-2">Theme</span>
              </v-list-item-title>
            </v-list-item>

            <!-- Mobile Login Button if not authenticated -->
            <v-list-item v-if="!authStore.isAuthenticated" @click="handleLogin">
              <v-list-item-title class="d-flex align-center">
                <v-icon class="mr-2">mdi-login</v-icon>
                <span>{{ $t('login') }}</span>
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>

        <!-- Mobile Account Profile -->
        <AccountProfile v-if="authStore.isAuthenticated" />
      </div>
      <!-- Desktop navigation -->
      <div class="d-none d-sm-flex justify-space-between">
        <div>
          <v-btn
            v-for="(item, index) in items"
            :key="index"
            aria-label="Navigate to item.title"
            class="mx-2"
            :to="item.to"
            variant="text"
          >
            {{ item.title }}
          </v-btn>
        </div>

        <v-btn
          v-if="!authStore.isAuthenticated"
          append-icon="material-symbols:login"
          class="ml-2"
          variant="text"
          @click="handleLogin"
        >
          {{ $t('login') }}
        </v-btn>
      </div>
    </v-container>
  </nav>
</template>
<style scoped>
.glass-nav {
  //position: sticky;
  //top:0;
  //z-index:1500;
  //width:100%;
  //background: linear-gradient(135deg, rgba(18,18,28,0.85), rgba(48,12,18,0.78));
  //background: rgba(0, 0, 0, 0.10);
  backdrop-filter: blur(2px);
  //border-bottom:1px solid rgba(255,255,255,0.08);
  //box-shadow:020px 45px rgba(0,0,0,0.35);
}

.search-card {
  max-width: 300px;
  flex-grow: 1;
}
.custom-divider{
  //border: 0.35rem solid;
  border-image:
    linear-gradient(
      to right,
      #4f46e5,
      #3b82f6,
      #06b6d4,
      #14b8a6,
      #10b981
    )
    1;
}
</style>
