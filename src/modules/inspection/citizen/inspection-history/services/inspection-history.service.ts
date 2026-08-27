import type { CitizenInspectionHistoryPage } from '../types/inspection-history.types'
import { http } from '@/services/http'

export const inspectionHistoryService = {
  async list ({ page = 1, limit = 20, sortOrder = 'desc', vehicleId }: InspectionHistoryQuery = {}): Promise<CitizenInspectionHistoryPage> {
    return (await http.get<CitizenInspectionHistoryPage>('/inspections', {
      params: { page, limit, sortOrder, ...(vehicleId ? { vehicleId } : {}) },
    })).data
  },
}

export interface InspectionHistoryQuery {
  page?: number
  limit?: number
  sortOrder?: 'asc' | 'desc'
  vehicleId?: string
}
