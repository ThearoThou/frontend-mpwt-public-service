import type { Vehicle } from '../types/vehicle.types'

/** Returns the authoritative category supplied by the API; never infers one from vehicle class. */
export function resolveInspectionCategoryLabel (category: Vehicle['inspectionCategory'], locale: string): string {
  if (category === null) {
    return '—'
  }
  return locale === 'kh'
    ? category.nameKh || category.nameEn || '—'
    : category.nameEn || category.nameKh || '—'
}
