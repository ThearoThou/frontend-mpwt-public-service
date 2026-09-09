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
  nameEn: string | null
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
  nameEn?: string | null
  nationalIdNumber?: string
  address?: string
}

export interface VerifyAccountInput {
  identifier: string
  code: string
}

export interface PasswordResetVerifyInput extends VerifyAccountInput {}

export interface PasswordResetConfirmInput {
  resetToken: string
  newPassword: string
}

export interface RegistrationResponse {
  message: string
  verificationRequired: boolean
  destinationHint: string | null
  development?: {
    developmentCode: string
    purpose: 'REGISTER_ACCOUNT' | 'RESET_PASSWORD' | 'CHANGE_PHONE'
  }
}

export interface RegistrationVerificationResponse extends RegistrationResponse {
  expiresInSeconds: number
}

export interface PasswordResetRequestResponse extends RegistrationResponse {
  expiresInSeconds: number
}

export interface PasswordResetVerifyResponse {
  resetToken: string
  expiresInSeconds: number
}

export interface CitizenProfileUpdateInput {
  nameKh?: string
  nameEn?: string | null
}
