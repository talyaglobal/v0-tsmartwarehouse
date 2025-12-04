import { NextRequest, NextResponse } from 'next/server'
import { getCsrfToken } from '@/lib/security/csrf'
import { applySecurityHeaders } from '@/lib/security/headers'
import type { ApiResponse, ErrorResponse } from '@/types/api'

/**
 * GET /api/csrf-token
 * Get CSRF token for client-side use
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getCsrfToken()
    
    const responseData: ApiResponse = {
      success: true,
      data: { token } as any,
    }
    const response = NextResponse.json(responseData)

    return applySecurityHeaders(response)
  } catch (error) {
    const errorData: ErrorResponse = {
      success: false,
      error: 'Failed to generate CSRF token',
      statusCode: 500,
    }
    const response = NextResponse.json(errorData, { status: 500 })

    return applySecurityHeaders(response)
  }
}

