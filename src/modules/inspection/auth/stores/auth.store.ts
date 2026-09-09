import type { AuthSession, CitizenProfileUpdateInput, CurrentUser, LoginInput, PasswordResetVerifyResponse, RegisterInput, RegistrationVerificationResponse } from '../types/auth.types'
import { clearInspectionAccessToken, setInspectionAccessToken, setInspectionAuthStateHandlers } from '@/services/http'
import { inspectionAuthService } from '../services/auth.service'

const INSPECTION_ACCESS_TOKEN_STORAGE_KEY = 'mpwt.inspection.access-token'

export const useInspectionAuthStore = defineStore('inspection-auth', () => {
  const accessToken = ref<string | null>(null)
  const currentUser = ref<CurrentUser | null>(null)
  const registrationVerification = ref<{ identifier: string, expiresAt: number } | null>(null)
  const passwordResetRequest = ref<{ identifier: string, expiresAt: number } | null>(null)
  const passwordResetAuthorization = ref<{ identifier: string, resetToken: string, expiresAt: number } | null>(null)
  const hasRestoredSession = ref(false)
  const logoutInProgress = ref(false)
  let restorationPromise: Promise<void> | null = null
  let logoutPromise: Promise<void> | null = null
  const isAuthenticated = computed(() => accessToken.value !== null && currentUser.value !== null)
  const isCitizen = computed(() => currentUser.value?.user.role === 'CITIZEN')

  function setAccessToken (token: string) {
    accessToken.value = token
    setInspectionAccessToken(token)
    sessionStorage.setItem(INSPECTION_ACCESS_TOKEN_STORAGE_KEY, token)
  }

  function clearAccessToken () {
    accessToken.value = null
    clearInspectionAccessToken()
    sessionStorage.removeItem(INSPECTION_ACCESS_TOKEN_STORAGE_KEY)
  }

  async function applySession (session: AuthSession) {
    setAccessToken(session.accessToken)

    // Login and refresh already return a server-validated user summary. Use it
    // immediately so a transient profile request cannot make a valid sign-in
    // look like an incorrect password.
    currentUser.value = {
      user: session.user,
      citizenProfile: null,
    }
    hasRestoredSession.value = true

    try {
      currentUser.value = await inspectionAuthService.getCurrentUser()
    } catch {
      // The session response is authoritative. Keep the signed-in state and
      // leave optional profile information empty until it is fetched again.
    }
  }

  async function login (input: LoginInput) {
    await applySession(await inspectionAuthService.login(input))
  }

  function setRegistrationVerification (identifier: string, response: RegistrationVerificationResponse, requestedAt: number) {
    registrationVerification.value = Number.isFinite(response.expiresInSeconds) && response.expiresInSeconds > 0
      ? { identifier, expiresAt: requestedAt + response.expiresInSeconds * 1000 }
      : null
  }

  async function register (input: RegisterInput, identifier: string) {
    // Anchor to request start so network latency cannot extend the code lifetime.
    const requestedAt = Date.now()
    const response = await inspectionAuthService.register(input)
    setRegistrationVerification(identifier, response, requestedAt)
    return response
  }

  async function resendRegistrationVerification (identifier: string) {
    const requestedAt = Date.now()
    const response = await inspectionAuthService.resendVerification(identifier)
    setRegistrationVerification(identifier, response, requestedAt)
    return response
  }

  function clearRegistrationVerification () {
    registrationVerification.value = null
  }

  async function updateCitizenProfile (input: CitizenProfileUpdateInput) {
    const profile = await inspectionAuthService.updateCitizenProfile(input)
    if (currentUser.value !== null) {
      currentUser.value = { ...currentUser.value, citizenProfile: profile }
    }
    return profile
  }

  function clearSession () {
    clearAccessToken()
    currentUser.value = null
  }

  async function requestPasswordReset (identifier: string) {
    // Anchor to request start so network latency cannot extend the code lifetime.
    const requestedAt = Date.now()
    const response = await inspectionAuthService.requestPasswordReset(identifier)
    passwordResetAuthorization.value = null
    passwordResetRequest.value = Number.isFinite(response.expiresInSeconds) && response.expiresInSeconds > 0
      ? { identifier, expiresAt: requestedAt + response.expiresInSeconds * 1000 }
      : null
  }

  function setPasswordResetAuthorization (identifier: string, response: PasswordResetVerifyResponse, verifiedAt: number) {
    passwordResetRequest.value = null
    passwordResetAuthorization.value = Number.isFinite(response.expiresInSeconds) && response.expiresInSeconds > 0
      ? { identifier, resetToken: response.resetToken, expiresAt: verifiedAt + response.expiresInSeconds * 1000 }
      : null
  }

  function clearPasswordResetVerification () {
    passwordResetRequest.value = null
    passwordResetAuthorization.value = null
  }

  setInspectionAuthStateHandlers({
    onAccessTokenRefreshed: token => {
      setAccessToken(token)
    },
    onRefreshFailure: clearSession,
  })

  async function restoreSession () {
    if (restorationPromise !== null) {
      return restorationPromise
    }

    if (hasRestoredSession.value) {
      return
    }

    restorationPromise = (async () => {
      hasRestoredSession.value = true
      try {
        const storedAccessToken = sessionStorage.getItem(INSPECTION_ACCESS_TOKEN_STORAGE_KEY)
        if (storedAccessToken !== null) {
          setAccessToken(storedAccessToken)
          try {
            currentUser.value = await inspectionAuthService.getCurrentUser()
            return
          } catch {
            clearSession()
          }
        }

        await applySession(await inspectionAuthService.refresh())
      } catch {
        clearSession()
      }
    })()

    try {
      await restorationPromise
    } finally {
      restorationPromise = null
    }
  }

  async function logout () {
    if (logoutPromise !== null) {
      return logoutPromise
    }

    logoutInProgress.value = true
    logoutPromise = (async () => {
      try {
        await inspectionAuthService.logout()
      } catch {
        // The local session must still be cleared if the server logout request fails.
      } finally {
        clearSession()
      }
    })()

    try {
      await logoutPromise
    } finally {
      logoutPromise = null
      logoutInProgress.value = false
    }
  }

  return { accessToken, applySession, clearPasswordResetVerification, clearRegistrationVerification, clearSession, currentUser, hasRestoredSession, isAuthenticated, isCitizen, login, logout, logoutInProgress, passwordResetAuthorization, passwordResetRequest, register, registrationVerification, requestPasswordReset, resendRegistrationVerification, restoreSession, setPasswordResetAuthorization, updateCitizenProfile }
})
