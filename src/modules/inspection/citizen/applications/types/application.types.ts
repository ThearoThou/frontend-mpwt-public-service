export interface RenewalApplication {
  id: string
  referenceNumber: string | null
  citizenId: string
  vehicleId: string
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'CORRECTION_REQUIRED' | 'APPOINTMENT_SELECTION_REQUIRED' | 'APPROVED' | 'REINSPECTION_REQUIRED' | 'INSPECTION_FAILED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED'
  currentCorrectionReason: string | null
  currentRejectionReason: string | null
  preferredInspectionStationId: string | null
  preferredInspectionDate: string | null
  submittedAt: string | null
  reviewStartedAt: string | null
  readyForInspectionAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiDataResponse<T> {
  data: T
}

export interface ApiPaginatedResponse<T> {
  data: T
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface CitizenFeeEstimate {
  inspectionFeeKhr: string
  serviceFeeKhr: string
  baseAmount: string
  lateDays: number
  lateFee: string
  totalAmount: string
  currency: string
}

export type ApplicationDocumentType = 'VEHICLE_REGISTRATION_CARD' | 'PREVIOUS_INSPECTION_CERTIFICATE' | 'CITIZEN_ID_CARD'

export interface ApplicationDocument {
  id: string
  applicationId: string
  documentType: ApplicationDocumentType
  versionNumber: number
  isCurrent: boolean
  replacesDocumentId: string | null
  originalFileName: string
  mimeType: string
  fileSizeBytes: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  uploadedAt: string
  createdAt: string
  updatedAt: string
}
