export interface KhmerNameParts {
  familyName: string
  givenName: string
}

export function combineKhmerName (familyName: string, givenName: string): string {
  return `${familyName.trim()} ${givenName.trim()}`.trim()
}

export function splitKhmerName (fullName: string | null | undefined): KhmerNameParts {
  const normalized = fullName?.trim() ?? ''
  const separatorIndex = normalized.search(/\s/u)

  if (separatorIndex < 0) {
    return { familyName: normalized, givenName: '' }
  }

  return {
    familyName: normalized.slice(0, separatorIndex).trim(),
    givenName: normalized.slice(separatorIndex).trim(),
  }
}
