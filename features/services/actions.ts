'use server'

import { fetchServices, fetchServiceById } from './lib/queries'

/**
 * Get all services with optional filtering
 */
export async function getServices(filters?: {
  category?: string
  isActive?: boolean
}) {
  try {
    const services = await fetchServices({
      category: filters?.category as any,
      isActive: filters?.isActive,
    })
    return { success: true, data: services }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get a single service by ID
 */
export async function getServiceById(id: string) {
  try {
    const service = await fetchServiceById(id)
    if (!service) {
      return { success: false, error: 'Service not found' }
    }
    return { success: true, data: service }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

