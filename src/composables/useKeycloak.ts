// Handles Keycloak SDK interaction
import Keycloak from 'keycloak-js'

export type KeycloakUserInfo = {
  exp: number
  iat: number
  auth_time: number
  jti: string
  iss: string
  aud: string
  sub: string
  typ: string
  azp: string
  nonce: string
  sid: string
  at_hash: string
  acr: string
  email_verified: boolean
  phone: string
  name: string
  preferred_username: string
  avatar: string
  given_name: string
  family_name: string
  email: string
}

export function useKeycloak () {
  const isEnabled = import.meta.env.VITE_ENABLE_KEYCLOAK !== 'false'

  if (!isEnabled) {
    const mockUser: KeycloakUserInfo = {
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      auth_time: Math.floor(Date.now() / 1000),
      jti: 'mock-jti',
      iss: 'mock-issuer',
      aud: 'mock-audience',
      sub: 'mock-sub',
      typ: 'Bearer',
      azp: 'mock-azp',
      nonce: 'mock-nonce',
      sid: 'mock-sid',
      at_hash: 'mock-at-hash',
      acr: 'mock-acr',
      email_verified: true,
      phone: '012 345 678',
      name: 'គណនី សាកល្បង (Demo User)',
      preferred_username: 'demouser',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop',
      given_name: 'សាកល្បង',
      family_name: 'គណនី',
      email: 'demo.user@example.com',
    }

    return {
      init: () => Promise.resolve(true),
      login: () => Promise.resolve(),
      logout: () => Promise.resolve(),
      updateToken: (minValidity: number) => Promise.resolve(false),
      getToken: () => 'mock-token-xyz123',
      getUserInfo: (): KeycloakUserInfo | null => mockUser,
    }
  }

  const keycloak = new Keycloak({
    url: import.meta.env.VITE_KEYCLOAK_URL,
    realm: import.meta.env.VITE_KEYCLOAK_REALM,
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
  })

  return {
    init: () => keycloak.init({ onLoad: 'login-required' }),
    login: () => keycloak.login(),
    logout: () => keycloak.logout(),
    updateToken: (minValidity: number) => keycloak.updateToken(minValidity),
    getToken: () => keycloak.token || null,
    getUserInfo: (): KeycloakUserInfo | null =>
      (keycloak.idTokenParsed as KeycloakUserInfo | undefined) ?? null,
  }
}
