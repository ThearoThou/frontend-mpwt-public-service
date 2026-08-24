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
