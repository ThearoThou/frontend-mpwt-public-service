<script setup lang="ts">
  import { useI18n } from 'vue-i18n'

  defineProps<{ loading: boolean }>()
  const open = defineModel<boolean>({ required: true })
  const emit = defineEmits<{ close: [], confirm: [] }>()
  const { t } = useI18n()

  function close () {
    emit('close')
  }
</script>

<template>
  <v-dialog max-width="380" :model-value="open" @update:model-value="value => { if (!value) close() }">
    <v-card class="cancel-confirmation" rounded="lg">
      <header class="cancel-confirmation__header">
        <h2 class="cancel-confirmation__title">{{ t('inspection_application_cancel_title') }}</h2>

        <v-btn
          :aria-label="t('cancel')"
          class="cancel-confirmation__close"
          :disabled="loading"
          icon="mdi-close"
          size="small"
          variant="text"
          @click="close"
        />
      </header>

      <div class="cancel-confirmation__content">
        <p class="cancel-confirmation__question">{{ t('inspection_application_cancel_question') }}</p>
      </div>

      <div class="cancel-confirmation__actions">
        <v-btn class="cancel-confirmation__keep" :disabled="loading" variant="text" @click="close">{{ t('inspection_application_keep') }}</v-btn>
        <v-btn color="error" :loading="loading" @click="emit('confirm')">{{ t('inspection_application_cancel') }}</v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
  .cancel-confirmation { overflow: hidden; }
  .cancel-confirmation__header { align-items: center; border-bottom: 1px solid #e2e4ea; display: grid; grid-template-columns: 36px 1fr 36px; min-height: 58px; padding-inline: 10px; }
  .cancel-confirmation__title { font-size: 1.24rem; font-weight: 800; grid-column: 2; line-height: 1.55; margin: 0; text-align: center; }
  .cancel-confirmation__close { grid-column: 3; grid-row: 1; justify-self: end; }
  .cancel-confirmation__close:hover { background: #f0f1f4; }
  .cancel-confirmation__close:focus-visible { outline: 2px solid #253b82; outline-offset: 2px; }
  .cancel-confirmation__content { padding: 18px 24px 16px; }
  .cancel-confirmation__question { font-size: 1rem; line-height: 1.6; margin: 0; text-align: center; }
  .cancel-confirmation__actions { align-items: center; display: flex; gap: 16px; justify-content: space-between; padding: 4px 22px 16px; }
  .cancel-confirmation__actions :deep(.v-btn) { font-size: .85rem; min-height: 34px; min-width: 74px; padding-inline: 14px; }
  .cancel-confirmation__keep { background: #9f9f9f !important; color: #fff !important; }
  .cancel-confirmation__keep:hover { background: #888 !important; }
</style>
