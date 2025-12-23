import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/api-middleware'
import {
  validateFile,
  generateFilePath,
  FILE_SIZE_LIMITS,
  ALLOWED_MIME_TYPES,
} from '@/lib/storage/utils'
import type { ApiResponse, ErrorResponse } from '@/types/api'

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult // Error response
    }

    const { user } = authResult

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bucket = (formData.get('bucket') as string) || 'claim-evidence'
    const folder = (formData.get('folder') as string) || 'claims'

    if (!file) {
      const errorData: ErrorResponse = {
        success: false,
        error: 'No file provided',
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Validate file
    const validationError = validateFile(file, {
      maxSizeBytes: FILE_SIZE_LIMITS.DEFAULT,
      allowedMimeTypes: [...ALLOWED_MIME_TYPES.ALL],
    })

    if (validationError) {
      const errorData: ErrorResponse = {
        success: false,
        error: validationError.message,
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Create Supabase client
    const supabase = await createClient()

    // Generate file path
    const filePath = generateFilePath(file.name, folder, user.id)

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // Upload file
    const { error } = await supabase.storage.from(bucket).upload(filePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    })

    if (error) {
      console.error('File upload error:', error)
      const errorData: ErrorResponse = {
        success: false,
        error: error.message || 'Failed to upload file',
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(filePath)

    const responseData: ApiResponse = {
      success: true,
      data: {
        url: publicUrl,
        path: filePath,
        name: file.name,
        size: file.size,
        mimeType: file.type,
      } as any,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Upload error:', error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload file',
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await request.json()
    const { path, bucket = 'claim-evidence' } = body

    if (!path) {
      const errorData: ErrorResponse = {
        success: false,
        error: 'File path is required',
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase.storage.from(bucket).remove([path])

    if (error) {
      const errorData: ErrorResponse = {
        success: false,
        error: error.message,
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    const responseData: ApiResponse = {
      success: true,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete file',
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

