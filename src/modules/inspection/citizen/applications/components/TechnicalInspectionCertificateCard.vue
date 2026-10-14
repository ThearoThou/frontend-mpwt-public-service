<script setup lang="ts">
  import type { TechnicalInspectionCertificateStatus } from '../types/application.types'
  import { useI18n } from 'vue-i18n'
  import { formatDisplayDate } from '@/modules/inspection/shared/utils/display-date'
  import { inspectionApplicationService } from '../services/application.service'

  const props = defineProps<{
    applicationId: string
    certificate: TechnicalInspectionCertificateStatus
  }>()
  const { locale } = useI18n()

  const downloading = ref(false)
  const downloadFailed = ref(false)

  const canDownload = computed(() => props.certificate.issued && props.certificate.downloadAvailable)

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
</script>

<template>
  <!-- eslint-disable vue/max-attributes-per-line -->
  <section aria-labelledby="technical-certificate-title" class="technical-certificate">
    <div class="technical-certificate__heading">
      <div aria-hidden="true" class="technical-certificate__icon"><v-icon icon="mdi-certificate-outline" size="26" /></div>

      <div class="min-width-0">
        <h2 id="technical-certificate-title">{{ $t('inspection_certificate_title') }}</h2>
      </div>

    </div>

    <dl class="technical-certificate__metadata">
      <div><dt>{{ $t('inspection_certificate_number') }}</dt><dd class="technical-certificate__number">{{ certificate.certificateNumber ?? '—' }}</dd></div>
      <div><dt>{{ $t('inspection_certificate_inspection_date') }}</dt><dd>{{ formatDisplayDate(certificate.inspectionDate) }}</dd></div>
      <div><dt>{{ $t('inspection_certificate_expiry_date') }}</dt><dd>{{ formatDisplayDate(certificate.expiryDate) }}</dd></div>
    </dl>

    <v-alert v-if="!certificate.downloadAvailable" class="mt-5" density="compact" type="info" variant="tonal">{{ $t('inspection_certificate_unavailable') }}</v-alert>
    <v-alert v-if="downloadFailed" aria-live="polite" class="mt-5" density="compact" type="error" variant="tonal">{{ $t('inspection_certificate_download_error') }}</v-alert>

    <div class="technical-certificate__actions">
      <v-btn color="primary" :disabled="!certificate.downloadAvailable || downloading" :loading="downloading" prepend-icon="mdi-download-outline" @click="downloadCertificate">
        {{ downloading ? $t('inspection_certificate_downloading') : $t('inspection_certificate_download') }}
      </v-btn>
    </div>
  </section>
</template>

<style scoped>
  .technical-certificate { background: #fff; border: 1px solid #dfe2e9; border-radius: 14px; margin-top: 22px; min-width: 0; padding: 22px; }
  .technical-certificate__heading { align-items: center; display: grid; gap: 14px; grid-template-columns: auto minmax(0, 1fr); }
  .technical-certificate__heading h2 { align-items: center; color: #102652; display: flex; font-size: .95rem; font-weight: 800; gap: 9px; line-height: 1.4; overflow-wrap: anywhere; }
  .technical-certificate__heading h2::before { background: linear-gradient(#334b91, #7891dd); border-radius: 999px; content: ''; flex: 0 0 4px; height: 20px; width: 4px; }
  .technical-certificate__icon { align-items: center; background: #eef0fb; border-radius: 11px; color: #33447f; display: flex; height: 46px; justify-content: center; width: 46px; }
  .technical-certificate__step { color: #686e7d; font-size: .76rem; letter-spacing: .04em; margin: 0 0 2px; text-transform: uppercase; }
  .technical-certificate__metadata { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 22px 0 0; }
  .technical-certificate__metadata > div { background: #f7f8fb; border-radius: 11px; min-width: 0; padding: 14px 16px; }
  .technical-certificate__metadata dt { color: #686e7d; font-size: .8rem; }
  .technical-certificate__metadata dd { font-weight: 700; margin: 4px 0 0; overflow-wrap: anywhere; }
  .technical-certificate__number { color: #27366f; }
  .technical-certificate__actions { display: flex; justify-content: flex-end; margin-top: 20px; }
  @media (max-width: 599px) {
    .technical-certificate { padding: 18px; }
    .technical-certificate__heading { align-items: start; grid-template-columns: auto minmax(0, 1fr); }
    .technical-certificate__metadata { grid-template-columns: 1fr; }
    .technical-certificate__actions :deep(.v-btn) { min-height: 44px; width: 100%; }
  }
</style>
