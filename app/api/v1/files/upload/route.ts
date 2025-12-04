import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/api-middleware'
import {
  validateFile,
  generateFilePath,
  FILE_SIZE_LIMITS,
  ALLOWED_MIME_TYPES,
} from '@/lib/storage/utils'

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
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file
    const validationError = validateFile(file, {
      maxSizeBytes: FILE_SIZE_LIMITS.DEFAULT,
      allowedMimeTypes: ALLOWED_MIME_TYPES.ALL,
    })

    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError.message },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = await createClient()

    // Generate file path
    const filePath = generateFilePath(file.name, folder, user.id)

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // Upload file
    const { data, error } = await supabase.storage.from(bucket).upload(filePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    })

    if (error) {
      console.error('File upload error:', error)
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(filePath)

    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        path: filePath,
        name: file.name,
        size: file.size,
        mimeType: file.type,
      },
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload file',
      },
      { status: 500 }
    )
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
      return NextResponse.json(
        { success: false, error: 'File path is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { error } = await supabase.storage.from(bucket).remove([path])

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete file',
      },
      { status: 500 }
    )
  }
}

