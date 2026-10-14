import assert from 'node:assert/strict'
import test from 'node:test'

import { renewalRequiresConfirmation } from '../src/modules/inspection/citizen/vehicles/utils/inspection-expiry-status.ts'

const today = new Date('2026-09-22T00:00:00.000Z')

test('valid inspection requires renewal confirmation', () => {
  assert.equal(renewalRequiresConfirmation('2027-01-19', today), true)
})

test('expiring-soon inspection starts renewal directly', () => {
  assert.equal(renewalRequiresConfirmation('2026-10-21', today), false)
})

test('expired inspection starts renewal directly', () => {
  assert.equal(renewalRequiresConfirmation('2026-09-21', today), false)
})
