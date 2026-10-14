import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const flow = read('../src/modules/inspection/citizen/renewal/composables/use-renewal-entry-flow.ts')
const action = read('../src/modules/inspection/citizen/renewal/utils/renewal-entry-action.ts')
const confirmationDialog = read('../src/modules/inspection/citizen/renewal/components/RenewalStartConfirmationDialog.vue')
const english = JSON.parse(read('../src/plugins/i18n/locales/en.json'))
const khmer = JSON.parse(read('../src/plugins/i18n/locales/kh.json'))
const progress = read('../src/modules/inspection/citizen/applications/components/ApplicationProgressTab.vue')
const details = read('../src/modules/inspection/citizen/applications/ApplicationDetailsView.vue')
const summaryStatus = read('../src/modules/inspection/citizen/applications/utils/citizen-application-status.ts')
const vehicleCard = read('../src/modules/inspection/citizen/vehicles/components/CitizenVehicleCard.vue')
const renewalEntryView = read('../src/modules/inspection/citizen/renewal/RenewalEntryView.vue')
const entrySurfaces = [
  read('../src/modules/inspection/citizen/dashboard/DashboardView.vue'),
  read('../src/modules/inspection/citizen/vehicles/VehicleListView.vue'),
  read('../src/modules/inspection/citizen/vehicles/VehicleDetailsView.vue'),
  details,
]

test('terminal history does not block a new renewal while legacy active states do', () => {
  for (const status of ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUIRED', 'APPROVED']) {
    assert.match(action, new RegExp(`'${status}'`))
  }
  for (const status of ['COMPLETED', 'REJECTED', 'CANCELLED']) {
    assert.doesNotMatch(action.match(/const UNFINISHED_APPLICATION_STATUSES[\s\S]*?\]\)/u)?.[0] ?? '', new RegExp(`'${status}'`))
  }
})

test('vehicle actions distinguish renew, draft continuation, tracking, and correction', () => {
  assert.match(action, /application === undefined[\s\S]*inspection_dashboard_renew_vehicle/u)
  assert.match(action, /application\.status === 'DRAFT'[\s\S]*inspection_renewal_continue/u)
  assert.match(action, /application\.status === 'CORRECTION_REQUIRED'[\s\S]*inspection_application_correct_documents/u)
  assert.match(action, /kind: 'track'[\s\S]*inspection_renewal_track_application/u)
  assert.equal(english.inspection_dashboard_renew_vehicle, 'Renew')
  assert.equal(khmer.inspection_dashboard_renew_vehicle, 'បន្តសុពលភាព')
  assert.equal(english.inspection_renewal_continue, 'Continue Renewal')
  assert.equal(khmer.inspection_renewal_continue, 'បន្តពាក្យសុំ')
  assert.equal(english.inspection_renewal_track_application, 'Track application')
  assert.equal(khmer.inspection_renewal_track_application, 'តាមដានពាក្យសុំ')
  assert.equal(english.inspection_application_correct_documents, 'Correct documents')
  assert.equal(khmer.inspection_application_correct_documents, 'កែតម្រូវឯកសារ')
})

test('all submitted and later unfinished states use Track application', () => {
  const unfinishedStatuses = action.match(/const UNFINISHED_APPLICATION_STATUSES[\s\S]*?\]\)/u)?.[0] ?? ''
  for (const status of ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED']) {
    assert.match(unfinishedStatuses, new RegExp(`'${status}'`))
  }
  const specializedBranches = action.match(/if \(application\.status === 'DRAFT'\)[\s\S]*?if \(application\.status === 'EXPIRED'\)/u)?.[0] ?? ''
  for (const status of ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED']) {
    assert.doesNotMatch(specializedBranches, new RegExp(String.raw`application\.status === '${status}'`))
  }
  assert.match(action, /return \{\s*kind: 'track',[\s\S]*labelKey: 'inspection_renewal_track_application'/u)
})

test('all renewal entry surfaces use the shared authoritative flow', () => {
  for (const source of entrySurfaces) {
    assert.match(source, /useRenewalEntryFlow/)
    assert.match(source, /startOrContinueRenewal/)
  }
  assert.match(flow, /resolveRenewalEntryDecision\(applications, vehicle\.id, vehicle\.inspectionExpiryDate\)/)
  assert.match(flow, /UNFINISHED_APPLICATION_ALREADY_EXISTS/)
  assert.match(flow, /navigateToActiveRenewal/)
  assert.match(flow, /application\.status === 'DRAFT'[\s\S]*renewal\/documents/u)
  assert.match(flow, /application\.status === 'CORRECTION_REQUIRED'[\s\S]*correctionApplicationRoute/u)
  assert.match(flow, /applications\/\$\{application\.id\}/u)
})

test('only valid vehicles confirm while expiring and expired vehicles start directly', () => {
  assert.match(action, /resolveRenewalEntryDecision[\s\S]*findUnfinishedApplication[\s\S]*kind: 'continue'[\s\S]*renewalRequiresConfirmation/u)
  assert.match(flow, /decision\.kind === 'confirm'[\s\S]*confirmationOpen\.value = true/u)
  assert.match(flow, /confirmationOpen\.value = true[\s\S]*await createRenewal\(vehicle\.id\)/u)
  assert.match(flow, /decision\.kind === 'continue'[\s\S]*navigateToActiveRenewal\(decision\.application\)/u)
  assert.match(renewalEntryView, /renewalRequiresConfirmation\(matchedVehicle\.value\.inspectionExpiryDate\)[\s\S]*confirmationOpen\.value = true[\s\S]*await startRenewal\(\)/u)
  assert.doesNotMatch(renewalEntryView, /inspectionExpiryState\(matchedVehicle\.value\.inspectionExpiryDate\) !== 'expired'/u)
})

