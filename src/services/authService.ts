import { http } from './http'

export interface ApiDataResponse<T> {
  data: T
}

export interface UserSummary {
  id: string
  phone: string | null
  email: string | null
  role: 'CITIZEN' | 'ADMIN' | 'STAFF'
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'DISABLED'
  phoneVerifiedAt: string | null
  emailVerifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CitizenProfile {
  id: string
  userId: string
  nameKh: string
  nameEn: string
  nationalIdNumber: string | null
  address: string | null
  profileImageUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface CurrentUser {
  user: UserSummary
  citizenProfile: CitizenProfile | null
}

export interface AuthSession {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  user: UserSummary
}

export interface LoginInput {
  identifier: string
  password: string
}

export interface RegisterInput {
  phone?: string
  email?: string
  verificationIdentifier?: string
  password: string
  nameKh: string
  nameEn: string
  nationalIdNumber?: string
  address?: string
}

export interface VerifyAccountInput {
  identifier: string
  code: string
}

export interface PasswordResetConfirmInput extends VerifyAccountInput {
  newPassword: string
}

export interface RegistrationResponse {
  message: string
  verificationRequired: boolean
  destinationHint: string | null
}

export const authService = {
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

  async confirmPasswordReset (input: PasswordResetConfirmInput) {
    return (await http.post<ApiDataResponse<RegistrationResponse>>('/auth/password-reset/confirm', input)).data.data
  },

  async refresh () {
    return (await http.post<ApiDataResponse<AuthSession>>('/auth/refresh')).data.data
  },

  async logout () {
    await http.post('/auth/logout')
  },

  async getCurrentUser () {
    return (await http.get<ApiDataResponse<CurrentUser>>('/users/me')).data.data
  },
}
