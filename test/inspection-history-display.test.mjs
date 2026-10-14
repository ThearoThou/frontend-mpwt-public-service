import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatInspectionHistoryDate,
  inspectionResultLabel,
  knownInspectionFailureReasonLabel,
  SEEDED_LEFT_FRONT_BRAKE_REASON,
} from '../src/modules/inspection/citizen/inspection-history/utils/inspection-history-display.ts'

const labels = {
  en: { inspection_history_passed: 'Pass', inspection_history_failed: 'Fail' },
  kh: { inspection_history_passed: 'ជាប់', inspection_history_failed: 'មិនជាប់' },
}

test('localizes PASS and FAIL labels', () => {
  for (const locale of ['en', 'kh']) {
    const translate = key => labels[locale][key]
    assert.equal(inspectionResultLabel('PASS', translate), labels[locale].inspection_history_passed)
    assert.equal(inspectionResultLabel('FAIL', translate), labels[locale].inspection_history_failed)
  }
})

test('localizes the known seeded failure reason in Khmer', () => {
  assert.equal(
    knownInspectionFailureReasonLabel(SEEDED_LEFT_FRONT_BRAKE_REASON, 'kh'),
    'ប្រសិទ្ធភាពហ្វ្រាំងសេវាកង់មុខខាងឆ្វេង ទាបជាងកម្រិតដែលបានអនុញ្ញាត។',
  )
  assert.equal(knownInspectionFailureReasonLabel(SEEDED_LEFT_FRONT_BRAKE_REASON, 'en'), SEEDED_LEFT_FRONT_BRAKE_REASON)
})

test('preserves unknown free-text failure reasons', () => {
  assert.equal(knownInspectionFailureReasonLabel('Custom inspector note', 'kh'), 'Custom inspector note')
})

test('formats Khmer dates numerically and English dates with a short month', () => {
  assert.equal(formatInspectionHistoryDate('2026-09-13T02:00:00.000Z', 'kh'), '13/09/2026')
  assert.equal(formatInspectionHistoryDate('2026-09-13T02:00:00.000Z', 'en'), 'Sep 13, 2026')
})
