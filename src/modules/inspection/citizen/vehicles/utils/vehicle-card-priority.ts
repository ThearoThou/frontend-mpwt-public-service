import type { RenewalApplicationListItem } from '../../applications/types/application.types'
import type { Vehicle } from '../types/vehicle.types'
import { citizenCardCycleForVehicle } from '../../applications/utils/citizen-application-status'
import { cambodiaToday, inspectionExpiryState } from './inspection-expiry-status'

type VehicleCardPriority = 0 | 1 | 2 | 3 | 4 | 5

const CITIZEN_ACTION_STATUSES = new Set<RenewalApplicationListItem['status']>([
  'CORRECTION_REQUIRED',
  'DRAFT',
])

const ACTIVE_PROCESSING_STATUSES = new Set<RenewalApplicationListItem['status']>([
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
])

const UNSUCCESSFUL_STATUSES = new Set<RenewalApplicationListItem['status']>([
  'INSPECTION_FAILED',
  'REJECTED',
])

/**
 * Card order reflects the citizen's next action, rather than raw lifecycle
 * order. Vehicle inspection expiry and an expired application are deliberately
 * treated as different situations.
 */
export function vehicleCardPriority (
  vehicle: Vehicle,
  applications: RenewalApplicationListItem[],
): VehicleCardPriority {
  const application = citizenCardCycleForVehicle(applications, vehicle.id)

  if (
    application !== undefined
    && (CITIZEN_ACTION_STATUSES.has(application.status)
      || application.payment?.status === 'REJECTED')
  ) {
    return 0
  }

  if (application?.status === 'CANCELLED' || application?.status === 'EXPIRED') {
    return 5
  }

  if (application !== undefined && UNSUCCESSFUL_STATUSES.has(application.status)) {
    return 3
  }

  if (application !== undefined && ACTIVE_PROCESSING_STATUSES.has(application.status)) {
    return 2
  }

  if (inspectionExpiryState(vehicle.inspectionExpiryDate) !== 'valid') {
    return 1
  }

  return 4
}

export function sortCitizenVehicleCards (
  vehicles: Vehicle[],
  applications: RenewalApplicationListItem[],
): Vehicle[] {
  // ES2022 is the supported browser target; sort a copied array to keep input immutable.
  // eslint-disable-next-line unicorn/no-array-sort
  return [...vehicles].sort((left, right) => {
    const priorityDifference = vehicleCardPriority(left, applications) - vehicleCardPriority(right, applications)
    if (priorityDifference !== 0) {
      return priorityDifference
    }

    const leftApplication = citizenCardCycleForVehicle(applications, left.id)
    const rightApplication = citizenCardCycleForVehicle(applications, right.id)
    const leftUpcomingDate = upcomingInspectionDate(leftApplication)
    const rightUpcomingDate = upcomingInspectionDate(rightApplication)
    const upcomingDifference = compareOptionalAscending(leftUpcomingDate, rightUpcomingDate)
    if (upcomingDifference !== 0) {
      return upcomingDifference
    }

    const leftUpdatedAt = leftApplication?.updatedAt ?? left.updatedAt
    const rightUpdatedAt = rightApplication?.updatedAt ?? right.updatedAt
    const updatedDifference = Date.parse(rightUpdatedAt) - Date.parse(leftUpdatedAt)
    if (updatedDifference === 0) {
      return left.id.localeCompare(right.id)
    }

    return updatedDifference
  })
}

function upcomingInspectionDate (application: RenewalApplicationListItem | undefined): string | null {
  const preferredDate = application?.preferredInspectionDate
  return preferredDate !== null && preferredDate !== undefined && preferredDate >= cambodiaToday()
    ? preferredDate
    : null
}

function compareOptionalAscending (left: string | null, right: string | null): number {
  if (left === right) {
    return 0
  }
  if (left === null) {
    return 1
  }
  if (right === null) {
    return -1
  }
  return left.localeCompare(right)
}
