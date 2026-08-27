import type { AuthSession, CitizenProfileUpdateInput, CurrentUser, LoginInput } from '../types/auth.types'
import { clearInspectionAccessToken, setInspectionAccessToken, setInspectionAuthStateHandlers } from '@/services/http'
import { inspectionAuthService } from '../services/auth.service'

export const useInspectionAuthStore = defineStore('inspection-auth', () => {
  const accessToken = ref<string | null>(null)
  const currentUser = ref<CurrentUser | null>(null)
  const passwordResetCode = ref<string | null>(null)
  const passwordResetIdentifier = ref<string | null>(null)
  const hasRestoredSession = ref(false)
  let restorationPromise: Promise<void> | null = null
  const isAuthenticated = computed(() => accessToken.value !== null && currentUser.value !== null)
  const isCitizen = computed(() => currentUser.value?.user.role === 'CITIZEN')

  async function applySession (session: AuthSession) {
    accessToken.value = session.accessToken
    setInspectionAccessToken(session.accessToken)
    try {
      currentUser.value = await inspectionAuthService.getCurrentUser()
      hasRestoredSession.value = true
    } catch (error) {
      clearSession()
      throw error
    }
  }

  async function login (input: LoginInput) {
    await applySession(await inspectionAuthService.login(input))
  }

  async function updateCitizenProfile (input: CitizenProfileUpdateInput) {
    const profile = await inspectionAuthService.updateCitizenProfile(input)
    if (currentUser.value !== null) {
      currentUser.value = { ...currentUser.value, citizenProfile: profile }
    }
    return profile
  }

  function clearSession () {
    accessToken.value = null
    currentUser.value = null
    clearInspectionAccessToken()
  }

  function setPasswordResetVerification (identifier: string, code: string) {
    passwordResetIdentifier.value = identifier
    passwordResetCode.value = code
  }

  function clearPasswordResetVerification () {
    passwordResetIdentifier.value = null
    passwordResetCode.value = null
  }

  setInspectionAuthStateHandlers({
    onAccessTokenRefreshed: token => {
      accessToken.value = token
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
    try {
      await inspectionAuthService.logout()
    } finally {
      clearSession()
    }
  }

  return { accessToken, applySession, clearPasswordResetVerification, clearSession, currentUser, hasRestoredSession, isAuthenticated, isCitizen, login, logout, passwordResetCode, passwordResetIdentifier, restoreSession, setPasswordResetVerification, updateCitizenProfile }
})
