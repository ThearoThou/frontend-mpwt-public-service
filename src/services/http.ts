import type { ApiDataResponse, AuthSession } from '@/modules/inspection/auth/types/auth.types'
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    _inspectionAccessToken?: string
    _inspectionAuthRetry?: boolean
    _skipInspectionAuthRefresh?: boolean
  }
}

type InspectionRequestConfig = InternalAxiosRequestConfig

type InspectionAuthStateHandlers = {
  onAccessTokenRefreshed: (token: string) => void
  onRefreshFailure: () => void
}

const inspectionAuthEndpoints = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/verify',
  '/auth/resend-verification',
  '/auth/password-reset/request',
  '/auth/password-reset/verify',
  '/auth/password-reset/confirm',
  '/auth/refresh',
  '/auth/logout',
])

let accessToken: string | null = null
let inspectionAuthStateHandlers: InspectionAuthStateHandlers | null = null
let refreshPromise: Promise<AuthSession> | null = null

export function setInspectionAccessToken (token: string | null) {
  accessToken = token
}

export function clearInspectionAccessToken () {
  accessToken = null
}

export function setInspectionAuthStateHandlers (handlers: InspectionAuthStateHandlers) {
  inspectionAuthStateHandlers = handlers
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL?.replace(/\/$/, ''),
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
})

http.interceptors.request.use(config => {
  if (accessToken !== null && !isInspectionAuthEndpoint(config.url)) {
    config.headers.Authorization = `Bearer ${accessToken}`
    config._inspectionAccessToken = accessToken
  }

  return config
})

http.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const config = error.config as InspectionRequestConfig | undefined

    if (
      error.response?.status !== 401
      || config === undefined
      || accessToken === null
      || config._inspectionAuthRetry
      || config._skipInspectionAuthRefresh
      || isInspectionAuthEndpoint(config.url)
    ) {
      throw error
    }

    config._inspectionAuthRetry = true

    if (config._inspectionAccessToken !== accessToken) {
      return http.request(config)
    }

    try {
      await refreshInspectionAuthSession()
      return http.request(config)
    } catch {
      throw error
    }
  },
)

export async function refreshInspectionAuthSession (): Promise<AuthSession> {
  if (refreshPromise !== null) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      const session = (await http.post<ApiDataResponse<AuthSession>>(
        '/auth/refresh',
        undefined,
        { _skipInspectionAuthRefresh: true },
      )).data.data

      setInspectionAccessToken(session.accessToken)
      inspectionAuthStateHandlers?.onAccessTokenRefreshed(session.accessToken)
      return session
    } catch (error) {
      clearInspectionAccessToken()
      inspectionAuthStateHandlers?.onRefreshFailure()
      throw error
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

function isInspectionAuthEndpoint (url: string | undefined): boolean {
  if (url === undefined) {
    return false
  }

  const path = url
    .replace(/^https?:\/\/[^/]+/iu, '')
    .replace(/[?#].*$/u, '')

  return inspectionAuthEndpoints.has(path)
    || Array.from(inspectionAuthEndpoints).some(endpoint => path.endsWith(`/api${endpoint}`))
}