test('vehicle cards override terminal history only when expiry requires action', () => {
  assert.match(summaryStatus, /ACTIVE_CYCLE_STATUSES\.has\(application\.status\)[\s\S]*resolveCitizenApplicationSummaryStatus\(application\)/u)
  assert.match(summaryStatus, /expiryState === 'expiring'[\s\S]*color: 'warning'[\s\S]*inspection_renewal_action_required/u)
  assert.match(summaryStatus, /expiryState === 'expired'[\s\S]*color: 'error'[\s\S]*inspection_renewal_action_required/u)
  assert.match(summaryStatus, /application === undefined[\s\S]*\? undefined[\s\S]*resolveCitizenApplicationSummaryStatus\(application\)/u)
  for (const source of entrySurfaces.slice(0, 3)) {
    assert.match(source, /resolveCitizenVehicleRenewalStatus/u)
  }
  assert.doesNotMatch(entrySurfaces[3], /resolveCitizenVehicleRenewalStatus/u)
})

test('zero-history valid vehicles hide only the renewal status presentation', () => {
  assert.match(summaryStatus, /application === undefined[\s\S]*\? undefined/u)
  assert.match(vehicleCard, /renewalStatus\?: Status/u)
  assert.match(vehicleCard, /v-if="renewalStatus"/u)
  assert.match(action, /application === undefined[\s\S]*inspection_dashboard_renew_vehicle/u)
  assert.match(flow, /decision\.kind === 'confirm'[\s\S]*confirmationOpen\.value = true/u)
})

test('card summary derives the active renewal phase instead of using In progress', () => {
  assert.match(summaryStatus, /case 'CORRECTION_REQUIRED'.*color: 'warning'.*inspection_application_status_correction_required/u)
  assert.match(summaryStatus, /application\.inspection\?\.result === 'PASS'[\s\S]*inspection_application_status_sticker_issuance/u)
  assert.match(summaryStatus, /application\.payment\?\.status === 'CONFIRMED'[\s\S]*inspection_application_status_waiting_vehicle_inspection/u)
  assert.match(summaryStatus, /return \{ color: 'warning', icon: 'mdi-cash-clock', labelKey: 'inspection_application_status_awaiting_payment' \}/u)
  assert.doesNotMatch(summaryStatus, /inspection_applications_filter_in_progress/u)
  assert.match(summaryStatus, /expiryState === 'expiring'[\s\S]*color: 'warning'[\s\S]*inspection_renewal_action_required/u)
})

test('completed progress shows a separate Renew Again action without adding a step', () => {
  assert.match(progress, /application\.status === 'COMPLETED'/)
  assert.match(progress, /emit\('renew'\)/)
  assert.match(details, /completedActiveRenewal/)
  assert.match(details, /renewalEntryAction\(completedActiveRenewal\.value\)/)
  assert.match(details, /@renew="renewCompletedApplication"/)
  assert.equal(english.inspection_renewal_renew_again, 'Renew again')
  assert.equal(khmer.inspection_renewal_renew_again, 'បន្តសុពលភាពម្តងទៀត')
})

test('cancelled progress is an application terminal outcome, not an inspection failure', () => {
  assert.match(progress, /props\.application\.status === 'CANCELLED' \? 'CANCELLED' : 'FAILED'/u)
  assert.match(progress, /v-else-if="step\.state === 'CANCELLED'" icon="mdi-cancel"/u)
  assert.match(progress, /primaryInspection\?\.result === 'FAIL'[\s\S]*state: 'FAILED'/u)
  assert.match(progress, /index === failure\.index \? failure\.state : 'UNREACHABLE_AFTER_FAILURE'/u)
})

test('rejected progress is shown at document review after the physical workflow', () => {
  assert.match(progress, /props\.application\.status === 'REJECTED'[\s\S]*index: 4/u)
  assert.match(progress, /state: 'REJECTED'/u)
  assert.match(progress, /v-else-if="step\.state === 'REJECTED'" icon="mdi-close-circle-outline"/u)
})

test('only a real draft shows Not submitted yet and Continue Renewal', () => {
  assert.match(action, /application === undefined[\s\S]*inspection_dashboard_renew_vehicle/u)
  assert.match(action, /application\.status === 'DRAFT'[\s\S]*inspection_renewal_continue/u)
  assert.equal(english.inspection_application_status_not_submitted, 'Not submitted yet')
  assert.equal(khmer.inspection_application_status_not_submitted, 'មិនទាន់បានដាក់ស្នើ')
  assert.match(summaryStatus, /application\.status === 'DRAFT'[\s\S]*inspection_application_status_not_submitted/u)
})

test('the shared confirmation dialog creates nothing when cancelled and uses the required copy', () => {
  assert.match(confirmationDialog, /@click="close"/)
  assert.match(confirmationDialog, /@click="emit\('confirm'\)"/)
  assert.doesNotMatch(confirmationDialog, /createDraft/u)
  assert.equal(english.inspection_renewal_confirm_title, 'Confirm')
  assert.equal(english.inspection_renewal_confirm_message, 'Do you want to apply to renew your vehicle inspection?')
  assert.equal(khmer.inspection_renewal_confirm_title, 'បញ្ជាក់')
  assert.equal(khmer.inspection_renewal_confirm_message, 'តើអ្នកចង់ដាក់ពាក្យបន្តសុពលភាព\nឆៀកឡើងវិញមែនទេ?')
  assert.equal(khmer.inspection_renewal_confirm_no, 'អត់ទេ')
  assert.equal(khmer.inspection_renewal_confirm_yes, 'យល់ព្រម')
})
