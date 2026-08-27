export type InspectionExpiryState = 'expired' | 'expiring' | 'valid'

const CAMBODIA_TIME_ZONE = 'Asia/Phnom_Penh'
const RENEWAL_ELIGIBILITY_WINDOW_DAYS = 30

export function daysUntilInspectionExpiry (inspectionExpiryDate: string, now = new Date()): number {
  return calendarDayNumber(inspectionExpiryDate) - calendarDayNumber(cambodiaToday(now))
}

export function inspectionExpiryState (inspectionExpiryDate: string, now = new Date()): InspectionExpiryState {
  const daysUntilExpiry = daysUntilInspectionExpiry(inspectionExpiryDate, now)

  if (daysUntilExpiry <= 0) {
    return 'expired'
  }
  if (daysUntilExpiry <= RENEWAL_ELIGIBILITY_WINDOW_DAYS) {
    return 'expiring'
  }
  return 'valid'
}

export function cambodiaToday (now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CAMBODIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find(candidate => candidate.type === type)?.value
    if (value === undefined) {
      throw new Error(`Missing Cambodia ${type}.`)
    }
    return value
  }

  return `${part('year')}-${part('month')}-${part('day')}`
}

function calendarDayNumber (date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 86_400_000
}
