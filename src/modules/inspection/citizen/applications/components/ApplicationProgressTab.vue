<script setup lang="ts">
  import type {
    ApplicationStatus,
    CitizenApplicationTimelineEvent,
    CitizenInspectionStatus,
    CitizenPaymentRecord,
    CitizenStickerStatus,
    RenewalApplicationDetail,
    RenewalApplicationStatusHistory,
    TechnicalInspectionCertificateStatus,
  } from '../types/application.types'
  import { isAxiosError } from 'axios'
  import { useI18n } from 'vue-i18n'
  import { formatDisplayDate } from '@/modules/inspection/shared/utils/display-date'
  import { inspectionApplicationService } from '../services/application.service'
  import { localizedApplicationReason, localizedCorrectionReason } from '../utils/correction-reason'
  import TechnicalInspectionCertificateCard from './TechnicalInspectionCertificateCard.vue'

  type ProgressState = 'COMPLETED' | 'CURRENT' | 'PENDING' | 'FAILED' | 'CANCELLED' | 'REJECTED' | 'UNREACHABLE_AFTER_FAILURE'
  type ProgressSource = 'history' | 'timeline' | 'inspection' | 'sticker' | 'payment' | 'certificate'
  type ApiErrorResponse = { code?: string }

  interface ProgressStep {
    number: number
    titleKey: string
    state: ProgressState
    timestamp: string | null
    actionRequired: boolean
    detail: string | null
  }

  interface FailureFact {
    index: number
    state: 'FAILED' | 'CANCELLED' | 'REJECTED'
    timestamp: string | null
    detail: string | null
  }

  const props = defineProps<{
    active: boolean
    application: RenewalApplicationDetail
    renewalActionIcon?: string
    renewalActionLabelKey?: string
    renewalLoading?: boolean
  }>()
  const emit = defineEmits<{ correction: [], renew: [] }>()
  const { locale, t } = useI18n()
  const history = ref<RenewalApplicationStatusHistory[] | null>(null)
  const timelineEvents = ref<CitizenApplicationTimelineEvent[] | null>(null)
  const inspection = ref<CitizenInspectionStatus | null>(null)
  const sticker = ref<CitizenStickerStatus | null>(null)
  const payment = ref<CitizenPaymentRecord | null>(null)
  const certificate = ref<TechnicalInspectionCertificateStatus | null>(null)
  const sourceErrors = ref<ProgressSource[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  let loadSequence = 0

  const stepDefinitions = [
    'inspection_application_progress_step_submitted',
    'inspection_application_progress_step_payment',
    'inspection_application_progress_step_inspection',
    'inspection_application_progress_step_sticker',
    'inspection_application_progress_step_documents',
    'inspection_application_progress_step_certificate',
    'inspection_application_progress_step_completed',
  ] as const

  const workflowSteps = computed<ProgressStep[]>(() => {
    const primaryInspection = primaryInspectionFact()
    const documentsApprovedAt = latestTimelineEventTimestamp('DOCUMENTS_APPROVED')
    const certificateIssuedAt = certificate.value?.issued === true ? certificate.value.issuedAt : null
    const applicationCompletedAt = certificateIssuedAt === null
      ? null
      : props.application.completedAt ?? latestHistoryTimestamp('COMPLETED')
    const completedAt = [
      props.application.submittedAt,
      payment.value?.status === 'CONFIRMED' ? payment.value.confirmedAt : null,
      primaryInspection?.result === 'PASS' ? primaryInspection.completedAt : null,
      sticker.value?.sticker?.issuedAt ?? null,
      documentsApprovedAt,
      certificateIssuedAt,
      applicationCompletedAt,
    ]
    const failure = failureFact(completedAt, primaryInspection)
    const correctionRequired = props.application.status === 'CORRECTION_REQUIRED'
    const lastCompletedIndex = completedAt.reduce((latest, timestamp, index) => timestamp === null ? latest : index, -1)
    const currentIndex = correctionRequired ? 4 : Math.min(lastCompletedIndex + 1, stepDefinitions.length - 1)

    return stepDefinitions.map((titleKey, index) => {
      let state: ProgressState
      let timestamp = completedAt[index] ?? null
      let detail: string | null = null
      const actionRequired = correctionRequired && index === 4

      if (failure !== null && index >= failure.index) {
        state = index === failure.index ? failure.state : 'UNREACHABLE_AFTER_FAILURE'
        timestamp = index === failure.index ? failure.timestamp : null
        detail = index === failure.index ? failure.detail : null
      } else if (actionRequired) {
        state = 'CURRENT'
        timestamp = latestHistoryTimestamp('CORRECTION_REQUIRED')
        detail = localizedCorrectionReason(props.application.currentCorrectionReason, locale.value, t)
      } else if (timestamp !== null) {
        state = 'COMPLETED'
      } else if (index === currentIndex && applicationCompletedAt === null) {
        state = 'CURRENT'
      } else {
        state = 'PENDING'
      }

      return { number: index + 1, titleKey, state, timestamp, actionRequired, detail }
    })
  })

  watch(
    () => [props.active, props.application.id, props.application.updatedAt] as const,
    ([active, applicationId, updatedAt], previous) => {
      if (previous !== undefined && (previous[1] !== applicationId || previous[2] !== updatedAt)) resetProgress()
      if (active && !loaded.value && !loading.value) void loadProgress()
    },
    { immediate: true },
  )

  function resetProgress () {
    loadSequence += 1
    history.value = null
    timelineEvents.value = null
    inspection.value = null
    sticker.value = null
    payment.value = null
    certificate.value = null
    sourceErrors.value = []
    loaded.value = false
    loading.value = false
  }

  async function optionalPayment (): Promise<CitizenPaymentRecord | null> {
    try {
      return await inspectionApplicationService.getPayment(props.application.id)
    } catch (error) {
      if (isAxiosError<ApiErrorResponse>(error) && error.response?.data?.code === 'PAYMENT_NOT_FOUND') return null
      throw error
    }
  }

  async function loadProgress () {
    const sequence = ++loadSequence
    loading.value = true
    sourceErrors.value = []
    const results = await Promise.allSettled([
      inspectionApplicationService.listStatusHistory(props.application.id, { page: 1, limit: 100, sortOrder: 'asc' }),
      inspectionApplicationService.listTimelineEvents(props.application.id),
      inspectionApplicationService.getInspectionStatus(props.application.id),
      inspectionApplicationService.getStickerStatus(props.application.id),
      optionalPayment(),
      inspectionApplicationService.getApplicationCertificate(props.application.id),
    ] as const)
    if (sequence !== loadSequence) return

    const errors: ProgressSource[] = []
    const [historyResult, timelineResult, inspectionResult, stickerResult, paymentResult, certificateResult] = results
    if (historyResult.status === 'fulfilled') history.value = historyResult.value.data
    else errors.push('history')
    if (timelineResult.status === 'fulfilled') timelineEvents.value = timelineResult.value
    else errors.push('timeline')
    if (inspectionResult.status === 'fulfilled') inspection.value = inspectionResult.value
    else errors.push('inspection')
    if (stickerResult.status === 'fulfilled') sticker.value = stickerResult.value
    else errors.push('sticker')
    if (paymentResult.status === 'fulfilled') payment.value = paymentResult.value
    else errors.push('payment')
    if (certificateResult.status === 'fulfilled') certificate.value = certificateResult.value
    else errors.push('certificate')
    sourceErrors.value = errors
    loaded.value = true
    loading.value = false
  }

  function primaryInspectionFact (): { result: 'PASS' | 'FAIL', completedAt: string, failureReason: string | null } | null {
    const stickerInspection = sticker.value?.inspection
    if (stickerInspection?.attemptNumber === 1) {
      return { result: 'PASS', completedAt: stickerInspection.completedAt, failureReason: null }
    }
    const inspectionFact = inspection.value?.inspection
    if (inspectionFact?.attemptNumber !== 1) return null
    return { result: inspectionFact.result, completedAt: inspectionFact.inspectedAt, failureReason: inspectionFact.failureReason }
  }

  function latestHistoryEntry (
    status: ApplicationStatus,
    predicate: (entry: RenewalApplicationStatusHistory) => boolean = () => true,
  ): RenewalApplicationStatusHistory | null {
    return (history.value ?? []).reduce<RenewalApplicationStatusHistory | null>((latest, entry) => {
      if (entry.newStatus !== status || !predicate(entry)) return latest
      return latest === null || Date.parse(entry.createdAt) > Date.parse(latest.createdAt) ? entry : latest
    }, null)
  }

  function latestHistoryTimestamp (status: ApplicationStatus): string | null {
    return latestHistoryEntry(status)?.createdAt ?? null
  }

  function latestTimelineEventTimestamp (eventType: string): string | null {
    return (timelineEvents.value ?? []).reduce<string | null>((latest, event) => {
      if (event.eventType !== eventType) return latest
      return latest === null || Date.parse(event.occurredAt) > Date.parse(latest) ? event.occurredAt : latest
    }, null)
  }

  function failureFact (
    completedAt: Array<string | null>,
    primaryInspection: ReturnType<typeof primaryInspectionFact>,
  ): FailureFact | null {
    if (props.application.status === 'CANCELLED' || props.application.status === 'EXPIRED') {
      const lastCompleted = completedAt.reduce((latest, timestamp, index) => timestamp === null ? latest : index, -1)
      return {
        index: Math.min(lastCompleted + 1, stepDefinitions.length - 1),
        state: props.application.status === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
        timestamp: props.application.status === 'CANCELLED' ? props.application.cancelledAt : latestHistoryTimestamp('EXPIRED'),
        detail: t(props.application.status === 'CANCELLED' ? 'inspection_application_status_cancelled' : 'inspection_application_status_expired'),
      }
    }
    if (payment.value?.status === 'REJECTED') {
      return {
        index: 1,
        state: 'FAILED',
        timestamp: payment.value.status === 'REJECTED' ? payment.value.rejectedAt : null,
        detail: t('inspection_application_status_payment_rejected'),
      }
    }
    if (primaryInspection?.result === 'FAIL') {
      return { index: 2, state: 'FAILED', timestamp: primaryInspection.completedAt, detail: primaryInspection.failureReason }
    }
    if (props.application.status === 'INSPECTION_FAILED') {
      return { index: 2, state: 'FAILED', timestamp: null, detail: t('inspection_application_status_inspection_failed') }
    }
    if (props.application.status === 'REJECTED') {
      return {
        index: 4,
        state: 'REJECTED',
        timestamp: latestHistoryTimestamp('REJECTED'),
        detail: localizedApplicationReason(props.application.currentRejectionReason, locale.value, t),
      }
    }
    return null
  }

  function stateKey (state: ProgressState): string {
    return {
      COMPLETED: 'inspection_application_progress_state_completed',
      CURRENT: 'inspection_application_progress_state_current',
      PENDING: 'inspection_application_progress_state_pending',
      FAILED: 'inspection_application_progress_state_failed',
      CANCELLED: 'inspection_application_status_cancelled',
      REJECTED: 'inspection_application_status_rejected',
      UNREACHABLE_AFTER_FAILURE: 'inspection_application_progress_state_unreachable',
    }[state]
  }

  function stepAriaLabel (step: ProgressStep): string {
    const parts = [t(step.titleKey), t(stateKey(step.state))]
    if (step.actionRequired) parts.push(t('inspection_application_progress_action_required'))
    if (step.timestamp) parts.push(formatTimestamp(step.timestamp))
    return parts.join(', ')
  }

  function formatTimestamp (value: string): string {
    const date = new Date(value)
    if (Number.isNaN(date.valueOf())) return value
    const time = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
      timeZone: 'Asia/Phnom_Penh',
    }).format(date)
    return `${formatDisplayDate(date)}, ${time}`
  }

  onBeforeUnmount(() => {
    loadSequence += 1
  })
