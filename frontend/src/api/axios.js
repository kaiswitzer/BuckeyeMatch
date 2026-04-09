import axios from 'axios'

const DEFAULT_PROD_API_URL = 'https://buckeyematch.onrender.com/api'

/** API base URL: must end with `/api` (e.g. from VITE_API_URL at build time). */
export function getApiBaseURL() {
  // In dev, prefer the Vite proxy (`/api` → backend)
  if (import.meta.env.DEV) return import.meta.env.VITE_API_URL || '/api'
  return import.meta.env.VITE_API_URL || DEFAULT_PROD_API_URL
}

const API_URL = getApiBaseURL()

const api = axios.create({
  baseURL: API_URL,
  headers: {
    Accept: 'application/json',
  },
})

// Keep your interceptor as it was
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    const contentType = String(response.headers?.['content-type'] || '').toLowerCase()
    const looksLikeHtml =
      contentType.includes('text/html') ||
      (typeof response.data === 'string' && /<!doctype\s+html|<html[\s>]/i.test(response.data))

    if (looksLikeHtml) {
      const err = new Error(
        `API returned HTML (likely hit Vite dev server). baseURL=${API_URL} url=${response.config?.url}`
      )
      err.name = 'UnexpectedHtmlResponseError'
      err.response = response
      throw err
    }

    return response
  },
  (error) => Promise.reject(error)
)

export default api