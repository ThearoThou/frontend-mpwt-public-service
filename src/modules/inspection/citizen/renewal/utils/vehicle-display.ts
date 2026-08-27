import type { Vehicle } from '../../vehicles/types/vehicle.types'

export function formatCambodianPhone (value: string | null | undefined): string {
  if (!value) {
    return '—'
  }

  const normalized = value.replace(/[\s-]/gu, '')
  return normalized.startsWith('+855') ? `0${normalized.slice(4).replace(/^0/u, '')}` : value
}

export function formatVehiclePlate (vehicle: Vehicle): string {
  const displayLabel = vehicle.plateDisplayLabelKh.trim()
  return displayLabel ? `${displayLabel} ${vehicle.plateNumber}` : vehicle.plateNumber
}
