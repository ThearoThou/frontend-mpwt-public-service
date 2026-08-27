export interface CitizenName {
  nameKh?: string | null
  nameEn?: string | null
}

function presentName (value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

export function displayCitizenName (name: CitizenName | null | undefined, locale: string, fallback = ''): string {
  const nameKh = presentName(name?.nameKh)
  const nameEn = presentName(name?.nameEn)
  return (locale === 'kh' ? nameKh || nameEn : nameEn || nameKh) || fallback
}

export function formatOfficialApplicantName (name: CitizenName | null | undefined): string {
  const nameKh = presentName(name?.nameKh)
  const nameEn = presentName(name?.nameEn)
  return nameKh && nameEn ? `${nameKh} / ${nameEn}` : nameKh || nameEn || '—'
}
