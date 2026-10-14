import type { ApiDataResponse, AuthSession, ChangePasswordInput, CitizenProfile, CitizenProfileUpdateInput, CurrentUser, LoginInput, PasswordResetConfirmInput, PasswordResetRequestResponse, PasswordResetVerifyInput, PasswordResetVerifyResponse, RegisterInput, RegistrationResponse, RegistrationVerificationResponse, VerifyAccountInput, VerifyEmailChangeInput } from '../types/auth.types'
import { http, refreshInspectionAuthSession } from '@/services/http'

export const inspectionAuthService = {
  async register (input: RegisterInput) {
    return (await http.post<ApiDataResponse<RegistrationVerificationResponse>>('/auth/register', input)).data.data
  },
  async verifyAccount (input: VerifyAccountInput) {
    return (await http.post<ApiDataResponse<AuthSession>>('/auth/verify', input)).data.data
  },
  async resendVerification (identifier: string) {
    return (await http.post<ApiDataResponse<RegistrationVerificationResponse>>('/auth/resend-verification', { identifier })).data.data
  },
  async login (input: LoginInput) {
    return (await http.post<ApiDataResponse<AuthSession>>('/auth/login', input)).data.data
  },
  async requestPasswordReset (identifier: string) {
    return (await http.post<ApiDataResponse<PasswordResetRequestResponse>>('/auth/password-reset/request', { identifier })).data.data
  },
  async verifyPasswordReset (input: PasswordResetVerifyInput) {
    return (await http.post<ApiDataResponse<PasswordResetVerifyResponse>>('/auth/password-reset/verify', input)).data.data
  },
  async confirmPasswordReset (input: PasswordResetConfirmInput) {
    return (await http.post<ApiDataResponse<RegistrationResponse>>('/auth/password-reset/confirm', input)).data.data
  },
  async refresh () {
    return refreshInspectionAuthSession()
  },
  async logout () {
    await http.post('/auth/logout')
  },
  async getCurrentUser () {
    return (await http.get<ApiDataResponse<CurrentUser>>('/users/me')).data.data
  },
  async updateCitizenProfile (input: CitizenProfileUpdateInput) {
    return (await http.patch<ApiDataResponse<CurrentUser>>('/users/me/citizen-profile', input)).data.data
  },
  async requestEmailChange (email: string) {
    return (await http.post<ApiDataResponse<{ expiresInSeconds: number }>>('/users/me/email-change/request', { email })).data.data
  },
  async verifyEmailChange (input: VerifyEmailChangeInput) {
    return (await http.post<ApiDataResponse<CurrentUser>>('/users/me/email-change/verify', input)).data.data
  },
  async changePassword (input: ChangePasswordInput) {
    return (await http.post<ApiDataResponse<AuthSession>>('/auth/change-password', input)).data.data
  },
}
