import type { RenewalApplication } from '../../applications/types/application.types'
import { inspectionExpiryState, renewalRequiresConfirmation } from '../../vehicles/utils/inspection-expiry-status'

export type RenewalEntryAction = {
  kind: 'correct' | 'start' | 'renew' | 'apply-again' | 'resume' | 'track'
  icon: string
  labelKey: string
}

export type RenewalApplicationStatusBadge = {
  color: 'deep-purple' | 'info' | 'secondary' | 'success' | 'warning'
  icon: string
  labelKey: string
}

export type RenewalReminderBadge = {
  color: 'error' | 'info'
  icon: string
  labelKey: 'inspection_renewal_available' | 'inspection_renewal_required'
}

export type RenewalEntryDecision
  = | { kind: 'continue', application: RenewalApplication }
    | { kind: 'confirm' }
    | { kind: 'create' }

const UNFINISHED_APPLICATION_STATUSES = new Set<RenewalApplication['status']>([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'CORRECTION_REQUIRED',
  'APPROVED',
])

export function findUnfinishedApplication (
  applications: RenewalApplication[],
  vehicleId: string,
): RenewalApplication | undefined {
  return applications.find(
    application =>
      application.vehicleId === vehicleId
      && UNFINISHED_APPLICATION_STATUSES.has(application.status),
  )
}

/** Active renewal state is authoritative; vehicle validity is considered only when none exists. */
export function resolveRenewalEntryDecision (
  applications: RenewalApplication[],
  vehicleId: string,
  inspectionExpiryDate: string,
): RenewalEntryDecision {
  const application = findUnfinishedApplication(applications, vehicleId)
  if (application !== undefined) {
    return { kind: 'continue', application }
  }

  return renewalRequiresConfirmation(inspectionExpiryDate)
    ? { kind: 'confirm' }
    : { kind: 'create' }
}

export function findRenewalEntryApplication (
  applications: RenewalApplication[],
  vehicleId: string,
): RenewalApplication | undefined {
  return findUnfinishedApplication(applications, vehicleId)
    ?? applications.find(application => application.vehicleId === vehicleId && application.status === 'INSPECTION_FAILED')
    ?? applications.find(application => application.vehicleId === vehicleId && application.status === 'EXPIRED')
}

export function renewalEntryAction (
  application: RenewalApplication | undefined,
): RenewalEntryAction {
  if (application === undefined) {
    return {
      kind: 'start',
      icon: 'mdi-refresh',
      labelKey: 'inspection_dashboard_renew_vehicle',
    }
  }

  if (application.status === 'DRAFT') {
    return {
      kind: 'resume',
      icon: 'mdi-play-circle-outline',
      labelKey: 'inspection_renewal_continue',
    }
  }

  if (application.status === 'CORRECTION_REQUIRED') {
    return {
      kind: 'correct',
      icon: 'mdi-file-edit-outline',
      labelKey: 'inspection_application_correct_documents',
    }
  }

  if (application.status === 'EXPIRED') {
    return {
      kind: 'renew',
      icon: 'mdi-refresh',
      labelKey: 'inspection_renewal_renew_again',
    }
  }

  if (application.status === 'INSPECTION_FAILED') {
    return {
      kind: 'apply-again',
      icon: 'mdi-refresh',
      labelKey: 'inspection_renewal_apply_again',
    }
  }

  return {
    kind: 'track',
    icon: 'mdi-file-document-outline',
    labelKey: 'inspection_renewal_track_application',
  }
}

export function renewalApplicationStatusBadge (
  application: RenewalApplication | undefined,
): RenewalApplicationStatusBadge | undefined {
  if (application === undefined) {
    return undefined
  }

  const statusBadges: Partial<
    Record<RenewalApplication['status'], RenewalApplicationStatusBadge>
  > = {
    DRAFT: {
      color: 'deep-purple',
      icon: 'mdi-file-edit-outline',
      labelKey: 'inspection_renewal_status_draft',
    },
    SUBMITTED: {
      color: 'info',
      icon: 'mdi-file-clock-outline',
      labelKey: 'inspection_renewal_status_submitted',
    },
    UNDER_REVIEW: {
      color: 'info',
      icon: 'mdi-file-search-outline',
      labelKey: 'inspection_renewal_status_under_review',
    },
    CORRECTION_REQUIRED: {
      color: 'warning',
      icon: 'mdi-file-alert-outline',
      labelKey: 'inspection_renewal_status_correction_required',
    },
    APPROVED: {
      color: 'success',
      icon: 'mdi-file-check-outline',
      labelKey: 'inspection_renewal_status_approved',
    },
    INSPECTION_FAILED: {
      color: 'warning',
      icon: 'mdi-car-alert',
      labelKey: 'inspection_renewal_status_inspection_failed',
    },
    EXPIRED: {
      color: 'warning',
      icon: 'mdi-calendar-alert-outline',
      labelKey: 'inspection_renewal_status_expired',
    },
  }

  return statusBadges[application.status]
}

export function renewalReminderBadge (
  inspectionExpiryDate: string,
): RenewalReminderBadge | undefined {
  const expiryState = inspectionExpiryState(inspectionExpiryDate)

  if (expiryState === 'expiring') {
    return {
      color: 'info',
      icon: 'mdi-file-refresh-outline',
      labelKey: 'inspection_renewal_available',
    }
  }

  if (expiryState === 'expired') {
    return {
      color: 'error',
      icon: 'mdi-file-alert-outline',
      labelKey: 'inspection_renewal_required',
    }
  }

  return undefined
}

export function unfinishedApplicationMessageKey (
  application: RenewalApplication | undefined,
): string {
  if (application?.status === 'SUBMITTED') {
    return 'inspection_renewal_submitted_message'
  }

  if (application?.status === 'UNDER_REVIEW') {
    return 'inspection_renewal_under_review_message'
  }

  return 'inspection_unfinished_application_error'
}
