import type { ApiDataResponse, AuthSession, CurrentUser, LoginInput, PasswordResetConfirmInput, PasswordResetVerifyInput, RegisterInput, RegistrationResponse, VerifyAccountInput } from '../types/auth.types'
import { http, refreshInspectionAuthSession } from '@/services/http'

export const inspectionAuthService = {
  async register (input: RegisterInput) {
    return (await http.post<ApiDataResponse<RegistrationResponse>>('/auth/register', input)).data.data
  },
  async verifyAccount (input: VerifyAccountInput) {
    return (await http.post<ApiDataResponse<AuthSession>>('/auth/verify', input)).data.data
  },
  async resendVerification (identifier: string) {
    return (await http.post<ApiDataResponse<RegistrationResponse>>('/auth/resend-verification', { identifier })).data.data
  },
  async login (input: LoginInput) {
    return (await http.post<ApiDataResponse<AuthSession>>('/auth/login', input)).data.data
  },
  async requestPasswordReset (identifier: string) {
    return (await http.post<ApiDataResponse<RegistrationResponse>>('/auth/password-reset/request', { identifier })).data.data
  },
  async verifyPasswordReset (input: PasswordResetVerifyInput) {
    return (await http.post<ApiDataResponse<RegistrationResponse>>('/auth/password-reset/verify', input)).data.data
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
}
