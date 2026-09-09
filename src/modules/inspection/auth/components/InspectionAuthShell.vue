<script setup lang="ts">
  import logo from '@/assets/mpwt-logo-sm.svg'
  defineProps<{ title: string, description?: string, icon?: string, compact?: boolean, dense?: boolean, singleLineDescription?: boolean }>()
</script>

<template>
  <!-- eslint-disable vue/padding-line-between-tags -->
  <main class="auth-shell d-flex flex-column align-center pa-4 pa-md-8" :class="{ 'auth-shell--dense': dense }">
    <header class="auth-brand text-center mb-7 mb-md-10">
      <img alt="MPWT" class="auth-logo mb-3" :src="logo">
      <p class="auth-ministry-title mb-1" lang="km">ក្រសួងសាធារណការ និងដឹកជញ្ជូន</p>
      <p class="auth-ministry-subtitle" lang="en">MINISTRY OF PUBLIC WORKS AND TRANSPORT</p>
    </header>
    <v-card class="auth-card w-100 pa-6 pa-sm-8" :class="{ 'auth-card--compact': compact, 'auth-card--dense': dense }" elevation="0" rounded="xl">
      <div v-if="icon" class="auth-icon mx-auto mb-5 d-flex align-center justify-center"><v-icon :icon="icon" size="34" /></div>
      <h1 class="auth-card-title text-center mb-3">{{ title }}</h1>
      <p v-if="description" class="auth-card-description text-medium-emphasis text-center mb-7" :class="{ 'auth-card-description--single-line': singleLineDescription }">{{ description }}</p>
      <slot />
    </v-card>
  </main>
</template>

<style scoped>
  .auth-shell { min-height: 100vh; position: relative; background: radial-gradient(circle at 50% 28%, #43569a 0%, #26346d 37%, #19245a 100%); color: #071a4f; }
  .auth-brand { color: #06184b; max-width: 100%; }
  .auth-logo { width: 78px; height: 78px; }
  .auth-ministry-title { font-family: 'Moul', 'Siemreap', sans-serif !important; font-size: clamp(22px, 3vw, 30px); font-weight: 400 !important; font-synthesis: none; letter-spacing: normal; line-height: 1.8; }
  .auth-ministry-subtitle { font-family: 'Siemreap', sans-serif !important; font-size: .95rem; font-weight: 400; letter-spacing: .025em; line-height: 1.6; color: inherit; }
  .auth-card { max-width: 640px; background: #fbf9fd; }
  .auth-card--compact { max-width: 560px; }
  .auth-shell--dense { padding-top: 2rem !important; padding-bottom: 1.5rem !important; }
  .auth-shell--dense .auth-brand { margin-bottom: 2rem !important; }
  .auth-card--dense { padding-top: 1.5rem !important; padding-bottom: 1.5rem !important; }
  .auth-card-title { font-size: 1.35rem; line-height: 1.35; }
  .auth-card-description { font-size: .95rem; white-space: normal; overflow-wrap: anywhere; }
  .auth-card :deep(.v-field__input) { font-size: .95rem; }
  .auth-card :deep(.v-label) { font-size: .9rem; }
  .auth-card :deep(.v-label.v-field-label--floating) { font-size: .75rem; }
  .auth-card :deep(.v-btn--size-large) { font-size: .85rem; }
  .auth-card :deep(.auth-account-prompt) { font-size: .9rem; }
  .auth-card :deep(.v-alert) { font-size: .9rem; }
  .auth-card :deep(.v-btn--variant-text.text-primary) { color: #102565 !important; }
  .auth-card :deep(a) { color: #4b146f; }
  @media (min-width: 600px) { .auth-card-description--single-line { white-space: nowrap; } }
  .auth-icon { width: 76px; height: 76px; border-radius: 50%; background: #061a4c; color: white; }
  @media (max-width: 600px) { .auth-brand { margin-bottom: 2rem !important; } .auth-logo { margin-top: 32px; } .auth-card { padding: 1.5rem !important; } }
</style>