</script>

<template>
  <section :aria-label="$t('inspection_application_progress_title')" class="application-progress-tab">
    <div v-if="loading && !loaded" aria-live="polite" class="application-progress-tab__loading" role="status">
      <v-progress-circular color="primary" indeterminate size="34" />
      <p>{{ $t('inspection_application_progress_loading') }}</p>
    </div>

    <template v-else>
      <v-alert
        v-if="sourceErrors.length > 0"
        class="application-progress-tab__warning"
        density="compact"
        type="warning"
        variant="tonal"
      >
        <div class="application-progress-tab__warning-content">
          <span>{{ $t('inspection_application_progress_partial_error') }}</span>

          <v-btn
            :loading="loading"
            prepend-icon="mdi-refresh"
            size="small"
            variant="outlined"
            @click="loadProgress"
          >{{ $t('retry') }}</v-btn>
        </div>
      </v-alert>

      <div class="application-progress-card">
        <ol class="application-progress-timeline">
          <li
            v-for="step in workflowSteps"
            :key="step.number"
            :aria-label="stepAriaLabel(step)"
            class="application-progress-step"
            :class="[`application-progress-step--${step.state.toLowerCase()}`, { 'application-progress-step--action-required': step.actionRequired }]"
          >
            <button
              v-if="step.actionRequired"
              :aria-label="$t('inspection_application_correction_open_accessible', { status: $t('inspection_application_progress_action_required') })"
              class="application-progress-step__node application-progress-step__node-button"
              type="button"
              @click="emit('correction')"
            >
              <span>{{ String(step.number).padStart(2, '0') }}</span>
            </button>

            <div v-else aria-hidden="true" class="application-progress-step__node">
              <v-icon v-if="step.state === 'COMPLETED'" icon="mdi-check" size="18" />
              <v-icon v-else-if="step.state === 'FAILED'" icon="mdi-close" size="18" />
              <v-icon v-else-if="step.state === 'CANCELLED'" icon="mdi-cancel" size="18" />
              <v-icon v-else-if="step.state === 'REJECTED'" icon="mdi-close-circle-outline" size="18" />
              <span v-else>{{ String(step.number).padStart(2, '0') }}</span>
            </div>

            <div class="application-progress-step__content">
              <div class="application-progress-step__heading">
                <h3>
                  <button
                    v-if="step.actionRequired"
                    :aria-label="$t('inspection_application_correction_open_accessible', { status: $t('inspection_application_progress_action_required') })"
                    class="application-progress-step__title-button"
                    type="button"
                    @click="emit('correction')"
                  >{{ $t(step.titleKey) }}</button>

                  <template v-else>{{ $t(step.titleKey) }}</template>
                </h3>

                <button
                  v-if="step.actionRequired"
                  :aria-label="$t('inspection_application_correction_open_accessible', { status: $t('inspection_application_progress_action_required') })"
                  class="application-progress-step__action"
                  type="button"
                  @click="emit('correction')"
                >{{ $t('inspection_application_progress_action_required') }}</button>
              </div>

              <time v-if="step.timestamp" :datetime="step.timestamp">{{ formatTimestamp(step.timestamp) }}</time>
              <p v-if="step.detail" class="application-progress-step__detail">{{ step.detail }}</p>
            </div>
          </li>
        </ol>
      </div>

      <div v-if="application.status === 'COMPLETED'" class="application-progress-completion">
        <v-btn
          color="primary"
          :loading="renewalLoading"
          :prepend-icon="renewalActionIcon || 'mdi-refresh'"
          @click="emit('renew')"
        >{{ $t(renewalActionLabelKey || 'inspection_renewal_renew_again') }}</v-btn>
      </div>

      <TechnicalInspectionCertificateCard
        v-if="certificate?.issued === true"
        :application-id="application.id"
        :certificate="certificate"
      />
    </template>
  </section>
