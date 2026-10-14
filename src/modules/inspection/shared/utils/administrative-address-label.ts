const localizedAdministrativeAddresses: Record<string, { en: string, kh: string }> = {
  'Sangkat Boeung Keng Kang Ti Muoy, Khan Boeung Keng Kang, Phnom Penh': {
    en: 'Sangkat Boeung Keng Kang Ti Muoy, Khan Boeung Keng Kang, Phnom Penh',
    kh: 'សង្កាត់បឹងកេងកងទី១, ខណ្ឌបឹងកេងកង, រាជធានីភ្នំពេញ',
  },
}

export function formatAdministrativeAddress (value: string | null | undefined, locale: string): string {
  if (!value) {
    return '—'
  }

  const normalized = value.trim()
  const address = localizedAdministrativeAddresses[normalized]
  return address ? address[locale === 'kh' ? 'kh' : 'en'] : normalized
}
