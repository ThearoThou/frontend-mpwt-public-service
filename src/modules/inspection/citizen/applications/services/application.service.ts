import type { ApiDataResponse, ApiPaginatedResponse, ApplicationDocument, ApplicationDocumentType, CitizenFeeEstimate, CitizenInspectionStatus, CitizenPaymentInvoice, CitizenPaymentRecord, CitizenStickerStatus, ListCitizenApplicationsQuery, PaginatedResponse, PaginationQuery, RenewalApplication, RenewalApplicationDetail, RenewalApplicationListItem, RenewalApplicationStatusHistory, TechnicalInspectionCertificateDownload, TechnicalInspectionCertificateStatus } from '../types/application.types'
import { http } from '@/services/http'

export const inspectionApplicationService = {
  async createDraft (vehicleId: string): Promise<RenewalApplication> {
    return (await http.post<ApiDataResponse<RenewalApplication>>('/applications', { vehicleId })).data.data
  },
  async renewAgain (expiredApplicationId: string): Promise<RenewalApplication> {
    return (await http.post<ApiDataResponse<RenewalApplication>>(`/applications/${expiredApplicationId}/renew-again`)).data.data
  },
  async applyAgain (failedApplicationId: string): Promise<RenewalApplication> {
    return (await http.post<ApiDataResponse<RenewalApplication>>(`/applications/${failedApplicationId}/apply-again`)).data.data
  },
  async submitDraft (applicationId: string): Promise<RenewalApplication> {
    return (await http.post<ApiDataResponse<RenewalApplication>>(`/applications/${applicationId}/submit`)).data.data
  },
  async resubmit (applicationId: string): Promise<RenewalApplication> {
    return (await http.post<ApiDataResponse<RenewalApplication>>(`/applications/${applicationId}/resubmit`)).data.data
  },
  async getById (applicationId: string): Promise<RenewalApplicationDetail> {
    return (await http.get<ApiDataResponse<RenewalApplicationDetail>>(`/applications/${applicationId}`)).data.data
  },
  async listCitizenApplications (query: ListCitizenApplicationsQuery = {}): Promise<PaginatedResponse<RenewalApplicationListItem>> {
    const search = query.search?.trim()
    const statuses = [...new Set(query.statuses)]
    const params = {
      ...query,
      ...(search ? { search } : {}),
      ...(statuses.length > 0 ? { statuses: statuses.join(',') } : {}),
    }

    if (!search) {
      delete params.search
    }
    if (statuses.length === 0) {
      delete params.statuses
    }

    return (await http.get<ApiPaginatedResponse<RenewalApplicationListItem>>('/applications', { params })).data
  },
  async listStatusHistory (applicationId: string, query: PaginationQuery = {}): Promise<PaginatedResponse<RenewalApplicationStatusHistory>> {
    return (await http.get<ApiPaginatedResponse<RenewalApplicationStatusHistory>>(`/applications/${applicationId}/status-history`, { params: query })).data
  },
  async getInspectionStatus (applicationId: string): Promise<CitizenInspectionStatus> {
    return (await http.get<ApiDataResponse<CitizenInspectionStatus>>(`/applications/${applicationId}/inspection-status`)).data.data
  },
  async getStickerStatus (applicationId: string): Promise<CitizenStickerStatus> {
    return (await http.get<ApiDataResponse<CitizenStickerStatus>>(`/applications/${applicationId}/sticker-status`)).data.data
  },
  async getApplicationCertificate (applicationId: string): Promise<TechnicalInspectionCertificateStatus> {
    return (await http.get<ApiDataResponse<TechnicalInspectionCertificateStatus>>(`/applications/${applicationId}/certificate`)).data.data
  },
  async downloadApplicationCertificate (applicationId: string): Promise<TechnicalInspectionCertificateDownload> {
    const response = await http.get<Blob>(`/applications/${applicationId}/certificate/download`, { responseType: 'blob' })

    return {
      blob: response.data,
      filename: certificateDownloadFilename(response.headers['content-disposition']),
    }
  },
  async getFeeEstimate (applicationId: string): Promise<CitizenFeeEstimate> {
    return (await http.get<ApiDataResponse<CitizenFeeEstimate>>(`/applications/${applicationId}/fee-estimate`)).data.data
  },
  async initializePayment (applicationId: string): Promise<CitizenPaymentInvoice> {
    return (await http.post<ApiDataResponse<CitizenPaymentInvoice>>(`/applications/${applicationId}/payment/initialize`)).data.data
  },
  async getPayment (applicationId: string): Promise<CitizenPaymentRecord> {
    return (await http.get<ApiDataResponse<CitizenPaymentRecord>>(`/payments/applications/${applicationId}`)).data.data
  },
  async downloadInvoice (applicationId: string): Promise<Blob> {
    return (await http.get<Blob>(`/payments/applications/${applicationId}/invoice`, { responseType: 'blob' })).data
  },
  async downloadReceipt (applicationId: string): Promise<Blob> {
    return (await http.get<Blob>(`/payments/applications/${applicationId}/receipt`, { responseType: 'blob' })).data
  },
  async downloadInspectionSheet (applicationId: string): Promise<Blob> {
    return (await http.get<Blob>(`/payments/applications/${applicationId}/inspection-sheet`, { responseType: 'blob' })).data
  },
  async listDocuments (applicationId: string): Promise<ApplicationDocument[]> {
    return (await http.get<ApiDataResponse<ApplicationDocument[]>>(`/applications/${applicationId}/documents`)).data.data
  },
  async listDocumentHistory (applicationId: string, documentType: ApplicationDocumentType, query: PaginationQuery = {}): Promise<PaginatedResponse<ApplicationDocument>> {
    return (await http.get<ApiPaginatedResponse<ApplicationDocument>>(`/applications/${applicationId}/documents/${documentType}/history`, { params: query })).data
  },
  async uploadDocument (applicationId: string, documentType: ApplicationDocumentType, file: File): Promise<ApplicationDocument> {
    const body = new FormData()
    body.append('documentType', documentType)
    body.append('file', file)
    return (await http.post<ApiDataResponse<ApplicationDocument>>(`/applications/${applicationId}/documents`, body)).data.data
  },
  async downloadDocument (applicationId: string, documentId: string): Promise<Blob> {
    return (await http.get<Blob>(`/applications/${applicationId}/documents/${documentId}/download`, { responseType: 'blob' })).data
  },
}

function certificateDownloadFilename (contentDisposition: unknown): string {
  const fallback = 'technical-inspection-certificate.pdf'
  if (typeof contentDisposition !== 'string' || /[\r\n]/u.test(contentDisposition)) {
    return fallback
  }

  const match = /filename="?([^";]+)"?/iu.exec(contentDisposition)
  if (!match?.[1]) {
    return fallback
  }

  const filename = match[1]
    .replace(/^.*[\\/]/u, '')
    .replace(/[^\w.-]+/gu, '_')
    .replace(/_+/gu, '_')
    .replace(/^[._-]+|[._-]+$/gu, '')

  return filename.toLowerCase().endsWith('.pdf') && filename.length > 4
    ? filename
    : fallback
}
