<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { useInspectionAuthStore } from '../../auth/stores/auth.store'
  import { getEnglishNameIssue, getInspectionAuthError, getKhmerNameIssue } from '../../auth/utils/auth.utils'

  const { t } = useI18n()
  const authStore = useInspectionAuthStore()
  const form = reactive({ nameKh: '', nameEn: '' })
  const saving = ref(false)
  const errorMessage = ref('')
  const saved = ref(false)

  watch(() => authStore.currentUser?.citizenProfile, profile => {
    form.nameKh = profile?.nameKh ?? ''
    form.nameEn = profile?.nameEn ?? ''
  }, { immediate: true })

  function validationIssues () {
    return [getKhmerNameIssue(form.nameKh), getEnglishNameIssue(form.nameEn)]
      .filter((issue): issue is string => issue !== undefined)
  }

  async function saveProfile () {
    if (saving.value) return
    const issues = validationIssues()
    if (issues.length > 0) {
      errorMessage.value = t('inspection_validation_error', { fields: issues.map(issue => t(issue)).join(', ') })
      saved.value = false
      return
    }

    saving.value = true
    errorMessage.value = ''
    saved.value = false
    try {
      await authStore.updateCitizenProfile({ nameKh: form.nameKh, nameEn: form.nameEn || null })
      saved.value = true
    } catch (error) {
      errorMessage.value = t(getInspectionAuthError(error, 'inspection_profile_save_error'))
    } finally {
      saving.value = false
    }
  }
</script>

<template>
  <section class="inspection-profile-view">
    <header>
      <h1>{{ $t('inspection_profile_settings') }}</h1>
      <p>{{ $t('inspection_profile_description') }}</p>
    </header>

    <v-card class="inspection-profile-card mt-6" elevation="0">
      <v-alert v-if="errorMessage" class="mb-5" density="comfortable" type="error">{{ errorMessage }}</v-alert>
      <v-alert v-if="saved" class="mb-5" density="comfortable" type="success">{{ $t('inspection_profile_saved') }}</v-alert>

      <v-form @submit.prevent="saveProfile">
        <v-text-field
          v-model.trim="form.nameKh"
          class="inspection-required-field"
          maxlength="150"
          prepend-inner-icon="mdi-account-outline"
          required
          variant="outlined"
        >
          <template #label>{{ $t('inspection_name_kh') }} <span class="inspection-required-mark">*</span></template>
        </v-text-field>

        <v-text-field
          v-model.trim="form.nameEn"
          maxlength="150"
          prepend-inner-icon="mdi-account-outline"
          variant="outlined"
        >
          <template #label>{{ $t('inspection_name_en_optional') }}</template>
        </v-text-field>

        <v-btn color="primary" :loading="saving" prepend-icon="mdi-content-save-outline" type="submit">{{ $t('inspection_profile_save') }}</v-btn>
      </v-form>
    </v-card>
  </section>
</template>

<style scoped>
  .inspection-profile-view { max-width: 640px; padding-bottom: 24px; }
  .inspection-profile-view h1 { color: #10172d; font-size: clamp(1.45rem, 2.25vw, 1.9rem); font-weight: 800; line-height: 1.2; }
  .inspection-profile-view header p { color: #656776; font-size: .91rem; margin-top: 5px; }
  .inspection-profile-card { border: 1px solid #d4d5de; border-radius: 16px; box-shadow: 0 6px 16px rgba(31, 36, 69, .05); padding: 22px; }
  .inspection-profile-card :deep(.v-text-field + .v-text-field) { margin-top: 8px; }
  .inspection-required-mark { color: #d32f2f; font-size: 1em; font-weight: 500; line-height: 0; }
</style>
