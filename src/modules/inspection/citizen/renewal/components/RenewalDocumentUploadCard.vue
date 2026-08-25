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
      <v-avatar color="primary" size="34" variant="tonal">
        <v-icon icon="mdi-file-document-outline" size="20" />
      </v-avatar>
      <h3 class="text-subtitle-1 font-weight-bold">{{ title }}</h3>
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
        <p class="text-body-2 font-weight-medium text-truncate mb-1">{{ document.originalFileName }}</p>
        <p class="text-caption text-medium-emphasis mb-0">{{ document.mimeType }}</p>
      </div>

      <v-chip color="success" size="small" variant="tonal">
        {{ $t('inspection_document_uploaded') }}
      </v-chip>

      <v-btn
        color="primary"
        :disabled="uploading"
        :loading="uploading"
        size="small"
        variant="outlined"
        @click="chooseFile"
      >
        {{ $t('inspection_document_replace') }}
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
      <p class="text-body-2 font-weight-medium mt-2 mb-1">{{ $t('inspection_documents_choose_file_prompt') }}</p>
      <p class="text-caption text-medium-emphasis text-center mb-3">{{ $t('inspection_document_file_requirements') }}</p>
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
    border: 1px solid #e4e7ef;
    border-radius: 14px;
    padding: 18px;
  }

  .document-upload-card__current-file {
    align-items: center;
    background: #f8f9fc;
    border: 1px solid #e2e5ed;
    border-radius: 10px;
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
