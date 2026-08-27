type Translate = (key: string) => string

const vehicleTypeKeys: Record<string, string> = {
  FAMILY_CAR: 'inspection_vehicle_type_family_car',
  PASSENGER_CAR: 'inspection_vehicle_type_passenger_car',
  CAR: 'inspection_vehicle_type_car',
  SEDAN: 'inspection_vehicle_type_sedan',
  SUV: 'inspection_vehicle_type_suv',
  HATCHBACK: 'inspection_vehicle_type_hatchback',
  PICKUP: 'inspection_vehicle_type_pickup',
  VAN: 'inspection_vehicle_type_van',
  MINIVAN: 'inspection_vehicle_type_minivan',
  MINIBUS: 'inspection_vehicle_type_minibus',
  BUS: 'inspection_vehicle_type_bus',
  TRUCK: 'inspection_vehicle_type_truck',
  TRACTOR: 'inspection_vehicle_type_tractor',
  MOTORCYCLE: 'inspection_vehicle_type_motorcycle',
  TUK_TUK: 'inspection_vehicle_type_tuk_tuk',
  TRAILER: 'inspection_vehicle_type_trailer',
  OTHER: 'inspection_vehicle_type_other',
}

export function formatVehicleType (value: string | null | undefined, translate: Translate): string {
  if (!value) {
    return '—'
  }

  const normalized = value.trim().toUpperCase().replace(/[\s-]+/gu, '_')
  const key = vehicleTypeKeys[normalized]

  if (key) {
    return translate(key)
  }

  return normalized
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
