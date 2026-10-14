import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const detailsUrl = new URL('../src/modules/inspection/citizen/applications/ApplicationDetailsView.vue', import.meta.url)
const listUrl = new URL('../src/modules/inspection/citizen/applications/ApplicationListView.vue', import.meta.url)

test('My Applications correction actions use the direct correction deep link', async () => {
  const source = await readFile(listUrl, 'utf8')
  assert.match(source, /correctionApplicationRoute\(application\.id\)/u)
  assert.match(source, /application\.status === 'CORRECTION_REQUIRED'/u)
  assert.match(source, /<v-btn[\s\S]*correctionStatusAriaLabel/u)
})

test('Application Details resolves and focuses the stable correction destination', async () => {
  const source = await readFile(detailsUrl, 'utf8')
  assert.match(source, /id="submitted-documents"/u)
  assert.match(source, /scrollIntoView\(\{ behavior: 'auto', block: 'start' \}\)/u)
  assert.match(source, /focus\(\{ preventScroll: true \}\)/u)
  assert.match(source, /await nextTick\(\)[\s\S]*await nextTick\(\)/u)
  assert.match(source, /route\.query\.focus === 'correction'/u)
})

test('replacement actions use centralized correction-document eligibility', async () => {
  const source = await readFile(detailsUrl, 'utf8')
  assert.match(source, /current\.status === 'REJECTED' \|\| isPendingReplacementOfRejectedDocument/u)
  assert.doesNotMatch(source, /inspection_application_correction_replacement_uploaded/u)
  assert.match(source, /inspection_application_correction_change_image/u)
  assert.match(source, /inspection_application_correction_replace_file/u)
})

test('resubmit stays explicit until no current rejected documents remain', async () => {
  const source = await readFile(detailsUrl, 'utf8')
  const uploadBody = source.slice(source.indexOf('async function uploadReplacement'), source.indexOf('async function downloadDocument'))
  assert.match(source, /remainingRejectedDocuments\.value\.length === 0/u)
  assert.match(source, /:disabled="!canResubmit \|\| uploadingTypes\.length > 0"/u)
  assert.doesNotMatch(uploadBody, /inspectionApplicationService\.resubmit/u)
})
