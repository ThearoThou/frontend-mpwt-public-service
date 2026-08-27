import type {
  ApiDataResponse,
  RenewalApplication,
} from '../../applications/types/application.types'
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

export interface InspectionServiceClosure {
  closureDate: string
  reasonKh: string
  reasonEn: string
}

export const inspectionSchedulingService = {
  async listStations (): Promise<InspectionStation[]> {
    return (await http.get<ApiDataResponse<InspectionStation[]>>('/stations'))
      .data
      .data
  },
  async listClosures (from: string, to: string): Promise<InspectionServiceClosure[]> {
    return (await http.get<ApiDataResponse<InspectionServiceClosure[]>>('/inspection-calendar/closures', {
      params: { from, to },
    })).data.data
  },
  async savePreference (
    applicationId: string,
    preferredInspectionDate: string,
    preferredInspectionStationId: string | null,
  ): Promise<RenewalApplication> {
    return (
      await http.post<ApiDataResponse<RenewalApplication>>(
        `/applications/${applicationId}/scheduling-preference`,
        { preferredInspectionDate, preferredInspectionStationId },
      )
    ).data.data
  },
}
