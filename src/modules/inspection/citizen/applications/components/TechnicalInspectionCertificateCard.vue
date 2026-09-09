<script setup lang="ts">
  import type { TechnicalInspectionCertificateStatus } from '../types/application.types'
  import { useI18n } from 'vue-i18n'
  import { inspectionApplicationService } from '../services/application.service'

  const props = defineProps<{ applicationId: string }>()
  const { locale } = useI18n()

  const certificate = ref<TechnicalInspectionCertificateStatus | null>(null)
  const loading = ref(true)
  const loadFailed = ref(false)
  const downloading = ref(false)
  const downloadFailed = ref(false)
  let loadSequence = 0

  const canDownload = computed(() => certificate.value?.issued === true && certificate.value.downloadAvailable)

  function displayCalendarDate (value: string | null): string {
    if (!value) return '—'
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return value
    const date = new Date(`${value}T00:00:00+07:00`)
    if (Number.isNaN(date.valueOf())) return value
    return new Intl.DateTimeFormat(locale.value === 'kh' ? 'km-KH' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Phnom_Penh',
    }).format(date)
  }

  function displayIssuedAt (value: string | null): string {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.valueOf())) return value
    return new Intl.DateTimeFormat(locale.value === 'kh' ? 'km-KH' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Phnom_Penh',
    }).format(date)
  }

  async function loadCertificate () {
    const sequence = ++loadSequence
    loading.value = true
    loadFailed.value = false
    downloadFailed.value = false
    try {
      const result = await inspectionApplicationService.getApplicationCertificate(props.applicationId)
      if (sequence === loadSequence) certificate.value = result
    } catch {
      if (sequence === loadSequence) loadFailed.value = true
    } finally {
      if (sequence === loadSequence) loading.value = false
    }
  }

  async function downloadCertificate () {
    if (!canDownload.value || downloading.value) return
    downloading.value = true
    downloadFailed.value = false
    try {
      const result = await inspectionApplicationService.downloadApplicationCertificate(props.applicationId)
      const url = URL.createObjectURL(result.blob)
      try {
        const link = document.createElement('a')
        link.href = url
        link.download = result.filename
        document.body.append(link)
        link.click()
        link.remove()
      } finally {
        URL.revokeObjectURL(url)
      }
    } catch {
      downloadFailed.value = true
    } finally {
      downloading.value = false
    }
  }

  watch(() => props.applicationId, () => void loadCertificate())
  onMounted(() => void loadCertificate())
  onBeforeUnmount(() => {
    loadSequence += 1
  })
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line -->
  <section aria-labelledby="technical-certificate-title" class="technical-certificate">
    <div class="technical-certificate__heading">
      <div aria-hidden="true" class="technical-certificate__icon"><v-icon icon="mdi-certificate-outline" size="26" /></div>

      <div class="min-width-0">
        <p class="technical-certificate__step">{{ $t('inspection_certificate_step') }}</p>
        <h2 id="technical-certificate-title">{{ $t('inspection_certificate_title') }}</h2>
      </div>

      <v-chip v-if="certificate?.issued" color="success" prepend-icon="mdi-check-circle-outline" size="small" variant="tonal">{{ $t('inspection_certificate_issued') }}</v-chip>
      <v-chip v-else-if="!loading && !loadFailed" color="info" prepend-icon="mdi-clock-outline" size="small" variant="tonal">{{ $t('inspection_certificate_pending') }}</v-chip>
    </div>

    <div v-if="loading" aria-live="polite" class="technical-certificate__loading" role="status">
      <v-skeleton-loader type="heading, paragraph, actions" />
      <span class="sr-only">{{ $t('loading') }}</span>
    </div>

    <v-alert v-else-if="loadFailed" class="mt-5" type="error" variant="tonal">
      <div class="technical-certificate__alert-content">
        <span>{{ $t('inspection_certificate_load_error') }}</span>
        <v-btn prepend-icon="mdi-refresh" variant="outlined" @click="loadCertificate">{{ $t('retry') }}</v-btn>
      </div>
    </v-alert>

    <template v-else-if="certificate?.issued">
      <dl class="technical-certificate__metadata">
        <div><dt>{{ $t('inspection_certificate_number') }}</dt><dd class="technical-certificate__number">{{ certificate.certificateNumber ?? '—' }}</dd></div>
        <div><dt>{{ $t('inspection_certificate_inspection_date') }}</dt><dd>{{ displayCalendarDate(certificate.inspectionDate) }}</dd></div>
        <div><dt>{{ $t('inspection_certificate_expiry_date') }}</dt><dd>{{ displayCalendarDate(certificate.expiryDate) }}</dd></div>
        <div><dt>{{ $t('inspection_certificate_issued_date') }}</dt><dd>{{ displayIssuedAt(certificate.issuedAt) }}</dd></div>
      </dl>

      <v-alert v-if="!certificate.downloadAvailable" class="mt-5" density="compact" type="info" variant="tonal">{{ $t('inspection_certificate_unavailable') }}</v-alert>
      <v-alert v-if="downloadFailed" aria-live="polite" class="mt-5" density="compact" type="error" variant="tonal">{{ $t('inspection_certificate_download_error') }}</v-alert>

      <div class="technical-certificate__actions">
        <v-btn color="primary" :disabled="!certificate.downloadAvailable || downloading" :loading="downloading" prepend-icon="mdi-download-outline" @click="downloadCertificate">
          {{ downloading ? $t('inspection_certificate_downloading') : $t('inspection_certificate_download') }}
        </v-btn>
      </div>
    </template>

    <div v-else class="technical-certificate__pending" role="status">
      <v-icon aria-hidden="true" color="info" icon="mdi-file-clock-outline" size="30" />
      <div><strong>{{ $t('inspection_certificate_pending') }}</strong><p>{{ $t('inspection_certificate_pending_description') }}</p></div>
    </div>
  </section>
