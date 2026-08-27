const fallbackIcon = 'mdi-car-outline'

const vehicleTypeIcons: Record<string, string> = {
  FAMILY_CAR: fallbackIcon,
  PASSENGER_CAR: fallbackIcon,
  CAR: fallbackIcon,
  SEDAN: fallbackIcon,
  HATCHBACK: 'mdi-car-hatchback',
  SUV: 'mdi-car-estate',
  PICKUP: 'mdi-car-pickup',
  VAN: 'mdi-van-passenger',
  MINIVAN: 'mdi-van-passenger',
  MINIBUS: 'mdi-bus',
  BUS: 'mdi-bus',
  TRUCK: 'mdi-truck-outline',
  TRACTOR: 'mdi-tractor',
  MOTORCYCLE: 'mdi-motorbike',
  TUK_TUK: 'mdi-rickshaw',
  TRAILER: 'mdi-truck-trailer',
  OTHER: fallbackIcon,
}

/** Returns a presentation-only icon for the citizen-facing vehicle type. */
export function getVehicleTypeIcon (value: string | null | undefined): string {
  if (!value) {
    return fallbackIcon
  }

  const normalized = value.trim().toUpperCase().replace(/[\s-]+/gu, '_')

  return vehicleTypeIcons[normalized] ?? fallbackIcon
}
