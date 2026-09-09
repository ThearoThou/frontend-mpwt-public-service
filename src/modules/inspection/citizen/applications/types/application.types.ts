export type ApplicationStatus
  = | 'DRAFT'
    | 'SUBMITTED'
    | 'UNDER_REVIEW'
    | 'CORRECTION_REQUIRED'
    | 'APPOINTMENT_SELECTION_REQUIRED'
    | 'APPROVED'
    | 'REINSPECTION_REQUIRED'
    | 'INSPECTION_FAILED'
    | 'EXPIRED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'COMPLETED'

export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REJECTED'

export type InspectionResult = 'PASS' | 'FAIL'

export type PaymentMethod = 'PAY_AT_STATION'

export interface RenewalApplication {
  id: string
  referenceNumber: string | null
  citizenId: string
  vehicleId: string
  status: ApplicationStatus
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

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export type ApiPaginatedResponse<T> = PaginatedResponse<T>

export interface RenewalApplicationVehicleSummary {
  registrationNumber: string | null
  plateNumber: string | null
  plateCategory: string | null
  plateProvince: string | null
  make: string | null
  model: string | null
  manufactureYear: number | null
}

export interface RenewalApplicationPaymentSummary {
  status: PaymentStatus
  totalAmount: string
  currency: string
}

export interface RenewalApplicationInspectionSummary {
  result: InspectionResult
}

export interface RenewalApplicationVehicleSnapshot {
  vehicleId: string | null
  registrationNumber: string | null
  plateNumber: string | null
  plateCategory: string | null
  plateProvince: string | null
  plateType: string | null
  vehicleType: string | null
  vehicleClass: string | null
  inspectionCategoryId: string | null
  make: string | null
  model: string | null
  manufactureYear: number | null
  chassisNumber: string | null
  firstRegistrationDate: string | null
  lastInspectionDate: string | null
  inspectionExpiryDate: string | null
  registeredOwnerNameKh: string | null
  registeredOwnerNameEn: string | null
  registeredOwnerPhone: string | null
  colour?: string | null
  engineNumber?: string | null
  numberOfCylinders?: number | null
  engineDisplacementCc?: number | null
  enginePowerHp?: string | null
  fuelType?: string | null
  numberOfSeats?: number | null
  numberOfAxles?: number | null
  steering?: string | null
  vehicleWeightKg?: number | null
  maximumLoadKg?: number | null
  maximumGrossWeightKg?: number | null
  wheelSize?: string | null
  lengthMm?: number | null
  widthMm?: number | null
  heightMm?: number | null
}

export interface RenewalApplicationListItem extends RenewalApplication {
  vehicle: RenewalApplicationVehicleSummary | null
  payment: RenewalApplicationPaymentSummary | null
  inspection: RenewalApplicationInspectionSummary | null
}

export interface RenewalApplicationDetail extends RenewalApplication {
  vehicleSnapshot: RenewalApplicationVehicleSnapshot | null
}

export interface ListCitizenApplicationsQuery {
  page?: number
  limit?: number
  sortOrder?: 'asc' | 'desc'
  search?: string
  status?: ApplicationStatus
  statuses?: ApplicationStatus[]
}

export interface PaginationQuery {
  page?: number
  limit?: number
  sortOrder?: 'asc' | 'desc'
}

export interface RenewalApplicationStatusHistory {
  id: string
  applicationId: string
  previousStatus: ApplicationStatus | null
  newStatus: ApplicationStatus
  changedByUserId: string | null
  createdAt: string
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

export interface CitizenPaymentRecord {
  id: string
  applicationId: string
  invoiceNumber: string
  receiptNumber: string | null
  method: PaymentMethod
  status: PaymentStatus
  inspectionFeeKhr: string
  serviceFeeKhr: string
  baseAmount: string
  previousInspectionExpiryDate: string
  lateDays: number
  lateFee: string
  totalAmount: string
  currency: string
  paymentReference: string | null
  invoiceIssuedAt: string
  confirmedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  invoiceAvailable: boolean
  receiptAvailable: boolean
  inspectionSheetAvailable: boolean
  createdAt: string
  updatedAt: string
}

export interface CitizenPaymentInvoice extends CitizenPaymentRecord {
  applicationReferenceNumber: string | null
  preferredInspectionStationId: string | null
  preferredInspectionDate: string | null
  vehicle: {
    registrationNumber: string
    plateNumber: string
    plateCategory: string
    plateProvince: string | null
    plateType: string
    make: string
    model: string
    manufactureYear: number | null
    chassisNumber: string
  }
  applicant: {
    nameKh: string | null
    nameEn: string | null
    phone: string | null
  }
}

export type ApplicationDocumentType
  = | 'VEHICLE_REGISTRATION_CARD'
    | 'PREVIOUS_INSPECTION_CERTIFICATE'
    | 'CITIZEN_ID_CARD'

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
  rejectionReason: string | null
  uploadedAt: string
  createdAt: string
  updatedAt: string
}

export interface CitizenInspectionStatus {
  applicationId: string
  applicationStatus: ApplicationStatus
  inspection: {
    id: string
    attemptNumber: number
    result: InspectionResult
    inspectedAt: string
    failureReason: string | null
  } | null
  latestAppointmentStatus:
    'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | null
  attemptsUsed: number
  attemptsRemaining: number
  reinspectionRequired: boolean
  reinspectionDeadline: string | null
  replacementBookingRequired: boolean
  replacementBookingDeadline: string | null
  stickerEligible: boolean
}

export type StickerPresentationState
  = 'NOT_READY' | 'READY_FOR_ISSUANCE' | 'ISSUED'

export interface CitizenStickerStatus {
  state: StickerPresentationState
  application: {
    id: string
    referenceNumber: string | null
    status: ApplicationStatus
    completedAt: string | null
  }
  vehicle: {
    registrationNumber: string | null
    plateNumber: string | null
    make: string | null
    model: string | null
  }
  ownerName: string | null
  inspection: {
    id: string
    attemptNumber: number
    completedAt: string
  } | null
  station: {
    id: string
    code: string
    nameKh: string
    nameEn: string
  } | null
  sticker: {
    id: string
    stickerNumber: string
    issuedAt: string
  } | null
}

export interface TechnicalInspectionCertificateStatus {
  issued: boolean
  certificateNumber: string | null
  issuedAt: string | null
  inspectionDate: string | null
  expiryDate: string | null
  downloadAvailable: boolean
}

export interface TechnicalInspectionCertificateDownload {
  blob: Blob
  filename: string
}
