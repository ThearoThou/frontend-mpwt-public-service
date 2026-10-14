<script setup lang="ts">
  import type { ApplicationDocument, ApplicationDocumentType } from '../../applications/types/application.types'

  const props = defineProps<{
    document: ApplicationDocument | undefined
    documentType: ApplicationDocumentType
    errorMessage: string
    title: string
    uploading: boolean
    previewUrl: string | null
  }>()

  const emit = defineEmits<{
    'file-selected': [file: File]
  }>()

  const inputId = computed(() => `renewal-document-${props.documentType.toLowerCase()}`)
  const documentTypeIcon = computed(() => ({
    VEHICLE_REGISTRATION_CARD: 'mdi-card-account-details-outline',
    PREVIOUS_INSPECTION_CERTIFICATE: 'mdi-clipboard-check-outline',
    CITIZEN_ID_CARD: 'mdi-card-account-details-outline',
  })[props.documentType])
  const fileInput = ref<HTMLInputElement | null>(null)
  const isDragging = ref(false)
  const previewDialogVisible = ref(false)

  function chooseFile () {
    if (!props.uploading) fileInput.value?.click()
  }

  function selectedFile (event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]

    if (file) emit('file-selected', file)
    input.value = ''
  }

  function dragOver (event: DragEvent) {
    event.preventDefault()
    if (!props.uploading) isDragging.value = true
  }

  function dragLeave () {
    isDragging.value = false
  }

  function dropFile (event: DragEvent) {
    event.preventDefault()
    isDragging.value = false
    if (props.uploading) return

    const file = event.dataTransfer?.files[0]
    if (file) emit('file-selected', file)
  }
</script>

<template>
  <!-- eslint-disable vue/padding-line-between-tags -->
  <article class="document-upload-card">
    <div class="d-flex align-center ga-3 mb-3">
      <v-avatar
        class="document-upload-card__type-avatar"
        color="primary"
        size="42"
        variant="tonal"
      >
        <span v-if="documentType === 'VEHICLE_REGISTRATION_CARD'" class="document-upload-card__vehicle-id-icons">
          <v-icon icon="mdi-card-account-details-outline" size="24" />
          <v-icon class="document-upload-card__vehicle-id-car" icon="mdi-car-side" size="15" />
        </span>
        <span v-else-if="documentType === 'PREVIOUS_INSPECTION_CERTIFICATE'" class="document-upload-card__certificate-icon">
          <v-icon icon="mdi-card-text-outline" size="24" />
          <v-icon class="document-upload-card__certificate-check" icon="mdi-check-circle" size="13" />
        </span>
        <v-icon v-else :icon="documentTypeIcon" size="24" />
      </v-avatar>
      <h3 class="document-upload-card__title text-subtitle-1 font-weight-regular">{{ title }}</h3>
    </div>

    <v-alert v-if="errorMessage" class="mb-3" density="compact" type="error">
      {{ errorMessage }}
    </v-alert>

    <div
      v-if="document"
      class="document-upload-card__current-file"
      :class="{ 'is-dragging': isDragging }"
      @dragenter.prevent="dragOver"
      @dragleave="dragLeave"
      @dragover="dragOver"
      @drop="dropFile"
    >
      <button
        v-if="previewUrl"
        :aria-label="$t('inspection_document_view_image')"
        class="document-upload-card__preview-button"
        type="button"
        @click.stop="previewDialogVisible = true"
      >
        <img :alt="document.originalFileName" :src="previewUrl">
      </button>
      <v-icon v-else color="primary" icon="mdi-file-check-outline" size="30" />

      <div class="flex-grow-1 min-width-0">
        <p class="document-upload-card__filename text-body-2 font-weight-regular text-medium-emphasis text-truncate mb-1">{{ document.originalFileName }}</p>
      </div>

      <v-btn
        v-if="previewUrl"
        :aria-label="$t('inspection_document_view_image')"
        icon="mdi-eye-outline"
        size="small"
        :title="$t('inspection_document_view_image')"
        variant="text"
        @click="previewDialogVisible = true"
      />

      <v-btn
        class="document-upload-card__replace"
        color="primary"
        :disabled="uploading"
        :loading="uploading"
        @click="chooseFile"
      >
        {{ $t(document.mimeType.startsWith('image/')
          ? 'inspection_application_correction_change_image'
          : 'inspection_document_replace') }}
      </v-btn>

      <v-dialog v-model="previewDialogVisible" max-width="900">
        <v-card>
          <div class="d-flex align-center justify-space-between pa-3">
            <p class="text-body-1 font-weight-medium text-truncate mb-0">{{ document.originalFileName }}</p>
            <v-btn :aria-label="$t('inspection_document_close_preview')" icon="mdi-close" variant="text" @click="previewDialogVisible = false" />
          </div>
          <v-img :alt="document.originalFileName" class="document-upload-card__preview-image" max-height="75vh" :src="previewUrl || undefined" />
        </v-card>
      </v-dialog>
    </div>

    <div
      v-else
      class="document-upload-card__dropzone"
      :class="{ 'is-dragging': isDragging, 'is-uploading': uploading }"
      role="button"
      tabindex="0"
      @click="chooseFile"
      @dragenter.prevent="dragOver"
      @dragleave="dragLeave"
      @dragover="dragOver"
      @drop="dropFile"
      @keydown.enter="chooseFile"
      @keydown.space.prevent="chooseFile"
    >
      <v-icon color="primary" icon="mdi-cloud-upload-outline" size="34" />
      <p class="document-upload-card__prompt text-body-2 font-weight-medium mt-2 mb-1">{{ $t('inspection_documents_choose_file_prompt') }}</p>
      <p class="document-upload-card__requirements text-caption text-medium-emphasis text-center mb-3">{{ $t('inspection_document_file_requirements') }}</p>
      <v-btn
        color="primary"
        :disabled="uploading"
        :loading="uploading"
        size="small"
        @click.stop="chooseFile"
      >
        {{ $t('inspection_documents_choose_file') }}
      </v-btn>
    </div>

    <input
      :id="inputId"
      ref="fileInput"
      accept=".pdf,.jpg,.jpeg,.png"
      class="d-none"
      :disabled="uploading"
      type="file"
      @change="selectedFile"
    >
  </article>
