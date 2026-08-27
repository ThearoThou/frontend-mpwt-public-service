export type CitizenInspectionResult = 'PASS' | 'FAIL'

export interface CitizenInspectionHistoryItem {
  applicationId: string
  referenceNumber: string | null
  attemptNumber: number
  result: CitizenInspectionResult
  inspectedAt: string
  failureReason: string | null
  station: {
    id: string
    nameKh: string
    nameEn: string
  }
  vehicle: {
    registrationNumber: string | null
    plateNumber: string | null
    plateCategory: string | null
    plateProvince: string | null
    make: string | null
    model: string | null
  }
}

export interface InspectionHistoryPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface CitizenInspectionHistoryPage {
  data: CitizenInspectionHistoryItem[]
  meta: InspectionHistoryPagination
}
