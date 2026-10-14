import type { ApplicationDocument } from '../types/application.types'

export function isPendingReplacementOfRejectedDocument (
  current: ApplicationDocument,
  history: ApplicationDocument[],
): boolean {
  if (current.status !== 'PENDING' || current.replacesDocumentId === null) {
    return false
  }

  const byId = new Map(history.map(document => [document.id, document]))
  const visited = new Set<string>([current.id])
  let predecessorId: string | null = current.replacesDocumentId
  while (predecessorId !== null && !visited.has(predecessorId)) {
    visited.add(predecessorId)
    const predecessor = byId.get(predecessorId)
    if (predecessor === undefined) {
      return false
    }
    if (predecessor.status === 'REJECTED') {
      return true
    }
    predecessorId = predecessor.replacesDocumentId
  }
  return false
}

export function correctionRejectionReason (
  current: ApplicationDocument,
  history: ApplicationDocument[],
): string | null {
  if (current.status === 'REJECTED') {
    return current.rejectionReason
  }

  const byId = new Map(history.map(document => [document.id, document]))
  const visited = new Set<string>([current.id])
  let predecessorId: string | null = current.replacesDocumentId
  while (predecessorId !== null && !visited.has(predecessorId)) {
    visited.add(predecessorId)
    const predecessor = byId.get(predecessorId)
    if (predecessor === undefined) {
      return null
    }
    if (predecessor.status === 'REJECTED') {
      return predecessor.rejectionReason
    }
    predecessorId = predecessor.replacesDocumentId
  }
  return null
}
