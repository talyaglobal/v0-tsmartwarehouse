/**
 * API Client with automatic toast notifications
 * Wraps fetch to show success/error toasts for all API responses
 */

import { useUIStore } from '@/stores/ui.store'

interface ApiClientOptions extends RequestInit {
  showToast?: boolean
  successMessage?: string
  errorMessage?: string
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  [key: string]: any
}

/**
 * Get UI store instance (works in client components)
 */
function getUIStore() {
  if (typeof window === 'undefined') {
    // Server-side: return a no-op store
    return {
      addNotification: () => {},
    }
  }
  try {
    return useUIStore.getState()
  } catch {
    // Store not available (e.g., during SSR)
    return {
      addNotification: () => {},
    }
  }
}

/**
 * Extract error message from response
 */
function getErrorMessage(response: ApiResponse, defaultMessage: string): string {
  if (response.error) {
    return response.error
  }
  if (response.message && !response.success) {
    return response.message
  }
  return defaultMessage
}

/**
 * Extract success message from response
 */
function getSuccessMessage(response: ApiResponse, defaultMessage: string): string {
  if (response.message && response.success) {
    return response.message
  }
  return defaultMessage
}

/**
 * API Client - Wrapper around fetch with automatic toast notifications
 */
export async function apiClient<T = any>(
  url: string,
  options: ApiClientOptions = {}
): Promise<ApiResponse<T>> {
  const {
    showToast = true,
    successMessage,
    errorMessage,
    ...fetchOptions
  } = options

  try {
    // Don't set Content-Type for FormData (browser will set it with boundary)
    const isFormData = fetchOptions.body instanceof FormData
    const headers: HeadersInit = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...fetchOptions.headers,
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    })

    const data: ApiResponse<T> = await response.json()

    // Show toast notifications
    if (showToast) {
      const uiStore = getUIStore()

      if (response.ok && data.success !== false) {
        // Success response
        const message = successMessage || getSuccessMessage(data, 'Operation completed successfully')
        uiStore.addNotification({
          type: 'success',
          message,
          duration: 5000,
        })
      } else {
        // Error response
        const message = errorMessage || getErrorMessage(data, 'An error occurred')
        uiStore.addNotification({
          type: 'error',
          message,
          duration: 5000,
        })
      }
    }

    return data
  } catch (error) {
    // Network error or parsing error
    if (showToast) {
      const uiStore = getUIStore()
      const message = errorMessage || (error instanceof Error ? error.message : 'Network error occurred')
      uiStore.addNotification({
        type: 'error',
        message,
        duration: 5000,
      })
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    }
  }
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get: <T = any>(url: string, options?: ApiClientOptions) =>
    apiClient<T>(url, { ...options, method: 'GET' }),

  post: <T = any>(url: string, body?: any, options?: ApiClientOptions) =>
    apiClient<T>(url, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
    }),

  put: <T = any>(url: string, body?: any, options?: ApiClientOptions) =>
    apiClient<T>(url, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
    }),

  patch: <T = any>(url: string, body?: any, options?: ApiClientOptions) =>
    apiClient<T>(url, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
    }),

  delete: <T = any>(url: string, options?: ApiClientOptions) =>
    apiClient<T>(url, { ...options, method: 'DELETE' }),
}

