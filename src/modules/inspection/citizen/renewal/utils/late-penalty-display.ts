export type LatePenaltyVehicleClass = 'LIGHT' | 'HEAVY'

export const LATE_PENALTY_GRACE_DAYS = 30

export const LATE_PENALTY_DAILY_RATE_KHR: Record<LatePenaltyVehicleClass, number> = {
  LIGHT: 500,
  HEAVY: 2000,
}

export type LatePenaltyDisplay = {
  vehicleClass: LatePenaltyVehicleClass
  dailyRateKhr: number
  lateDays: number
  graceDays: number
  chargeableLateDays: number
  isChargeableDaysCapped: boolean
}

export function latePenaltyDisplay (
  lateDays: number,
  lateFee: string,
  vehicleClass: LatePenaltyVehicleClass | null,
): LatePenaltyDisplay | null {
  if (vehicleClass === null) {
    return null
  }

  const normalizedLateDays = Math.max(Math.trunc(lateDays), 0)
  const dailyRateKhr = LATE_PENALTY_DAILY_RATE_KHR[vehicleClass]
  const uncappedChargeableLateDays = Math.max(
    normalizedLateDays - LATE_PENALTY_GRACE_DAYS,
    0,
  )
  const returnedLateFee = Number(lateFee)
  const returnedChargeableLateDays = returnedLateFee / dailyRateKhr
  const hasWholeReturnedChargeableDays = Number.isInteger(
    returnedChargeableLateDays,
  ) && returnedChargeableLateDays >= 0
  const chargeableLateDays = hasWholeReturnedChargeableDays
    ? returnedChargeableLateDays
    : uncappedChargeableLateDays

  return {
    vehicleClass,
    dailyRateKhr,
    lateDays: normalizedLateDays,
    graceDays: LATE_PENALTY_GRACE_DAYS,
    chargeableLateDays,
    isChargeableDaysCapped: chargeableLateDays !== uncappedChargeableLateDays,
  }
}
