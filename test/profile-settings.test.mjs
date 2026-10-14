import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const profileView = await readFile(
  new URL('../src/modules/inspection/citizen/profile/ProfileView.vue', import.meta.url),
  'utf8',
)

test('citizen profile editing saves directly and keeps national ID read-only', () => {
  assert.match(profileView, /v-model="form\.phone"/)
  assert.match(profileView, /v-model="form\.email"/)
  assert.match(profileView, /:readonly="!editing"/)
  assert.match(profileView, /:model-value="profile\?\.nationalIdNumber \|\| '—'"/)
  assert.match(profileView, /@click="save"/)
  assert.doesNotMatch(profileView, /profilePasswordDialog|profileCurrentPassword|requestSave/)
  assert.match(profileView, /function displayLocalPhone/)
  assert.match(profileView, /`0\$\{normalized\.slice\(4\)/)
  assert.match(profileView, /isInspectionPhone\(form\.phone\.trim\(\)\).*inspection_phone_invalid/)
  assert.match(profileView, /getInspectionEmailIssue\(form\.email\.trim\(\)\)/)
  assert.match(profileView, /address: form\.address\.trim\(\) \|\| null/)
  assert.match(profileView, /email: form\.email\.trim\(\) \|\| null/)
})
