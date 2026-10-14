import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveInspectionCategoryLabel } from '../src/modules/inspection/citizen/vehicles/utils/inspection-category-label.ts'

const historicalCategory = {
  id: 'category-1526',
  code: 'MPWT0011526',
  nameKh: 'រថយន្តទេសចរណ៍ ៥ ដល់ ៩ កៅអី',
  nameEn: 'Family passenger vehicle, 5–9 seats, non-commercial',
}

test('uses the historical category Khmer name', () => {
  assert.equal(resolveInspectionCategoryLabel(historicalCategory, 'kh'), historicalCategory.nameKh)
})

test('uses the historical category English name', () => {
  assert.equal(resolveInspectionCategoryLabel(historicalCategory, 'en'), historicalCategory.nameEn)
})

test('does not fabricate a Family Passenger Vehicle (2A) fallback', () => {
  assert.equal(resolveInspectionCategoryLabel(null, 'kh'), '—')
  assert.equal(resolveInspectionCategoryLabel(null, 'en'), '—')
})
