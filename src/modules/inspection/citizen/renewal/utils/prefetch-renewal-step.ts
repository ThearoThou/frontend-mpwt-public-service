type RenewalStep = 'payment' | 'review' | 'scheduling'

const renewalStepLoaders: Record<RenewalStep, () => Promise<unknown>> = {
  payment: () => import('@/pages/services/inspection/renewal/payment.vue'),
  review: () => import('@/pages/services/inspection/renewal/review.vue'),
  scheduling: () => import('@/pages/services/inspection/renewal/scheduling.vue'),
}

export function prefetchRenewalStep (step: RenewalStep): void {
  void renewalStepLoaders[step]().catch(() => {
    // Navigation still owns error handling if an optional prefetch fails.
  })
}
