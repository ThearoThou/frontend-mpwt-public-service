<script setup lang="ts">
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n()
</script>

<template>
  <section class="inspection-notifications-view">
    <header class="inspection-notifications-heading">
      <h1>{{ t('inspection_notifications') }}</h1>
      <p>{{ t('inspection_notifications_description') }}</p>
    </header>

    <v-card class="inspection-notifications-empty mt-6" elevation="0">
      <v-icon color="primary" icon="mdi-bell-outline" size="56" />
      <h2>{{ t('inspection_notifications_empty_title') }}</h2>
      <p>{{ t('inspection_notifications_empty_description') }}</p>
    </v-card>
  </section>
</template>

<style scoped>
  .inspection-notifications-view :deep(*) { font-weight: 400 !important; }
  .inspection-notifications-view { padding-bottom: 24px; }
  .inspection-notifications-heading h1 { color: #10172d; font-size: clamp(1.45rem, 2.25vw, 1.9rem); font-weight: 800; line-height: 1.2; }
  .inspection-notifications-heading p { color: #656776; font-size: .91rem; margin-top: 5px; }
  .inspection-notifications-empty { align-items: center; border: 1px solid #d4d5de; border-radius: 16px; box-shadow: 0 6px 16px rgba(31, 36, 69, .05); display: flex; flex-direction: column; justify-content: center; min-height: 280px; padding: 30px; text-align: center; }
  .inspection-notifications-empty h2 { color: #20212a; font-size: 1.1rem; font-weight: 800; margin-top: 14px; }
  .inspection-notifications-empty p { color: #656776; font-size: .9rem; margin-top: 5px; max-width: 520px; }
</style>
