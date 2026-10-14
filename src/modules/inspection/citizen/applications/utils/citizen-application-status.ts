import type { ApplicationStatus, CitizenApplicationTimelineEvent, CitizenInspectionStatus, CitizenPaymentRecord, CitizenStickerStatus, RenewalApplicationListItem, TechnicalInspectionCertificateStatus } from '../types/application.types'
import { inspectionExpiryState } from '../../vehicles/utils/inspection-expiry-status'

export type CitizenApplicationStatus = {
  color: 'deep-purple' | 'error' | 'info' | 'secondary' | 'success' | 'warning'
  icon: string
  labelKey: string
}

type CitizenApplicationStatusSource = Pick<RenewalApplicationListItem, 'status'>
  & Partial<Pick<RenewalApplicationListItem, 'payment' | 'inspection' | 'certificate'>>

export type CitizenApplicationDetailedStatusFacts = {
  certificate: TechnicalInspectionCertificateStatus | null
  inspection: CitizenInspectionStatus | null
  payment: CitizenPaymentRecord | null
  sticker: CitizenStickerStatus | null
  timelineEvents: CitizenApplicationTimelineEvent[] | null
}

const lifecycleStatuses: Record<ApplicationStatus, CitizenApplicationStatus> = {
  DRAFT: { color: 'deep-purple', icon: 'mdi-file-edit-outline', labelKey: 'inspection_renewal_status_draft' },
  SUBMITTED: { color: 'warning', icon: 'mdi-file-clock-outline', labelKey: 'inspection_application_status_waiting_payment_confirmation' },
  UNDER_REVIEW: { color: 'info', icon: 'mdi-file-search-outline', labelKey: 'inspection_renewal_status_under_review' },
  CORRECTION_REQUIRED: { color: 'warning', icon: 'mdi-file-alert-outline', labelKey: 'inspection_renewal_status_correction_required' },
  APPROVED: { color: 'success', icon: 'mdi-file-check-outline', labelKey: 'inspection_renewal_status_approved' },
  INSPECTION_FAILED: { color: 'error', icon: 'mdi-car-alert', labelKey: 'inspection_renewal_status_inspection_failed' },
  EXPIRED: { color: 'error', icon: 'mdi-calendar-alert-outline', labelKey: 'inspection_renewal_status_expired' },
  REJECTED: { color: 'error', icon: 'mdi-close-circle-outline', labelKey: 'inspection_application_status_rejected' },
  CANCELLED: { color: 'secondary', icon: 'mdi-cancel', labelKey: 'inspection_application_status_cancelled' },
  COMPLETED: { color: 'success', icon: 'mdi-check-circle-outline', labelKey: 'inspection_application_status_completed' },
}

const ACTIVE_CYCLE_STATUSES = new Set<ApplicationStatus>([
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUIRED', 'APPROVED',
])

// The exact Application Details header follows the workflow facts in priority order.
// eslint-disable-next-line complexity
export function resolveCitizenApplicationStatus (application: CitizenApplicationStatusSource | undefined, facts?: CitizenApplicationDetailedStatusFacts): CitizenApplicationStatus {
  if (application === undefined) {
    return { color: 'secondary', icon: 'mdi-file-outline', labelKey: 'inspection_application_status_not_submitted' }
  }
  if (application.status === 'DRAFT') {
    return { color: 'secondary', icon: 'mdi-file-outline', labelKey: 'inspection_application_status_not_submitted' }
  }
  if (['COMPLETED', 'REJECTED', 'INSPECTION_FAILED', 'EXPIRED', 'CANCELLED', 'CORRECTION_REQUIRED'].includes(application.status)) {
    return lifecycleStatuses[application.status]
  }
  if (application.inspection?.result === 'FAIL' || facts?.inspection?.inspection?.result === 'FAIL') {
    return lifecycleStatuses.INSPECTION_FAILED
  }
  if ((application.certificate !== undefined && application.certificate !== null) || facts?.certificate?.issued === true) {
    return lifecycleStatuses.COMPLETED
  }
  const documentsApproved = facts?.timelineEvents?.some(event => event.eventType === 'DOCUMENTS_APPROVED') === true
  if (documentsApproved) {
    return { color: 'info', icon: 'mdi-certificate-outline', labelKey: 'inspection_application_status_certificate_issuance' }
  }
  if (facts?.sticker?.sticker?.issuedAt !== undefined && !documentsApproved) {
    return { color: 'info', icon: 'mdi-file-search-outline', labelKey: 'inspection_application_status_document_review' }
  }
  if (facts?.inspection?.inspection?.result === 'PASS' && facts.sticker?.sticker?.issuedAt === undefined) {
    return { color: 'info', icon: 'mdi-sticker-check-outline', labelKey: 'inspection_application_status_sticker_issuance' }
  }
  if (facts?.payment?.status === 'CONFIRMED' && facts.inspection?.inspection === null) {
    return { color: 'info', icon: 'mdi-calendar-clock-outline', labelKey: 'inspection_application_status_waiting_vehicle_inspection' }
  }
  if (application.status === 'SUBMITTED' && application.payment?.status === 'PENDING') {
    return { color: 'warning', icon: 'mdi-cash-clock', labelKey: 'inspection_application_status_awaiting_payment' }
  }
  if (application.status === 'SUBMITTED' && facts?.payment?.status !== 'CONFIRMED') {
    return { color: 'warning', icon: 'mdi-cash-clock', labelKey: 'inspection_application_status_awaiting_payment' }
  }
  if (application.status === 'APPROVED' && application.payment?.status === 'CONFIRMED' && application.inspection === null) {
    return { color: 'info', icon: 'mdi-calendar-clock-outline', labelKey: 'inspection_application_status_waiting_vehicle_inspection' }
  }
  return facts?.payment?.status === 'CONFIRMED' || application.payment?.status === 'CONFIRMED'
    ? { color: 'info', icon: 'mdi-calendar-clock-outline', labelKey: 'inspection_application_status_waiting_vehicle_inspection' }
    : { color: 'warning', icon: 'mdi-cash-clock', labelKey: 'inspection_application_status_awaiting_payment' }
}

