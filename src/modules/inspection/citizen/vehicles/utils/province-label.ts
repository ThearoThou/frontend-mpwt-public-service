const provinceNames: Record<string, { en: string, kh: string }> = {
  ភ្នំពេញ: { en: 'Phnom Penh', kh: 'ភ្នំពេញ' }, កណ្ដាល: { en: 'Kandal', kh: 'កណ្ដាល' },
  សៀមរាប: { en: 'Siem Reap', kh: 'សៀមរាប' }, បាត់ដំបង: { en: 'Battambang', kh: 'បាត់ដំបង' },
  កំពង់ចាម: { en: 'Kampong Cham', kh: 'កំពង់ចាម' }, តាកែវ: { en: 'Takeo', kh: 'តាកែវ' },
  កំពត: { en: 'Kampot', kh: 'កំពត' }, ព្រះសីហនុ: { en: 'Preah Sihanouk', kh: 'ព្រះសីហនុ' },
  ពោធិ៍សាត់: { en: 'Pursat', kh: 'ពោធិ៍សាត់' }, កំពង់ស្ពឺ: { en: 'Kampong Speu', kh: 'កំពង់ស្ពឺ' },
  កែប: { en: 'Kep', kh: 'កែប' }, ស្វាយរៀង: { en: 'Svay Rieng', kh: 'ស្វាយរៀង' },
  កំពង់ធំ: { en: 'Kampong Thom', kh: 'កំពង់ធំ' }, បន្ទាយមានជ័យ: { en: 'Banteay Meanchey', kh: 'បន្ទាយមានជ័យ' },
  ក្រចេះ: { en: 'Kratie', kh: 'ក្រចេះ' }, រតនគិរី: { en: 'Ratanakiri', kh: 'រតនគិរី' },
  ព្រៃវែង: { en: 'Prey Veng', kh: 'ព្រៃវែង' }, ឧត្តរមានជ័យ: { en: 'Oddar Meanchey', kh: 'ឧត្តរមានជ័យ' },
  កោះកុង: { en: 'Koh Kong', kh: 'កោះកុង' }, ត្បូងឃ្មុំ: { en: 'Tbong Khmum', kh: 'ត្បូងឃ្មុំ' },
}

export function formatProvince (value: string | null | undefined, locale: string): string {
  if (!value) {
    return '—'
  }
  const province = provinceNames[value.trim()]
  return province ? province[locale === 'kh' ? 'kh' : 'en'] : value
}

/** Converts a known English province name to the canonical Khmer value used by APIs. */
export function normalizeProvinceSearch (value: string): string {
  let normalized = value.trim()
  for (const [kh, names] of Object.entries(provinceNames)) {
    const expression = new RegExp(String.raw`\b${names.en.replace(/ /g, String.raw`\s+`)}\b`, 'gi')
    normalized = normalized.replace(expression, kh)
  }
  return normalized
}

/** Every localized name for a stored province, for client-side visible-plate search. */
export function provinceSearchLabels (value: string | null | undefined): string[] {
  if (!value) {
    return []
  }
  const province = provinceNames[value.trim()]
  return province ? [province.kh, province.en] : [value]
}
