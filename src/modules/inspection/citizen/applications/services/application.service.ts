import type { ApiDataResponse, RenewalApplication } from '../types/application.types'
import { http } from '@/services/http'

export const inspectionApplicationService = {
  async createDraft (vehicleId: string): Promise<RenewalApplication> {
    return (await http.post<ApiDataResponse<RenewalApplication>>('/applications', { vehicleId })).data.data
  },
}
