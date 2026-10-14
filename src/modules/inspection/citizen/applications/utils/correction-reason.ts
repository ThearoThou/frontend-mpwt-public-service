type Translate = (key: string) => string

const KNOWN_REASON_KEYS: Record<string, string> = {
  'the previous inspection certificate scan is not sufficiently clear.': 'inspection_application_correction_reason_previous_certificate_unclear',
  'the submitted registration information could not be verified.': 'inspection_application_rejection_reason_registration_not_verified',
}

export function localizedApplicationReason (reason: string | null, locale: string, t: Translate): string | null {
  if (reason === null || locale !== 'kh') {
    return reason
  }
  const key = KNOWN_REASON_KEYS[reason.trim().toLowerCase()]
  return key === undefined ? reason : t(key)
}

export function localizedCorrectionReason (reason: string | null, locale: string, t: Translate): string | null {
  return localizedApplicationReason(reason, locale, t)
}
