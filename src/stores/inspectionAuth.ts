import { authService, type AuthSession, type CurrentUser, type LoginInput } from '@/services/authService'
import { clearInspectionAccessToken, setInspectionAccessToken } from '@/services/http'

export const useInspectionAuthStore = defineStore(
  'inspection-auth',
  () => {
    const accessToken = ref<string | null>(null)
    const currentUser = ref<CurrentUser | null>(null)
    const hasRestoredSession = ref(false)
    const isAuthenticated = computed(() => accessToken.value !== null && currentUser.value !== null)
    const isCitizen = computed(() => currentUser.value?.user.role === 'CITIZEN')

    async function applySession (session: AuthSession) {
      accessToken.value = session.accessToken
      setInspectionAccessToken(session.accessToken)
      currentUser.value = await authService.getCurrentUser()
      hasRestoredSession.value = true
    }

    async function login (input: LoginInput) {
      await applySession(await authService.login(input))
    }

    function clearSession () {
      accessToken.value = null
      currentUser.value = null
      clearInspectionAccessToken()
    }

    async function restoreSession () {
      if (hasRestoredSession.value) {
        return
      }

      hasRestoredSession.value = true
      try {
        await applySession(await authService.refresh())
      } catch {
        clearSession()
      }
    }

    async function logout () {
      try {
        await authService.logout()
      } finally {
        clearSession()
      }
    }

    return {
      accessToken,
      applySession,
      clearSession,
      currentUser,
      hasRestoredSession,
      isAuthenticated,
      isCitizen,
      login,
      logout,
      restoreSession,
    }
  },
)
