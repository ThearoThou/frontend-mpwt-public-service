export type CitizenInspectionResult = 'PASS' | 'FAIL'

export interface CitizenInspectionHistoryItem {
  inspectionId: string
  applicationId: string
  referenceNumber: string | null
  transactionNumber: string | null
  attemptNumber: number
  result: CitizenInspectionResult
  inspectedAt: string
  failureReason: string | null
  validUntil: string | null
  station: {
    id: string
    nameKh: string
    nameEn: string
  }
  inspectionCategory: {
    id: string
    code: string
    nameKh: string
    nameEn: string
  } | null
  vehicle: {
    registrationNumber: string | null
    chassisNumber: string | null
    plateNumber: string | null
    plateCategory: string | null
    plateProvince: string | null
    make: string | null
    model: string | null
    manufactureYear: string | null
    engineNumber: string | null
    vehicleType: string | null
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
