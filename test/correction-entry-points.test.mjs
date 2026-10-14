import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../src/modules/inspection/citizen/', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')

test('vehicle correction CTA uses the shared correction deep link', async () => {
  const [source, action, flow] = await Promise.all([
    read('vehicles/VehicleListView.vue'),
    read('renewal/utils/renewal-entry-action.ts'),
    read('renewal/composables/use-renewal-entry-flow.ts'),
  ])
  assert.match(source, /startOrContinueRenewal\(vehicle\)/u)
  assert.match(action, /application\.status === 'CORRECTION_REQUIRED'/u)
  assert.match(action, /inspection_application_correct_documents/u)
  assert.match(action, /mdi-file-edit-outline/u)
  assert.match(flow, /router\.push\(correctionApplicationRoute\(application\.id\)\)/u)
})

test('Step 05 correction action emits through button semantics to the existing focus handler', async () => {
  const [progress, details] = await Promise.all([
    read('applications/components/ApplicationProgressTab.vue'),
    read('applications/ApplicationDetailsView.vue'),
  ])
  assert.match(progress, /<button[\s\S]*v-if="step\.actionRequired"[\s\S]*type="button"[\s\S]*@click="emit\('correction'\)"/u)
  assert.match(progress, /:focus-visible/u)
  assert.match(details, /@correction="openCorrectionArea\(\)"/u)
  assert.match(details, /firstRejected === undefined[\s\S]*submittedDocumentsRef\.value/u)
})

test('pending correction replacements use history eligibility without restoring the banner', async () => {
  const source = await read('applications/ApplicationDetailsView.vue')
  assert.match(source, /isPendingReplacementOfRejectedDocument\(current, documentHistoryFor\(type\)\)/u)
  assert.match(source, /listDocumentHistory/u)
  assert.doesNotMatch(source, /isReplacementUploaded/u)
  assert.doesNotMatch(source, /inspection_application_correction_replacement_uploaded/u)
})

test('correction helper traces only the replacement chain back to a rejected version', async () => {
  const source = await read('applications/utils/correction-document.ts')
  assert.match(source, /current\.status !== 'PENDING' \|\| current\.replacesDocumentId === null/u)
  assert.match(source, /predecessor\.status === 'REJECTED'/u)
  assert.match(source, /predecessorId = predecessor\.replacesDocumentId/u)
})

test('known seeded correction reason is localized while unknown text remains unchanged', async () => {
  const source = await read('applications/utils/correction-reason.ts')
  assert.match(source, /the previous inspection certificate scan is not sufficiently clear\./u)
  assert.match(source, /locale !== 'kh'\) \{[\s\S]*return reason/u)
  assert.match(source, /key === undefined \? reason : t\(key\)/u)
})

test('submitted documents keeps correction guidance compact', async () => {
  const source = await read('applications/ApplicationDetailsView.vue')
  assert.doesNotMatch(source, /inspection_application_correction_remaining/u)
  assert.doesNotMatch(source, /inspection_application_correction_documents_description/u)
  assert.match(source, /class="document-row__reason"/u)
  assert.match(source, /class="document-row__icon-action"[\s\S]*icon="mdi-download-outline"/u)
  assert.doesNotMatch(source, /inspection_application_correction_resubmit_hint/u)
})

test('submitted image documents use secure blob thumbnails and file-aware actions', async () => {
  const source = await read('applications/ApplicationDetailsView.vue')
  assert.match(source, /function filePresentation/u)
  assert.match(source, /'IMAGE' \| 'PDF' \| 'GENERIC'/u)
  assert.match(source, /inspectionApplicationService\.downloadDocument\(applicationId\.value, documentItem\.id\)/u)
  assert.match(source, /URL\.createObjectURL/u)
  assert.match(source, /URL\.revokeObjectURL/u)
  assert.match(source, /class="document-row__thumbnail"/u)
  assert.match(source, /<img v-if="imagePreviewUrl\(type\)"[\s\S]*@error="thumbnailDecodeFailed\(type\)"/u)
  assert.match(source, /inspection_application_document_download_image/u)
  assert.match(source, /inspection_application_document_download_pdf/u)
  assert.match(source, /inspection_application_document_download_file/u)
})

test('only a current rejected document receives the rejected card treatment', async () => {
  const source = await read('applications/ApplicationDetailsView.vue')
  assert.match(source, /'document-row--rejected': documentFor\(type\)\?\.status === 'REJECTED'/u)
  assert.doesNotMatch(source, /document-row--correction/u)
  assert.match(source, /correctionReasonLabelKey/u)
})

test('image thumbnails are file-type driven and independent from document status', async () => {
  const source = await read('applications/ApplicationDetailsView.vue')
  const presentation = source.match(/function filePresentation[\s\S]*?\n {2}\}/u)?.[0] ?? ''
  for (const status of ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CORRECTION_REQUIRED']) {
    assert.doesNotMatch(presentation, new RegExp(status))
  }
  assert.match(source, /loadedDocuments\.map\(documentItem => loadImagePreview\(documentItem\)\)/u)
  assert.match(source, /filePresentation\(documentFor\(type\)!\) === 'IMAGE'/u)
  assert.match(source, /thumbnailDecodeFailed\(type\)/u)
  assert.match(source, /mdi-image-broken-variant/u)
  assert.match(source, /object-fit: contain/u)
})

test('replacement authorization remains separate from thumbnail presentation', async () => {
  const source = await read('applications/ApplicationDetailsView.vue')
  assert.match(source, /function canReplaceDocument[\s\S]*current\.status === 'REJECTED'/u)
  assert.match(source, /isPendingReplacementOfRejectedDocument/u)
  assert.match(source, /v-if="canReplaceDocument\(type\)"/u)
  assert.doesNotMatch(source.match(/function filePresentation[\s\S]*?\n {2}\}/u)?.[0] ?? '', /canReplaceDocument/u)
})