/** Compact-card status only; application pages retain resolveCitizenApplicationStatus. */
export function resolveCitizenApplicationSummaryStatus (application: CitizenApplicationStatusSource | undefined): CitizenApplicationStatus {
  if (application === undefined) {
    return { color: 'secondary', icon: 'mdi-file-outline', labelKey: 'inspection_application_status_not_submitted' }
  }
  switch (application.status) {
    case 'DRAFT': { return { color: 'secondary', icon: 'mdi-file-outline', labelKey: 'inspection_application_status_not_submitted' } }
    case 'CORRECTION_REQUIRED': { return { color: 'warning', icon: 'mdi-file-alert-outline', labelKey: 'inspection_application_status_correction_required' } }
    case 'INSPECTION_FAILED':
    case 'REJECTED': { return { color: 'error', icon: 'mdi-close-circle-outline', labelKey: 'inspection_applications_filter_unsuccessful' } }
    case 'COMPLETED': { return { color: 'success', icon: 'mdi-check-circle-outline', labelKey: 'inspection_application_status_completed' } }
    case 'CANCELLED': { return { color: 'secondary', icon: 'mdi-cancel', labelKey: 'inspection_summary_status_cancelled' } }
    case 'EXPIRED': { return { color: 'error', icon: 'mdi-calendar-alert-outline', labelKey: 'inspection_application_status_expired' } }
    default: {
      if (application.inspection?.result === 'FAIL') {
        return lifecycleStatuses.INSPECTION_FAILED
      }
      if (application.certificate !== null && application.certificate !== undefined) {
        return lifecycleStatuses.COMPLETED
      }
      if (application.inspection?.result === 'PASS') {
        return { color: 'info', icon: 'mdi-sticker-check-outline', labelKey: 'inspection_application_status_sticker_issuance' }
      }
      if (application.payment?.status === 'CONFIRMED') {
        return { color: 'info', icon: 'mdi-calendar-clock-outline', labelKey: 'inspection_application_status_waiting_vehicle_inspection' }
      }
      return { color: 'warning', icon: 'mdi-cash-clock', labelKey: 'inspection_application_status_awaiting_payment' }
    }
  }
}

/** Vehicle screens combine the active renewal cycle with the current certificate expiry. */
export function resolveCitizenVehicleRenewalStatus (
  application: CitizenApplicationStatusSource | undefined,
  inspectionExpiryDate: string,
): CitizenApplicationStatus | undefined {
  if (application !== undefined && ACTIVE_CYCLE_STATUSES.has(application.status)) {
    return resolveCitizenApplicationSummaryStatus(application)
  }

  const expiryState = inspectionExpiryState(inspectionExpiryDate)
  if (expiryState === 'expiring') {
    return { color: 'warning', icon: 'mdi-alert-outline', labelKey: 'inspection_renewal_action_required' }
  }
  if (expiryState === 'expired') {
    return { color: 'error', icon: 'mdi-alert-circle-outline', labelKey: 'inspection_renewal_action_required' }
  }

  return application === undefined
    ? undefined
    : resolveCitizenApplicationSummaryStatus(application)
}

export function latestCitizenApplicationForVehicle (
  applications: RenewalApplicationListItem[],
  vehicleId: string,
): RenewalApplicationListItem | undefined {
  return applications
    .filter(application => application.vehicleId === vehicleId)
    .reduce<RenewalApplicationListItem | undefined>((latest, application) => {
      if (latest === undefined || Date.parse(application.updatedAt) > Date.parse(latest.updatedAt)) {
        return application
      }
      return latest
    }, undefined)
}

export function citizenCardCycleForVehicle (
  applications: RenewalApplicationListItem[],
  vehicleId: string,
): RenewalApplicationListItem | undefined {
  const vehicleApplications = applications.filter(application => application.vehicleId === vehicleId)
  const latest = (items: RenewalApplicationListItem[]) => items.reduce<RenewalApplicationListItem | undefined>((current, application) => {
    if (current === undefined || Date.parse(application.updatedAt) > Date.parse(current.updatedAt)) {
      return application
    }
    return current
  }, undefined)

  return latest(vehicleApplications.filter(application => ACTIVE_CYCLE_STATUSES.has(application.status)))
    ?? latest(vehicleApplications)
}

export function citizenCardIdentifierLabel (
  application: RenewalApplicationListItem | undefined,
  identifier: 'certificate' | 'transaction',
): string {
  const value = identifier === 'certificate'
    ? application?.certificate?.certificateNumber
    : application?.payment?.transactionNumber
  if (value) {
    return value
  }
  return '—'
}
