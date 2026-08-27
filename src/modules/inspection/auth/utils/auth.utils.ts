import { isAxiosError } from 'axios'

type ApiErrorResponse = { code?: string }

export type InspectionAuthValidationIssue = string

export const INSPECTION_EMAIL_MAX_LENGTH = 254
export const INSPECTION_NAME_MAX_LENGTH = 150
export const INSPECTION_PASSWORD_MIN_LENGTH = 8
export const INSPECTION_PASSWORD_MAX_LENGTH = 128

export function isInspectionEmail (value: string): boolean {
  const [localPart, domain, extraPart] = value.split('@')
  return Boolean(localPart && domain && !extraPart && !value.includes(' ') && domain.includes('.'))
}

export function getInspectionEmailIssue (value: string): InspectionAuthValidationIssue | undefined {
  if (value.length > INSPECTION_EMAIL_MAX_LENGTH) {
    return 'inspection_email_maximum'
  }
  return isInspectionEmail(value) ? undefined : 'inspection_email'
}

export function isInspectionPhone (value: string): boolean {
  const normalized = value.replace(/[\s()-]/g, '')
  return /^(?:0\d{8,9}|\+855\d{8,9})$/.test(normalized)
}

export function isInspectionIdentifier (value: string): boolean {
  return isInspectionEmail(value) || isInspectionPhone(value)
}

export function getInspectionIdentifierIssue (value: string): InspectionAuthValidationIssue | undefined {
  if (!value) {
    return 'inspection_identifier'
  }
  if (value.includes('@') && value.length > INSPECTION_EMAIL_MAX_LENGTH) {
    return 'inspection_email_maximum'
  }
  return isInspectionIdentifier(value) ? undefined : 'inspection_identifier_invalid'
}

export function isKhmerName (value: string): boolean {
  return /[\u1780-\u17FF]/u.test(value) && !/[a-z]/i.test(value)
}

export function getKhmerNameIssue (value: string): InspectionAuthValidationIssue | undefined {
  if (!value) {
    return 'inspection_name_kh_required'
  }
  if (value.length > INSPECTION_NAME_MAX_LENGTH) {
    return 'inspection_name_kh_maximum'
  }
  return isKhmerName(value) ? undefined : 'inspection_name_kh_invalid'
}

export function isEnglishName (value: string): boolean {
  return /^[a-z][a-z .'-]*$/i.test(value)
}

export function getEnglishNameIssue (value: string): InspectionAuthValidationIssue | undefined {
  if (!value) {
    return undefined
  }
  if (value.length > INSPECTION_NAME_MAX_LENGTH) {
    return 'inspection_name_en_maximum'
  }
  return isEnglishName(value) ? undefined : 'inspection_name_en_invalid'
}

export function isVerificationCode (value: string): boolean {
  return /^\d{6}$/.test(value)
}

export function getVerificationCodeIssue (value: string): InspectionAuthValidationIssue | undefined {
  return isVerificationCode(value) ? undefined : 'inspection_verification_code_invalid'
}

export function getPasswordIssue (value: string): InspectionAuthValidationIssue | undefined {
  if (value.length < INSPECTION_PASSWORD_MIN_LENGTH) {
    return 'inspection_password_minimum'
  }
  if (value.length > INSPECTION_PASSWORD_MAX_LENGTH) {
    return 'inspection_password_maximum'
  }
  return undefined
}

export function getPasswordConfirmationIssue (password: string, confirmation: string): InspectionAuthValidationIssue | undefined {
  return password === confirmation ? undefined : 'inspection_password_mismatch'
}

export function getInspectionAuthError (error: unknown, fallback: string): string {
  if (!isAxiosError<ApiErrorResponse>(error)) {
    return fallback
  }
  const data = error.response?.data
  const messages: Record<string, string> = {
    AUTH_INVALID_CREDENTIALS: 'inspection_error_invalid_credentials',
    AUTH_ACCOUNT_DISABLED: 'inspection_error_account_disabled',
    AUTH_VERIFICATION_CODE_INVALID: 'inspection_error_invalid_code',
    AUTH_VERIFICATION_CODE_EXPIRED: 'inspection_error_expired_code',
    AUTH_VERIFICATION_ATTEMPTS_EXCEEDED: 'inspection_error_too_many_attempts',
    USER_IDENTIFIER_CONFLICT: 'inspection_error_identifier_conflict',
    CONFLICT: 'inspection_error_registration_conflict',
  }
  if (data?.code && messages[data.code]) {
    return messages[data.code]
  }
  return fallback
}

export function isSafeInspectionRedirect (redirect: unknown): redirect is string {
  return typeof redirect === 'string'
    && redirect.startsWith('/services/inspection/')
    && !redirect.startsWith('//')
    && !redirect.includes('\\\\')
    && !['login', 'register', 'verify', 'forgot-password', 'reset-password'].some(path => redirect.startsWith(`/services/inspection/${path}`))
}

export function inspectionRedirectOrDashboard (redirect: unknown): string {
  return isSafeInspectionRedirect(redirect) ? redirect : '/services/inspection/dashboard'
}