</template>

<style scoped>
  .document-upload-card {
    border: 0;
    border-radius: 0;
    padding: 18px;
  }

  .document-upload-card__title { font-size: .95rem !important; }
  .document-upload-card__type-avatar { background: #e7e9f1 !important; color: #172d73 !important; }
  .document-upload-card__type-avatar :deep(.v-avatar__underlay) { opacity: 0 !important; }
  .document-upload-card__vehicle-id-icons { display: inline-flex; position: relative; }
  .document-upload-card__vehicle-id-car { background: #e7e9f1; border-radius: 4px; bottom: -5px; position: absolute; right: -6px; }
  .document-upload-card__certificate-icon { display: inline-flex; position: relative; }
  .document-upload-card__certificate-check { background: #e7e9f1; border-radius: 50%; bottom: -2px; position: absolute; right: -4px; }
  .document-upload-card__prompt { font-size: .94rem; }
  .document-upload-card__requirements { font-size: .9rem; }
  .document-upload-card__replace { font-size: .8rem; }
  .document-upload-card__filename { font-size: .85rem !important; }

  .document-upload-card__current-file {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 0;
    display: flex;
    gap: 12px;
    padding: 14px;
  }

  .document-upload-card__preview-button {
    align-items: center;
    background: #eef1f7;
    border: 0;
    border-radius: 8px;
    cursor: zoom-in;
    display: flex;
    flex: 0 0 56px;
    height: 56px;
    justify-content: center;
    overflow: hidden;
    padding: 0;
    width: 56px;
  }

  .document-upload-card__preview-button img {
    height: 100%;
    object-fit: cover;
    width: 100%;
  }

  .document-upload-card__preview-image {
    background: #171923;
  }

  .document-upload-card__current-file.is-dragging,
  .document-upload-card__dropzone.is-dragging {
    background: #edf1ff;
    border-color: rgb(var(--v-theme-primary));
  }

  .document-upload-card__dropzone {
    align-items: center;
    background: #fafbff;
    border: 2px dashed #afb6dc;
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 176px;
    padding: 20px;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }

  .document-upload-card__dropzone:hover {
    background: #f3f5ff;
    border-color: rgb(var(--v-theme-primary));
  }

  .document-upload-card__dropzone.is-uploading {
    cursor: default;
  }

  @media (max-width: 599px) {
    .document-upload-card__current-file {
      align-items: flex-start;
      flex-wrap: wrap;
    }
  }
</style>
