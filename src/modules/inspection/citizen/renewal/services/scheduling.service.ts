import type { ApiDataResponse, RenewalApplication } from '../../applications/types/application.types'
import { http } from '@/services/http'

export interface InspectionStation {
  id: string
  code: string
  nameKh: string
  nameEn: string
  province: string
  address: string
  phone: string | null
}

export interface AvailableInspectionDate {
  stationId: string
  capacityDate: string
}

export const inspectionSchedulingService = {
  async listStations (): Promise<InspectionStation[]> {
    return (await http.get<ApiDataResponse<InspectionStation[]>>('/stations')).data.data
  },
  async listAvailableDates (stationId: string): Promise<AvailableInspectionDate[]> {
    return (await http.get<ApiDataResponse<AvailableInspectionDate[]>>(`/stations/${stationId}/available-dates`)).data.data
  },
  async listPreferredDates (stationId: string): Promise<AvailableInspectionDate[]> {
    return (await http.get<ApiDataResponse<AvailableInspectionDate[]>>(`/stations/${stationId}/preferred-dates`)).data.data
  },
  async savePreference (applicationId: string, stationId: string, capacityDate: string): Promise<RenewalApplication> {
    return (await http.post<ApiDataResponse<RenewalApplication>>(
      `/applications/${applicationId}/scheduling-preference`,
      { stationId, capacityDate },
    )).data.data
  },
}
