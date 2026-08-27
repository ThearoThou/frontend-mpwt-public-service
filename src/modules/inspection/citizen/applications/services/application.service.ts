import type { ApiDataResponse, ApiPaginatedResponse, ApplicationDocument, ApplicationDocumentType, CitizenFeeEstimate, CitizenPaymentInvoice, CitizenPaymentRecord, RenewalApplication } from '../types/application.types'
import { http } from '@/services/http'

export const inspectionApplicationService = {
  async createDraft (vehicleId: string): Promise<RenewalApplication> {
    return (await http.post<ApiDataResponse<RenewalApplication>>('/applications', { vehicleId })).data.data
  },
  async renewAgain (expiredApplicationId: string): Promise<RenewalApplication> {
    return (await http.post<ApiDataResponse<RenewalApplication>>(`/applications/${expiredApplicationId}/renew-again`)).data.data
  },
  async submitDraft (applicationId: string): Promise<RenewalApplication> {
    return (await http.post<ApiDataResponse<RenewalApplication>>(`/applications/${applicationId}/submit`)).data.data
  },
  async getById (applicationId: string): Promise<RenewalApplication> {
    return (await http.get<ApiDataResponse<RenewalApplication>>(`/applications/${applicationId}`)).data.data
  },
  async listCitizenApplications (): Promise<RenewalApplication[]> {
    return (await http.get<ApiPaginatedResponse<RenewalApplication[]>>('/applications', { params: { page: 1, limit: 100 } })).data.data
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
  async listDocuments (applicationId: string): Promise<ApplicationDocument[]> {
    return (await http.get<ApiDataResponse<ApplicationDocument[]>>(`/applications/${applicationId}/documents`)).data.data
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
