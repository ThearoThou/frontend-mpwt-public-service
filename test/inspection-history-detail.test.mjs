import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const componentUrl = new URL('../src/modules/inspection/citizen/inspection-history/InspectionDetailView.vue', import.meta.url)

async function source () {
  return readFile(componentUrl, 'utf8')
}

test('renders a titled transaction-first inspection summary', async () => {
  const component = await source()
  assert.match(component, /inspection_history_details/u)
  assert.match(component, /inspection_history_transaction_number[\s\S]*inspection\.transactionNumber/u)
  assert.match(component, /inspection_history_application_reference[\s\S]*inspection\.referenceNumber/u)
})

test('keeps PASS-only expiry and certificate behavior', async () => {
  const component = await source()
  assert.match(component, /inspection.result === 'PASS' && inspection.validUntil/u)
  assert.match(component, /inspection.result === 'PASS' && certificate/u)
})

test('shows the result badge only in the transaction summary', async () => {
  const component = await source()
  assert.equal((component.match(/:class="\['inspection-detail__result-chip'/g) || []).length, 1)
  assert.doesNotMatch(component, /inspection_history_result/u)
})

test('keeps FAIL-only failure reason and omits certificate behavior', async () => {
  const component = await source()
  assert.match(component, /inspection.result === 'FAIL' && inspection.failureReason/u)
  assert.match(component, /knownInspectionFailureReasonLabel/u)
  assert.equal((component.match(/id="failure-reason-heading"/g) || []).length, 1)
  assert.match(component, /inspection-detail__inspection-card[\s\S]*inspection-detail__failure[\s\S]*<\/v-card>/u)
  assert.doesNotMatch(component, /<\/div>\s*<section v-if="inspection.result === 'FAIL'/u)
  assert.doesNotMatch(component, /result === 'FAIL'[\s\S]{0,120}TechnicalInspectionCertificateCard/u)
})

test('shows the historical inspection category in inspection information', async () => {
  const component = await source()
  assert.match(component, /inspectionCategoryName/u)
  assert.match(component, /inspection_payment_inspection_category/u)
})

test('uses balanced responsive information cards', async () => {
  const component = await source()
  assert.match(component, /inspection-detail__grid/u)
  assert.match(component, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u)
  assert.match(component, /@media \(max-width: 850px\)/u)
})