</template>

<style scoped>
  .technical-certificate { background: #fff; border: 1px solid #dfe2e9; border-radius: 14px; margin-top: 22px; min-width: 0; padding: 22px; }
  .technical-certificate__heading { align-items: center; display: grid; gap: 14px; grid-template-columns: auto minmax(0, 1fr) auto; }
  .technical-certificate__heading h2 { font-size: 1.08rem; line-height: 1.4; overflow-wrap: anywhere; }
  .technical-certificate__icon { align-items: center; background: #eef0fb; border-radius: 11px; color: #33447f; display: flex; height: 46px; justify-content: center; width: 46px; }
  .technical-certificate__step { color: #686e7d; font-size: .76rem; letter-spacing: .04em; margin: 0 0 2px; text-transform: uppercase; }
  .technical-certificate__loading { margin-top: 16px; min-height: 130px; }
  .technical-certificate__metadata { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 22px 0 0; }
  .technical-certificate__metadata > div { background: #f7f8fb; border-radius: 11px; min-width: 0; padding: 14px 16px; }
  .technical-certificate__metadata dt { color: #686e7d; font-size: .8rem; }
  .technical-certificate__metadata dd { font-weight: 700; margin: 4px 0 0; overflow-wrap: anywhere; }
  .technical-certificate__number { color: #27366f; }
  .technical-certificate__pending { align-items: center; background: #f7f8fb; border-radius: 11px; display: flex; gap: 14px; margin-top: 20px; padding: 18px; }
  .technical-certificate__pending p { color: #686e7d; margin: 3px 0 0; }
  .technical-certificate__actions { display: flex; justify-content: flex-end; margin-top: 20px; }
  .technical-certificate__alert-content { align-items: center; display: flex; gap: 16px; justify-content: space-between; }
  .sr-only { height: 1px; margin: -1px; overflow: hidden; padding: 0; position: absolute; width: 1px; clip: rect(0, 0, 0, 0); white-space: nowrap; }
  @media (max-width: 599px) {
    .technical-certificate { padding: 18px; }
    .technical-certificate__heading { align-items: start; grid-template-columns: auto minmax(0, 1fr); }
    .technical-certificate__heading :deep(.v-chip) { grid-column: 1 / -1; justify-self: start; }
    .technical-certificate__metadata { grid-template-columns: 1fr; }
    .technical-certificate__pending, .technical-certificate__alert-content { align-items: stretch; flex-direction: column; }
    .technical-certificate__actions :deep(.v-btn), .technical-certificate__alert-content :deep(.v-btn) { min-height: 44px; width: 100%; }
  }
</style>
