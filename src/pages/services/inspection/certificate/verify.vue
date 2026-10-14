<script setup lang="ts">
  import type { ApiDataResponse } from '@/modules/inspection/auth/types/auth.types'
  import { http } from '@/services/http'
  import axios from 'axios'
  import { computed, onMounted, ref } from 'vue'
  import { useRoute } from 'vue-router'

  definePage({ meta: { layout: 'auth' } })

  type Verification = {
    certificateNumber: string
    inspectionDate: string
    expiryDate: string
    issuedAt: string
    isValid: boolean
  }

  const route = useRoute()
  const certificate = ref<Verification | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(true)
  const certificateNumber = computed(() => String(route.query.number ?? '').trim())

  onMounted(async () => {
    if (!certificateNumber.value) {
      error.value = 'រកមិនឃើញលេខវិញ្ញាបនបត្រ'
      loading.value = false
      return
    }

    try {
      certificate.value = (await http.get<ApiDataResponse<Verification>>(
        `/certificates/verify/${encodeURIComponent(certificateNumber.value)}`,
      )).data.data
    } catch (requestError) {
      error.value = axios.isAxiosError(requestError) && requestError.response?.status === 404
        ? 'វិញ្ញាបនបត្រនេះមិនអាចផ្ទៀងផ្ទាត់បានទេ'
        : 'មិនអាចផ្ទៀងផ្ទាត់វិញ្ញាបនបត្របានទេ សូមព្យាយាមម្តងទៀត។'
    } finally {
      loading.value = false
    }
  })

  function displayDate (value: string) {
    return /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value.split('-').reverse().join('/') : value
  }
</script>

<template>
  <main class="verification-page">
    <section class="verification-card" aria-live="polite">
      <p class="eyebrow">ក្រសួងសាធារណការ និងដឹកជញ្ជូន</p>
      <h1>ផ្ទៀងផ្ទាត់វិញ្ញាបនបត្រ</h1>
      <p class="subtitle">Technical Inspection Certificate Verification</p>

      <p v-if="loading" class="message">កំពុងផ្ទៀងផ្ទាត់…</p>
      <p v-else-if="error" class="message error">{{ error }}</p>
      <template v-else-if="certificate">
        <div class="status" :class="certificate.isValid ? 'valid' : 'expired'">
          {{ certificate.isValid ? 'វិញ្ញាបនបត្រមានសុពលភាព' : 'វិញ្ញាបនបត្រផុតសុពលភាព' }}
        </div>
        <dl>
          <div><dt>លេខវិញ្ញាបនបត្រ</dt><dd>{{ certificate.certificateNumber }}</dd></div>
          <div><dt>កាលបរិច្ឆេទត្រួតពិនិត្យ</dt><dd>{{ displayDate(certificate.inspectionDate) }}</dd></div>
          <div><dt>កាលបរិច្ឆេទផុតកំណត់</dt><dd>{{ displayDate(certificate.expiryDate) }}</dd></div>
        </dl>
      </template>
    </section>
  </main>
</template>

<style scoped>
  .verification-page { align-items: center; background: #f8f8fc; display: flex; justify-content: center; min-height: 100vh; padding: 96px 20px 40px; }
  .verification-card { background: #fff; border: 1px solid #dfe3ef; border-radius: 12px; box-shadow: 0 12px 32px rgb(29 43 86 / 8%); max-width: 520px; padding: 36px; width: 100%; }
  .eyebrow { color: #2a3472; font-size: 14px; margin: 0 0 8px; }
  h1 { color: #17235a; font-family: Moul, Siemreap, sans-serif; font-size: 23px; font-weight: 400; line-height: 1.45; margin: 0; }
  .subtitle { color: #596176; font-size: 14px; margin: 4px 0 26px; }
  .message { color: #2a3472; margin: 20px 0 0; }.error { color: #b42318; }
  .status { border-radius: 8px; font-size: 17px; margin-bottom: 22px; padding: 12px 14px; }.valid { background: #ecf8f0; color: #16713d; }.expired { background: #fff0ef; color: #b42318; }
  dl { margin: 0; } dl div { border-top: 1px solid #e5e7ee; display: flex; gap: 20px; justify-content: space-between; padding: 13px 0; } dt { color: #667085; } dd { color: #17235a; font-weight: 500; margin: 0; text-align: right; }
  @media (max-width: 600px) { .verification-card { padding: 26px 20px; } dl div { align-items: flex-start; flex-direction: column; gap: 4px; } dd { text-align: left; } }
</style>
