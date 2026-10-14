import type { CitizenInspectionHistoryItem, CitizenInspectionHistoryPage, CitizenInspectionResult } from '../types/inspection-history.types'
import { http } from '@/services/http'

export const inspectionHistoryService = {
  async list ({ page = 1, limit = 20, sortOrder = 'desc', vehicleId, applicationId, inspectionId, result, search }: InspectionHistoryQuery = {}): Promise<CitizenInspectionHistoryPage> {
    return (await http.get<CitizenInspectionHistoryPage>('/inspections', {
      params: { page, limit, sortOrder, ...(vehicleId ? { vehicleId } : {}), ...(applicationId ? { applicationId } : {}), ...(inspectionId ? { inspectionId } : {}), ...(result ? { result } : {}), ...(search ? { search } : {}) },
    })).data
  },
  async detail (inspectionId: string): Promise<CitizenInspectionHistoryItem> {
    return (await http.get<CitizenInspectionHistoryItem>(`/inspections/${inspectionId}`)).data
  },
}

export interface InspectionHistoryQuery {
  page?: number
  limit?: number
  sortOrder?: 'asc' | 'desc'
  vehicleId?: string
  applicationId?: string
  inspectionId?: string
  result?: CitizenInspectionResult
  search?: string
}
