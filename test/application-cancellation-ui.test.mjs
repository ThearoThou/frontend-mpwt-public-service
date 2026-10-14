import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const detailsUrl = new URL('../src/modules/inspection/citizen/applications/ApplicationDetailsView.vue', import.meta.url)
const dialogUrl = new URL('../src/modules/inspection/citizen/applications/components/CancelApplicationDialog.vue', import.meta.url)
const serviceUrl = new URL('../src/modules/inspection/citizen/applications/services/application.service.ts', import.meta.url)

const detailsSource = await readFile(detailsUrl, 'utf8')
const dialogSource = await readFile(dialogUrl, 'utf8')
const serviceSource = await readFile(serviceUrl, 'utf8')

test('cancel visibility is limited to drafts and unpaid submitted applications', () => {
  assert.match(detailsSource, /status === 'DRAFT'\) return true/u)
  assert.match(detailsSource, /status !== 'SUBMITTED'/u)
  assert.match(detailsSource, /payment === null \|\| detailedStatusFacts\.value\.payment\.status === 'PENDING'/u)
  assert.doesNotMatch(detailsSource, /status === 'CORRECTION_REQUIRED'\) return true/u)
  assert.match(detailsSource, /v-if="canCancelApplication"[\s\S]*inspection_application_cancel/u)
})

test('cancel dialog is compact, dismissible, and destructive', () => {
  assert.match(detailsSource, /@click="openCancellationDialog"/u)
  assert.match(detailsSource, /<CancelApplicationDialog[\s\S]*@close="closeCancellationDialog"[\s\S]*@confirm="confirmCancellation"/u)
  assert.match(dialogSource, /icon="mdi-close"[\s\S]*@click="close"/u)
  assert.doesNotMatch(dialogSource, /v-textarea/u)
  const closeBody = detailsSource.slice(detailsSource.indexOf('function closeCancellationDialog'), detailsSource.indexOf('async function confirmCancellation'))
  assert.doesNotMatch(closeBody, /inspectionApplicationService/u)
  assert.match(dialogSource, /color="error" :loading="loading"/u)
  assert.doesNotMatch(`${detailsSource}\n${dialogSource}`, /password|otp/iu)
})

test('cancel dialog follows the compact valid-renewal confirmation pattern', () => {
  assert.match(dialogSource, /<v-dialog[\s\S]*max-width="380"/u)
  assert.match(dialogSource, /cancel-confirmation__header[\s\S]*cancel-confirmation__title[\s\S]*cancel-confirmation__close/u)
  assert.match(dialogSource, /border-bottom: 1px solid #e2e4ea/u)
  assert.match(dialogSource, /grid-template-columns: 36px 1fr 36px/u)
  assert.match(dialogSource, /cancel-confirmation__actions/u)
})

test('cancel request is single-flight and uses the existing endpoint', () => {
  assert.match(detailsSource, /cancellationSubmitting\.value\) return/u)
  assert.match(detailsSource, /inspectionApplicationService\.cancel\(application\.value\.id\)/u)
  assert.match(serviceSource, /post<ApiDataResponse<RenewalApplication>>\(`\/applications\/\$\{applicationId\}\/cancel`/u)
})

test('success and authoritative cannot-cancel responses refresh application state', () => {
  assert.match(detailsSource, /await inspectionApplicationService\.cancel[\s\S]*await load\(\)[\s\S]*inspection_application_cancel_success/u)
  assert.match(detailsSource, /APPLICATION_CANNOT_CANCEL[\s\S]*await load\(\)[\s\S]*inspection_application_cancel_no_longer_available/u)
})
