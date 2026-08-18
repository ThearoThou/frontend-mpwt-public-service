import axios, { type AxiosError } from 'axios'

let accessToken: string | null = null

export function setInspectionAccessToken (token: string | null) {
  accessToken = token
}

export function clearInspectionAccessToken () {
  accessToken = null
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL?.replace(/\/$/, ''),
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
})

http.interceptors.request.use(config => {
  if (accessToken !== null) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

http.interceptors.response.use(
  response => response,
  (error: AxiosError) => Promise.reject(error),
)
