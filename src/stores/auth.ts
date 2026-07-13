// stores/auth.ts
import { defineStore } from 'pinia'
import { type KeycloakUserInfo, useKeycloak } from '@/composables/useKeycloak'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    user: null as KeycloakUserInfo | null,
    token: null as string | null,
  }),

  actions: {
    async initializeAuth () {
      const client = useKeycloak()
      const authenticated = await client.init()

      this.isAuthenticated = authenticated
      if (authenticated) {
        this.token = client.getToken()
        this.user = client.getUserInfo()
      }
    },

    async login () {
      const client = useKeycloak()
      await client.login()

      const isEnabled = import.meta.env.VITE_ENABLE_KEYCLOAK !== 'false'
      if (!isEnabled) {
        this.isAuthenticated = true
        this.token = client.getToken()
        this.user = client.getUserInfo()
      }
    },

    async refreshToken () {
      const client = useKeycloak()
      const refreshed = await client.updateToken(30)
      if (refreshed) {
        this.token = client.getToken()
      }
    },
    // getUserInfo

    async logout () {
      const client = useKeycloak()
      await client.logout() // redirects to Keycloak
      this.isAuthenticated = false
      this.user = null
      this.token = null
    },
  },
})
