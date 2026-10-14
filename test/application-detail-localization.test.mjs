import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const statusSource = readFileSync(
  new URL('../src/modules/inspection/citizen/applications/utils/citizen-application-status.ts', import.meta.url),
  'utf8',
)
const applicationDetailsSource = readFileSync(
  new URL('../src/modules/inspection/citizen/applications/ApplicationDetailsView.vue', import.meta.url),
  'utf8',
)
const progressSource = readFileSync(
  new URL('../src/modules/inspection/citizen/applications/components/ApplicationProgressTab.vue', import.meta.url),
  'utf8',
)
const english = JSON.parse(readFileSync(new URL('../src/plugins/i18n/locales/en.json', import.meta.url), 'utf8'))
const khmer = JSON.parse(readFileSync(new URL('../src/plugins/i18n/locales/kh.json', import.meta.url), 'utf8'))

test('known application-detail status colours use dedicated localized labels', () => {
  const statusKeys = [...statusSource.matchAll(/labelKey: '([^']+)'/g)].map(match => match[1])

  for (const key of new Set(statusKeys)) {
    assert.equal(typeof english[key], 'string', `Missing English label: ${key}`)
    assert.equal(typeof khmer[key], 'string', `Missing Khmer label: ${key}`)
    assert.notEqual(khmer[key].trim(), '', `Empty Khmer label: ${key}`)
  }
})

test('the full Khmer inspection category can wrap inside application details', () => {
  assert.match(applicationDetailsSource, /\.vehicle-info-list__type dd \{[^}]*white-space: normal;/)
  assert.doesNotMatch(applicationDetailsSource, /\.vehicle-info-list__type dd \{[^}]*white-space: nowrap;/)
})

test('the known rejection reason is localized in the Khmer application timeline', () => {
  assert.match(progressSource, /localizedApplicationReason\(props\.application\.currentRejectionReason, locale\.value, t\)/)
  assert.equal(english.inspection_application_rejection_reason_registration_not_verified, 'The submitted registration information could not be verified.')
  assert.equal(khmer.inspection_application_rejection_reason_registration_not_verified, 'ព័ត៌មានចុះបញ្ជីដែលបានដាក់ស្នើ មិនអាចផ្ទៀងផ្ទាត់បានទេ។')
})

test('citizen status resolver derives workflow facts instead of displaying active raw lifecycle labels', () => {
  for (const label of [
    'inspection_application_status_not_submitted',
    'inspection_application_status_awaiting_payment',
    'inspection_application_status_waiting_vehicle_inspection',
    'inspection_application_status_sticker_issuance',
    'inspection_application_status_document_review',
    'inspection_application_status_certificate_issuance',
    'inspection_application_status_completed',
    'inspection_renewal_status_correction_required',
    'inspection_renewal_status_inspection_failed',
    'inspection_application_status_rejected',
    'inspection_application_status_cancelled',
    'inspection_renewal_status_expired',
  ]) {
    assert.match(statusSource, new RegExp(`labelKey: '${label}'`))
  }

  assert.match(statusSource, /application\.status === 'SUBMITTED' && application\.payment\?\.status === 'PENDING'\)[\s\S]*inspection_application_status_awaiting_payment/)
  assert.match(statusSource, /facts\?\.payment\?\.status === 'CONFIRMED'[\s\S]*inspection_application_status_waiting_vehicle_inspection/)
  assert.match(statusSource, /facts\?\.inspection\?\.inspection\?\.result === 'PASS'[\s\S]*inspection_application_status_sticker_issuance/)
  assert.match(statusSource, /facts\?\.sticker\?\.sticker\?\.issuedAt !== undefined[\s\S]*inspection_application_status_document_review/)
  assert.match(statusSource, /documentsApproved[\s\S]*inspection_application_status_certificate_issuance/)
  assert.doesNotMatch(statusSource, /return lifecycleStatuses\.(SUBMITTED|UNDER_REVIEW|APPROVED)/)
})

test('vehicle validity is calculated separately from the active renewal cycle', () => {
  assert.match(statusSource, /ACTIVE_CYCLE_STATUSES\.has\(application\.status\)[\s\S]*return resolveCitizenApplicationSummaryStatus\(application\)/)
  assert.match(statusSource, /const expiryState = inspectionExpiryState\(inspectionExpiryDate\)/)
  assert.match(statusSource, /application\.payment\?\.status === 'CONFIRMED'[\s\S]*inspection_application_status_waiting_vehicle_inspection/)
})
