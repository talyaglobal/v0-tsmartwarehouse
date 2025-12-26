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

    // Determine validation rules based on bucket and folder
    const isLogoUpload = bucket === 'docs' && folder === 'logo'
    const isAvatarUpload = bucket === 'docs' && folder === 'avatar'
    const maxSizeBytes = (isLogoUpload || isAvatarUpload) ? 2 * 1024 * 1024 : FILE_SIZE_LIMITS.DEFAULT // 2MB for logos and avatars
    const allowedMimeTypes = (isLogoUpload || isAvatarUpload)
      ? ['image/jpeg', 'image/jpg', 'image/png'] 
      : [...ALLOWED_MIME_TYPES.ALL]

    // Validate file
    const validationError = validateFile(file, {
      maxSizeBytes,
      allowedMimeTypes,
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
    // For logo uploads, use logo folder without user ID prefix
    // For avatar uploads, use avatar folder with user ID prefix
    const filePath = isLogoUpload
      ? `logo/${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      : isAvatarUpload
      ? `avatar/${user.id}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      : generateFilePath(file.name, folder, user.id)

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // Determine content type from file extension if file.type is not reliable
    // Some browsers may send incorrect MIME types, so we'll use file extension as fallback
    let contentType = file.type
    
    // If MIME type is not reliable (e.g., text/plain), determine from file extension
    if (!contentType || contentType === 'text/plain' || contentType.includes('text/plain')) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      const mimeTypeMap: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'pdf': 'application/pdf',
      }
      if (fileExtension && mimeTypeMap[fileExtension]) {
        contentType = mimeTypeMap[fileExtension]
      }
    }
    
    // Normalize image/jpeg to image/jpg for Supabase compatibility
    if (contentType === 'image/jpeg') {
      contentType = 'image/jpg'
    }

    // Upload file with explicit content type
    const { error } = await supabase.storage.from(bucket).upload(filePath, fileBuffer, {
      contentType: contentType,
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

