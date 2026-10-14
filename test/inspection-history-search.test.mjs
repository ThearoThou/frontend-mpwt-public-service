import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const componentUrl = new URL('../src/modules/inspection/citizen/inspection-history/InspectionHistoryView.vue', import.meta.url)

test('uses a free-text field without autocomplete no-data behavior', async () => {
  const source = await readFile(componentUrl, 'utf8')
  assert.match(source, /<v-text-field/u)
  assert.doesNotMatch(source, /<v-autocomplete/u)
  assert.doesNotMatch(source, /:no-data-text/u)
})

test('Enter and the search action invoke the shared submit handler', async () => {
  const source = await readFile(componentUrl, 'utf8')
  assert.match(source, /@keydown\.enter\.prevent="submitSearch"/u)
  assert.match(source, /@click:prepend-inner="submitSearch"/u)
  assert.match(source, /@click:clear="clearSearch"/u)
})

test('live search is debounced and resets pagination before loading', async () => {
  const source = await readFile(componentUrl, 'utf8')
  assert.match(source, /historySearchDebounceMs = 350/u)
  assert.match(source, /watch\(vehicleSearchQuery/u)
  assert.match(source, /page\.value = 1[\s\S]*setTimeout/u)
  assert.match(source, /const request = \+\+historyRequest/u)
  assert.match(source, /if \(request !== historyRequest\) return/u)
})
