import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const screens = [
  {
    name: 'My Vehicles',
    url: new URL('../src/modules/inspection/citizen/vehicles/VehicleListView.vue', import.meta.url),
    debounce: 'vehicleSearchDebounceMs',
    request: 'vehicleRequest',
  },
  {
    name: 'My Applications',
    url: new URL('../src/modules/inspection/citizen/applications/ApplicationListView.vue', import.meta.url),
    debounce: 'applicationSearchDebounceMs',
    request: 'requestSequence',
  },
]

for (const screen of screens) {
  test(`${screen.name} uses one accessible free-text search interaction`, async () => {
    const source = await readFile(screen.url, 'utf8')
    assert.match(source, /<v-text-field/u)
    assert.match(source, /:aria-label=/u)
    assert.match(source, /prepend-inner-icon="mdi-magnify"/u)
    assert.match(source, /@keydown\.enter\.prevent="submitSearch"/u)
    assert.match(source, /@click:prepend-inner="submitSearch"/u)
    assert.match(source, /@click:clear="clearSearch"/u)
    assert.doesNotMatch(source, /<v-autocomplete/u)
  })

  test(`${screen.name} live search resets pagination, debounces for 350 ms, and rejects stale responses`, async () => {
    const source = await readFile(screen.url, 'utf8')
    assert.match(source, new RegExp(`${screen.debounce} = 350`, 'u'))
    assert.match(source, /page\.value = 1[\s\S]*setTimeout/u)
    assert.match(source, new RegExp(String.raw`const request = \+\+${screen.request}`, 'u'))
    assert.match(source, new RegExp(String.raw`if \(request !== ${screen.request}\) return`, 'u'))
  })
}

test('all citizen list placeholders remain short and purpose-focused', async () => {
  const en = JSON.parse(await readFile(new URL('../src/plugins/i18n/locales/en.json', import.meta.url), 'utf8'))
  const kh = JSON.parse(await readFile(new URL('../src/plugins/i18n/locales/kh.json', import.meta.url), 'utf8'))

  assert.equal(en.inspection_vehicle_search_placeholder, 'Search vehicles...')
  assert.equal(en.inspection_applications_search_placeholder, 'Search applications...')
  assert.equal(en.inspection_history_search_placeholder, 'Search inspection history...')
  assert.equal(kh.inspection_vehicle_search_placeholder, 'ស្វែងរកយានយន្ត...')
  assert.equal(kh.inspection_applications_search_placeholder, 'ស្វែងរកពាក្យសុំ...')
  assert.equal(kh.inspection_history_search_placeholder, 'ស្វែងរកប្រវត្តិត្រួតពិនិត្យ...')
})
