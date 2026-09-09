<script setup lang="ts">
  import type { LatePenaltyVehicleClass } from '../utils/late-penalty-display'
  import { useI18n } from 'vue-i18n'
  import { latePenaltyDisplay } from '../utils/late-penalty-display'

  const props = defineProps<{
    lateDays: number
    lateFee: string
    currency: string
    vehicleClass: LatePenaltyVehicleClass | null
  }>()

  const { locale } = useI18n()
  const details = computed(() => latePenaltyDisplay(
    props.lateDays,
    props.lateFee,
    props.vehicleClass,
  ))
  const hasLatePenalty = computed(() => details.value !== null && details.value.lateDays > 30)

  function formatNumber (value: number): string {
    return value.toLocaleString(locale.value === 'kh' ? 'km-KH' : 'en-GB')
  }
</script>

<template>
  <section
    v-if="details"
    class="late-penalty-explanation"
    :class="{ 'late-penalty-explanation--penalty': hasLatePenalty }"
  >
    <div>
      <template v-if="hasLatePenalty">
        <p class="late-penalty-explanation__copy mb-0">
          {{ $t('inspection_late_penalty_day_31_copy') }}
        </p>

        <p class="late-penalty-explanation__rate mb-0">
          {{ $t(
            details.vehicleClass === 'HEAVY'
              ? 'inspection_late_penalty_heavy_rate'
              : 'inspection_late_penalty_light_rate',
            { rate: formatNumber(details.dailyRateKhr), currency },
          ) }}
        </p>
      </template>

      <p v-else class="late-penalty-explanation__copy mb-0">
        {{ $t('inspection_late_penalty_grace_copy') }}
      </p>
    </div>
  </section>
</template>

<style scoped>
  .late-penalty-explanation { align-items: flex-start; background: #f4f6fb; border: 1px solid #dbe1ee; border-radius: 10px; color: #4b5565; display: flex; gap: 10px; margin-left: auto; margin-top: 16px; max-width: 480px; padding: 12px 14px; text-align: left; width: 100%; }
  .late-penalty-explanation :deep(.v-icon) { color: #53617b; flex: 0 0 auto; margin-top: 2px; }
  .late-penalty-explanation--penalty { background: #fff1f2; border-color: #fecdd3; color: #b42318; }
  .late-penalty-explanation--penalty :deep(.v-icon) { color: #d92d20; }
  .late-penalty-explanation__copy { font-size: .95rem; line-height: 1.5; }
  .late-penalty-explanation__rate { font-size: .95rem; font-weight: 700; margin-top: 6px; }
</style>
