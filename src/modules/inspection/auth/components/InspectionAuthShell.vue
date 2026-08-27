<script setup lang="ts">
  import logo from '@/assets/mpwt-logo-sm.svg'
  defineProps<{ title: string, description?: string, icon?: string, compact?: boolean, dense?: boolean }>()
</script>

<template>
  <!-- eslint-disable vue/padding-line-between-tags -->
  <main class="auth-shell d-flex flex-column align-center pa-4 pa-md-8" :class="{ 'auth-shell--dense': dense }">
    <LanguageSwitcher class="auth-language-switcher" variant="dark" />
    <header class="auth-brand text-center mb-7 mb-md-10">
      <img alt="MPWT" class="auth-logo mb-3" :src="logo">
      <p class="text-h5 text-md-h4 font-weight-bold mb-1">ក្រសួងសាធារណការ និងដឹកជញ្ជូន</p>
      <p class="text-subtitle-1 font-weight-bold letter-spacing">MINISTRY OF PUBLIC WORKS AND TRANSPORT</p>
    </header>
    <v-card class="auth-card w-100 pa-6 pa-sm-9" :class="{ 'auth-card--compact': compact, 'auth-card--dense': dense }" elevation="0" rounded="xl">
      <div v-if="icon" class="auth-icon mx-auto mb-5 d-flex align-center justify-center"><v-icon :icon="icon" size="34" /></div>
      <h1 class="auth-card-title font-weight-bold text-center mb-3">{{ title }}</h1>
      <p v-if="description" class="text-body-1 text-medium-emphasis text-center mb-7">{{ description }}</p>
      <slot />
    </v-card>
  </main>
</template>

<style scoped>
  .auth-shell { min-height: 100vh; position: relative; background: radial-gradient(circle at 50% 28%, #43569a 0%, #26346d 37%, #19245a 100%); color: #071a4f; }
  .auth-language-switcher { position: absolute; right: 32px; top: 24px; }
  .auth-brand { color: #06184b; }
  .auth-logo { width: 78px; height: 78px; }
  .letter-spacing { letter-spacing: .08em; }
  .auth-card { max-width: 640px; background: #fbf9fd; }
  .auth-card--compact { max-width: 560px; }
  .auth-shell--dense { padding-top: 2 rem !important; padding-bottom: 1.5rem !important; }
  .auth-shell--dense .auth-brand { margin-bottom: 2rem !important; }
  .auth-card--dense { padding-top: 1.5rem !important; padding-bottom: 1.5rem !important; }
  .auth-card-title { font-size: 1.55rem; line-height: 1.35; }
  .auth-icon { width: 76px; height: 76px; border-radius: 50%; background: #061a4c; color: white; }
  @media (max-width: 600px) { .auth-language-switcher { right: 16px; top: 14px; } .auth-brand { margin-bottom: 2rem !important; } .auth-brand .text-h5 { font-size: 1.2rem !important; } .auth-brand .text-subtitle-1 { font-size: .7rem !important; } .auth-card { padding: 1.5rem !important; } .auth-card-title { font-size: 1.35rem; } }
</style>
