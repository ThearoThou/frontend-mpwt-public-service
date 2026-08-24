import type { ApiPaginatedResponse, Vehicle, VehicleLookupQuery } from '../types/vehicle.types'
import { http } from '@/services/http'

export const inspectionVehicleService = {
  async lookup (query: VehicleLookupQuery): Promise<ApiPaginatedResponse<Vehicle>> {
    return (await http.get<ApiPaginatedResponse<Vehicle>>('/vehicles', { params: query })).data
  },
}
