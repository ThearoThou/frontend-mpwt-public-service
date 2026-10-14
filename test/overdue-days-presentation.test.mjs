import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { overdueDayBreakdown } from '../src/modules/inspection/citizen/renewal/utils/late-penalty-display.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const documents = read('../src/modules/inspection/citizen/renewal/RenewalDocumentsView.vue')
const english = JSON.parse(read('../src/plugins/i18n/locales/en.json'))
const khmer = JSON.parse(read('../src/plugins/i18n/locales/kh.json'))

test('separates actual overdue days from penalty days after the grace period', () => {
  assert.deepEqual(overdueDayBreakdown(40), { actualOverdueDays: 40, penaltyDays: 10 })
  assert.deepEqual(overdueDayBreakdown(18), { actualOverdueDays: 18, penaltyDays: 0 })
  assert.deepEqual(overdueDayBreakdown(30), { actualOverdueDays: 30, penaltyDays: 0 })
})

test('Step 1 renders overdue and penalty information only after expiry', () => {
  assert.match(documents, /overdueDayBreakdown\(feeEstimate\.value\.lateDays\)/u)
  assert.match(documents, /inspection_documents_overdue_days_value/u)
  assert.equal(khmer.inspection_documents_overdue_days, 'ចំនួនថ្ងៃលើសកំណត់')
  assert.equal(khmer.inspection_documents_overdue_days_value, '{penaltyDays} ថ្ងៃ (ជាក់ស្តែងលើស {actualOverdueDays} ថ្ងៃ)')
  assert.equal(english.inspection_documents_overdue_days_value, '{penaltyDays} days (actually {actualOverdueDays} days overdue)')
  assert.match(documents, /v-if="inspectionState === 'expired'" class="renewal-info-field"/u)
  assert.match(documents, /v-if="feeEstimate && inspectionState === 'expired'"/u)
})

test('Step 1 keeps the progress panel in a native sticky wrapper inside the full-height column', () => {
  assert.match(documents, /<div class="renewal-documents__layout">/u)
  assert.match(documents, /<aside class="renewal-documents__progress-column">/u)
  assert.match(documents, /<div class="renewal-documents__progress-sticky">[\s\S]*renewal-progress-card/u)
  assert.match(documents, /\.renewal-documents__layout \{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 2fr\) minmax\(280px, 1fr\);[^}]*overflow: visible;/u)
  assert.match(documents, /\.renewal-documents__progress-column \{[^}]*align-self: stretch;/u)
  assert.match(documents, /\.renewal-documents__progress-sticky \{[^}]*height: fit-content;[^}]*position: sticky;[^}]*top: 92px;/u)
  assert.doesNotMatch(documents, /renewal-progress-float-offset|translateY\(/u)
})