</template>

<style scoped>
  .application-progress-tab { min-width: 0; }
  .application-progress-tab__loading { align-items: center; color: #666c7b; display: flex; flex-direction: column; gap: 12px; justify-content: center; min-height: 300px; text-align: center; }
  .application-progress-tab__loading p { margin: 0; }
  .application-progress-tab__warning { margin: 0 auto 18px; max-width: 820px; }
  .application-progress-tab__warning-content { align-items: center; display: flex; gap: 16px; justify-content: space-between; }
  .application-progress-card { align-self: start; background: transparent; border: 0; border-radius: 0; box-shadow: none; box-sizing: border-box; height: fit-content; margin-inline: auto; max-width: 640px; min-height: 0; padding: 10px 8px 6px; width: 100%; }
  .application-progress-timeline { list-style: none; margin: 0; min-width: 0; padding: 0; width: 100%; }
  .application-progress-step { display: grid; gap: 14px; grid-template-columns: 34px minmax(0, 1fr); min-height: 74px; padding-bottom: 18px; position: relative; }
  .application-progress-step:last-child { min-height: 34px; padding-bottom: 0; }
  .application-progress-step:not(:last-child)::after { background: #cbd5e3; bottom: 0; content: ''; left: 16px; position: absolute; top: 32px; width: 2px; }
  .application-progress-step--completed:not(:last-child)::after { background: #5969ad; }
  .application-progress-step--failed:not(:last-child)::after { background: #e0a3a3; }
  .application-progress-step--cancelled:not(:last-child)::after { background: #9aa1ad; }
  .application-progress-step--rejected:not(:last-child)::after { background: #e0a3a3; }
  .application-progress-step--unreachable_after_failure:not(:last-child)::after { background: #e2e4e9; }
  .application-progress-step__node { align-items: center; background: #fff; border: 2px solid #bdc8da; border-radius: 50%; box-shadow: none; color: #647087; display: flex; font-size: .85rem; font-weight: 400; height: 34px; justify-content: center; position: relative; width: 34px; z-index: 1; }
  .application-progress-step--completed .application-progress-step__node { background: #3c348d; border-color: #3c348d; box-shadow: none; color: #fff; }
  .application-progress-step--current .application-progress-step__node { background: #fff; border-color: #31539a; box-shadow: none; color: #244689; transform: none; }
  .application-progress-step--pending .application-progress-step__node { background: #fafbfc; border-color: #cbd3df; color: #8b93a3; }
  .application-progress-step--failed .application-progress-step__node { background: #b42318; border-color: #b42318; color: #fff; }
  .application-progress-step--action-required .application-progress-step__node { background: #fff7f7; border-color: #b42318; box-shadow: 0 0 0 4px rgba(180, 35, 24, .1); color: #b42318; }
  .application-progress-step__node-button { cursor: pointer; font-family: inherit; padding: 0; }
  .application-progress-step__node-button:hover { background: #ffebeb; }
  .application-progress-step__node-button:focus-visible { outline: 3px solid rgba(180, 35, 24, .28); outline-offset: 3px; }
  .application-progress-step--unreachable_after_failure { opacity: .48; }
  .application-progress-step__content { min-width: 0; padding-top: 1px; }
  .application-progress-step__heading { align-items: center; display: flex; flex-wrap: wrap; gap: 8px 10px; }
  .application-progress-step__heading h3 { color: #20283b; font-size: .94rem; font-weight: 400 !important; line-height: 1.4; margin: 0; overflow-wrap: anywhere; }
  .application-progress-step--current .application-progress-step__heading h3 { color: #243a7a; }
  .application-progress-step--pending .application-progress-step__heading h3 { color: #8b93a3; }
  .application-progress-step--failed .application-progress-step__heading h3 { color: #9f221a; }
  .application-progress-step--cancelled .application-progress-step__heading h3 { color: #596273; }
  .application-progress-step--rejected .application-progress-step__heading h3 { color: #9f221a; }
  .application-progress-step__title-button { background: transparent; border: 0; color: inherit; cursor: pointer; font: inherit; padding: 0; text-align: start; }
  .application-progress-step__title-button:hover { text-decoration: underline; text-underline-offset: 3px; }
  .application-progress-step__title-button:focus-visible { border-radius: 3px; outline: 3px solid rgba(180, 35, 24, .28); outline-offset: 3px; }
  .application-progress-tab .application-progress-timeline .application-progress-step__content time { color: #9aa1ad; display: block; font-size: .85rem !important; margin-top: 3px; }
  .application-progress-step__detail { color: #596273; font-size: .82rem !important; margin: 5px 0 0; overflow-wrap: anywhere; }
  .application-progress-step--pending .application-progress-step__detail { color: #9aa1ad; }
  .application-progress-step--failed .application-progress-step__detail { color: #9f221a; }
  .application-progress-step--cancelled .application-progress-step__detail { color: #596273; }
  .application-progress-step--rejected .application-progress-step__detail { color: #9f221a; }
  .application-progress-step--action-required .application-progress-step__detail { color: #b42318; font-size: .76rem !important; line-height: 1.5; }
  .application-progress-step__action { background: #fff1f0; border: 1px solid #f3b7b2; border-radius: 999px; color: #b42318; cursor: pointer; font-family: inherit; font-size: .72rem; font-weight: 800; padding: 3px 8px; }
  .application-progress-step__action:hover { background: #ffe1df; }
  .application-progress-step__action:focus-visible { outline: 3px solid rgba(180, 35, 24, .28); outline-offset: 2px; }
  .application-progress-completion { align-items: flex-start; border-top: 1px solid #e0e3eb; display: flex; gap: 16px; justify-content: flex-end; margin: 18px 0 0; padding: 20px 0 2px; width: 100%; }
  @media (max-width: 599px) {
    .application-progress-card { max-width: 100%; padding: 6px 0 2px; }
    .application-progress-step { gap: 12px; grid-template-columns: 34px minmax(0, 1fr); min-height: 68px; padding-bottom: 16px; }
    .application-progress-step__node { height: 34px; width: 34px; }
    .application-progress-step:not(:last-child)::after { left: 16px; top: 33px; }
    .application-progress-tab__warning-content { align-items: stretch; flex-direction: column; }
    .application-progress-tab__warning-content :deep(.v-btn) { width: 100%; }
    .application-progress-completion { align-items: stretch; flex-direction: column; padding-inline: 0; }
  }
</style>
