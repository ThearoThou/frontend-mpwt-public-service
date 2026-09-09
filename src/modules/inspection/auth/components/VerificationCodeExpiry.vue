<script setup lang="ts">
  const props = defineProps<{ expiresAt: number | null }>()
  const now = ref(Date.now())
  const remainingSeconds = computed(() => Math.max(0, Math.ceil(((props.expiresAt ?? now.value) - now.value) / 1000)))
  const hasActiveCountdown = computed(() => props.expiresAt !== null && remainingSeconds.value > 0)
  const countdown = computed(() => `${Math.floor(remainingSeconds.value / 60).toString().padStart(2, '0')}:${(remainingSeconds.value % 60).toString().padStart(2, '0')}`)
  let countdownTimer: ReturnType<typeof setInterval> | undefined

  function stopCountdown () {
    if (countdownTimer !== undefined) clearInterval(countdownTimer)
    countdownTimer = undefined
  }

  watch(() => props.expiresAt, () => {
    stopCountdown()
    now.value = Date.now()
    if (!hasActiveCountdown.value) return
    countdownTimer = setInterval(() => {
      now.value = Date.now()
      if (!hasActiveCountdown.value) stopCountdown()
    }, 1000)
  }, { immediate: true })

  onBeforeUnmount(stopCountdown)
</script>

<template>
  <p class="auth-code-expiry text-center text-medium-emphasis mb-5" role="status">
    <i18n-t v-if="hasActiveCountdown" keypath="inspection_reset_code_expires_in" tag="span">
      <template #time><span class="auth-code-expiry__timer">{{ countdown }}</span></template>
    </i18n-t>

    <template v-else>
      <span v-if="expiresAt !== null" class="auth-code-expiry__expired">{{ $t('inspection_reset_code_expired') }}</span>{{ expiresAt !== null ? ' ' : '' }}
      {{ $t('inspection_reset_code_request_new') }}
    </template>
  </p>
</template>

<style scoped>
  .auth-code-expiry { font-size: .9rem; line-height: 1.8; }
  .auth-code-expiry__timer { color: rgb(var(--v-theme-primary)); font-weight: 600 !important; }
  .auth-code-expiry__expired { color: rgba(var(--v-theme-error), .85); }
</style>
