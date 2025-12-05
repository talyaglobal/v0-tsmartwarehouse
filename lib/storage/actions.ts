'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/utils'
import {
  validateFile,
  generateFilePath,
  FILE_SIZE_LIMITS,
  ALLOWED_MIME_TYPES,
  type FileUploadOptions,
} from './utils'

export interface UploadFileResult {
  success: boolean
  url?: string
  path?: string
  error?: string
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  file: File,
  bucket: string = 'claim-evidence',
  options: FileUploadOptions = {}
): Promise<UploadFileResult> {
  try {
    // Require authentication
    const user = await requireAuth()

    // Validate file
    const validationError = validateFile(file, {
      maxSizeBytes: options.maxSizeBytes || FILE_SIZE_LIMITS.DEFAULT,
      allowedMimeTypes: options.allowedMimeTypes || [...ALLOWED_MIME_TYPES.ALL],
    })

    if (validationError) {
      return {
        success: false,
        error: validationError.message,
      }
    }

    // Create Supabase client
    const supabase = await createClient()

    // Generate file path
    const filePath = generateFilePath(file.name, options.folder || 'claims', user.id)

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
      return {
        success: false,
        error: error.message || 'Failed to upload file',
      }
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(filePath)

    return {
      success: true,
      url: publicUrl,
      path: filePath,
    }
  } catch (error) {
    console.error('Upload file error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload file',
    }
  }
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(
  filePath: string,
  bucket: string = 'claim-evidence'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Require authentication
    await requireAuth()

    const supabase = await createClient()

    const { error } = await supabase.storage.from(bucket).remove([filePath])

    if (error) {
      return {
        success: false,
        error: error.message,
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete file',
    }
  }
}

/**
 * Get signed URL for private file access
 */
export async function getSignedUrl(
  filePath: string,
  bucket: string = 'claim-evidence',
  expiresIn: number = 3600
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Require authentication
    await requireAuth()

    const supabase = await createClient()

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn)

    if (error) {
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
      url: data.signedUrl,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get signed URL',
    }
  }
}

