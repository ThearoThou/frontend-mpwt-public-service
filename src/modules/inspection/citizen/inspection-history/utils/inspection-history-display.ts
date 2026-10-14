import type { CitizenInspectionResult } from '../types/inspection-history.types'

export const SEEDED_LEFT_FRONT_BRAKE_REASON = 'The left front service brake efficiency is below the permitted threshold.'

const knownFailureReasonsKh = new Map<string, string>([
  [SEEDED_LEFT_FRONT_BRAKE_REASON, 'ប្រសិទ្ធភាពហ្វ្រាំងសេវាកង់មុខខាងឆ្វេង ទាបជាងកម្រិតដែលបានអនុញ្ញាត។'],
])

export function inspectionResultLabel (result: CitizenInspectionResult, translate: (key: string) => string): string {
  return translate(result === 'PASS' ? 'inspection_history_passed' : 'inspection_history_failed')
}

/** Known system reasons are localized; arbitrary administrator-entered text is preserved verbatim. */
export function knownInspectionFailureReasonLabel (reason: string | null, locale: string): string {
  if (!reason) {
    return '—'
  }
  const normalized = reason.trim()
  if (locale === 'kh') {
    return knownFailureReasonsKh.get(normalized) ?? normalized
  }
  return normalized
}

export function formatInspectionHistoryDate (value: string | null, locale: string): string {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  if (locale === 'kh') {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Phnom_Penh',
    }).format(date)
  }

  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Phnom_Penh',
  }).format(date)
}
