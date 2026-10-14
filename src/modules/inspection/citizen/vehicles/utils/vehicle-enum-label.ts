type Translate = (key: string) => string

const enumKeys: Record<string, string> = {
  FAMILY_PASSENGER: 'inspection_vehicle_type_passenger_car', PETROL: 'inspection_vehicle_fuel_petrol',
  DIESEL: 'inspection_vehicle_fuel_diesel', HYBRID: 'inspection_vehicle_fuel_hybrid', ELECTRIC: 'inspection_vehicle_fuel_electric',
  LEFT: 'inspection_vehicle_steering_left', RIGHT: 'inspection_vehicle_steering_right',
}

const vehicleColourKeys: Record<string, string> = {
  'BLACK': 'inspection_vehicle_colour_black',
  'BLUE': 'inspection_vehicle_colour_blue',
  'BROWN': 'inspection_vehicle_colour_brown',
  'CHAMPAGNE': 'inspection_vehicle_colour_champagne',
  'GOLD': 'inspection_vehicle_colour_gold',
  'GRAY': 'inspection_vehicle_colour_gray',
  'GREY': 'inspection_vehicle_colour_gray',
  'GREEN': 'inspection_vehicle_colour_green',
  'METALLIC GRAY': 'inspection_vehicle_colour_metallic_gray',
  'METALLIC GREY': 'inspection_vehicle_colour_metallic_gray',
  'ORANGE': 'inspection_vehicle_colour_orange',
  'PEARL WHITE': 'inspection_vehicle_colour_pearl_white',
  'RED': 'inspection_vehicle_colour_red',
  'SILVER': 'inspection_vehicle_colour_silver',
  'SOUL RED': 'inspection_vehicle_colour_soul_red',
  'WHITE': 'inspection_vehicle_colour_white',
  'YELLOW': 'inspection_vehicle_colour_yellow',
}

export function formatVehicleEnum (value: string | null | undefined, translate: Translate): string {
  if (!value) {
    return '—'
  }
  return translate(enumKeys[value.trim().toUpperCase()] ?? value)
}

export function resolveVehicleColorLabel (value: string | null | undefined, translate: Translate): string {
  if (!value?.trim()) {
    return '—'
  }
  const normalized = value.trim()
  const key = vehicleColourKeys[normalized.toUpperCase()]
  return key === undefined ? normalized : translate(key)
}
