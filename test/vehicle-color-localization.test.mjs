import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { resolveVehicleColorLabel } from '../src/modules/inspection/citizen/vehicles/utils/vehicle-enum-label.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const english = JSON.parse(read('../src/plugins/i18n/locales/en.json'))
const khmer = JSON.parse(read('../src/plugins/i18n/locales/kh.json'))
const applicationDetails = read('../src/modules/inspection/citizen/applications/ApplicationDetailsView.vue')
const translate = messages => key => messages[key] ?? key

test('known vehicle colors localize in Khmer and remain canonical in English', () => {
  assert.equal(resolveVehicleColorLabel('Brown', translate(khmer)), 'ត្នោត')
  assert.equal(resolveVehicleColorLabel(' brown ', translate(khmer)), 'ត្នោត')
  assert.equal(resolveVehicleColorLabel('BROWN', translate(english)), 'Brown')
  assert.equal(resolveVehicleColorLabel('Black', translate(khmer)), 'ខ្មៅ')
  assert.equal(resolveVehicleColorLabel('White', translate(khmer)), 'ស')
  assert.equal(resolveVehicleColorLabel('Gray', translate(khmer)), 'ប្រផេះ')
  assert.equal(resolveVehicleColorLabel('Grey', translate(khmer)), 'ប្រផេះ')
})

test('seeded compound colors and common colors have Khmer labels', () => {
  assert.equal(resolveVehicleColorLabel('Pearl White', translate(khmer)), 'សគុជខ្យង')
  assert.equal(resolveVehicleColorLabel('Metallic Grey', translate(khmer)), 'ប្រផេះលោហធាតុ')
  assert.equal(resolveVehicleColorLabel('Soul Red', translate(khmer)), 'ក្រហម')
  assert.equal(resolveVehicleColorLabel('Champagne', translate(khmer)), 'ស្រាសំប៉ាញ')
  assert.equal(resolveVehicleColorLabel('Orange', translate(khmer)), 'ទឹកក្រូច')
})

test('unknown custom color preserves its trimmed stored value', () => {
  assert.equal(resolveVehicleColorLabel('  Custom Aurora  ', translate(khmer)), 'Custom Aurora')
})

test('Application Details localizes the historical snapshot color', () => {
  assert.match(applicationDetails, /resolveVehicleColorLabel\(application\.vehicleSnapshot\.colour, t\)/u)
  assert.doesNotMatch(applicationDetails, /resolveVehicleColorLabel\(associatedVehicle/u)
})
