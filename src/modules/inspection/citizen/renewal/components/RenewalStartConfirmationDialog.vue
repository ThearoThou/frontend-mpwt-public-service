<script setup lang="ts">
  import { useI18n } from 'vue-i18n'

  defineProps<{ loading: boolean }>()
  const open = defineModel<boolean>({ required: true })
  const emit = defineEmits<{ confirm: [] }>()
  const { t } = useI18n()

  function close () {
    if (!open.value) return
    open.value = false
  }
</script>

<template>
  <v-dialog v-model="open" max-width="380">
    <v-card class="renewal-confirmation" rounded="lg">
      <header class="renewal-confirmation__header">
        <h2 class="renewal-confirmation__title">{{ t('inspection_renewal_confirm_title') }}</h2>

        <v-btn
          :aria-label="t('cancel')"
          class="renewal-confirmation__close"
          :disabled="loading"
          icon="mdi-close"
          size="small"
          variant="text"
          @click="close"
        />
      </header>

      <p class="renewal-confirmation__message">{{ t('inspection_renewal_confirm_message') }}</p>

      <div class="renewal-confirmation__actions">
        <v-btn class="renewal-confirmation__no" :disabled="loading" variant="text" @click="close">{{ t('inspection_renewal_confirm_no') }}</v-btn>
        <v-btn color="primary" :loading="loading" @click="emit('confirm')">{{ t('inspection_renewal_confirm_yes') }}</v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
  .renewal-confirmation { overflow: hidden; }
  .renewal-confirmation__header { align-items: center; border-bottom: 1px solid #e2e4ea; display: grid; grid-template-columns: 36px 1fr 36px; min-height: 58px; padding-inline: 10px; }
  .renewal-confirmation__title { font-size: 1.24rem; font-weight: 800; grid-column: 2; line-height: 1.55; margin: 0; text-align: center; }
  .renewal-confirmation__close { grid-column: 3; grid-row: 1; justify-self: end; }
  .renewal-confirmation__close:hover { background: #f0f1f4; }
  .renewal-confirmation__close:focus-visible { outline: 2px solid #253b82; outline-offset: 2px; }
  .renewal-confirmation__message { font-size: 1.05rem; line-height: 1.7; margin: 0; padding: 14px 24px 16px; text-align: center; white-space: pre-line; }
  .renewal-confirmation__actions { align-items: center; display: flex; gap: 16px; justify-content: space-between; padding: 4px 22px 16px; }
  .renewal-confirmation__actions :deep(.v-btn) { font-size: .85rem; min-height: 34px; min-width: 74px; padding-inline: 14px; }
  .renewal-confirmation__no { background: #9f9f9f !important; color: #fff !important; }
  .renewal-confirmation__no:hover { background: #888 !important; }
</style>
