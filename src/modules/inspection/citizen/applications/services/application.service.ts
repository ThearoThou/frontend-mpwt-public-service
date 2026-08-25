import type { ApiDataResponse, ApiPaginatedResponse, RenewalApplication } from '../types/application.types'
import { http } from '@/services/http'

export const inspectionApplicationService = {
  async createDraft (vehicleId: string): Promise<RenewalApplication> {
    return (await http.post<ApiDataResponse<RenewalApplication>>('/applications', { vehicleId })).data.data
  },
  async listCitizenApplications (): Promise<RenewalApplication[]> {
    return (await http.get<ApiPaginatedResponse<RenewalApplication[]>>('/applications', { params: { page: 1, limit: 100 } })).data.data
  },
}
