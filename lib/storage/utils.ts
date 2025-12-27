/**
 * File storage utilities for Supabase Storage
 */

export interface FileUploadOptions {
  folder?: string
  maxSizeBytes?: number
  allowedMimeTypes?: string[]
  userId?: string
}

export interface FileUploadResult {
  url: string
  path: string
  name: string
  size: number
  mimeType: string
}

export interface FileValidationError {
  field: string
  message: string
}

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  IMAGE: 10 * 1024 * 1024, // 10MB
  VIDEO: 100 * 1024 * 1024, // 100MB
  PDF: 10 * 1024 * 1024, // 10MB
  DOCUMENT: 10 * 1024 * 1024, // 10MB
  DEFAULT: 10 * 1024 * 1024, // 10MB
} as const

// Allowed MIME types
export const ALLOWED_MIME_TYPES = {
  IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  PDF: ['application/pdf'],
  VIDEOS: [
    'video/mp4',
    'video/webm',
    'video/quicktime', // .mov
    'video/x-msvideo', // .avi
  ],
  DOCUMENTS: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/plain',
  ],
  ALL: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ],
} as const

/**
 * Validate file before upload
 */
export function validateFile(
  file: File,
  options: FileUploadOptions = {}
): FileValidationError | null {
  const {
    maxSizeBytes = FILE_SIZE_LIMITS.DEFAULT,
    allowedMimeTypes = ALLOWED_MIME_TYPES.ALL,
  } = options

  // Check file size
  if (file.size > maxSizeBytes) {
    const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(1)
    return {
      field: 'size',
      message: `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
    }
  }

  // Check MIME type
  if (!allowedMimeTypes.includes(file.type as any)) {
    return {
      field: 'type',
      message: `File type "${file.type}" is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`,
    }
  }

  return null
}

/**
 * Validate multiple files
 */
export function validateFiles(
  files: File[],
  options: FileUploadOptions = {}
): { valid: File[]; errors: FileValidationError[] } {
  const valid: File[] = []
  const errors: FileValidationError[] = []

  files.forEach((file, index) => {
    const error = validateFile(file, options)
    if (error) {
      errors.push({
        ...error,
        field: `${error.field}_${index}`,
      })
    } else {
      valid.push(file)
    }
  })

  return { valid, errors }
}

/**
 * Generate a unique file path
 */
export function generateFilePath(
  fileName: string,
  folder: string = 'uploads',
  userId?: string
): string {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
  const userIdPrefix = userId ? `${userId}/` : ''

  return `${folder}/${userIdPrefix}${timestamp}_${randomString}_${sanitizedFileName}`
}

/**
 * Get file extension from MIME type
 */
export function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt',
  }

  return mimeToExt[mimeType] || 'bin'
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Check if file is an image
 */
export function isImageFile(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.IMAGES.includes(mimeType as any)
}

/**
 * Check if file is a PDF
 */
export function isPdfFile(mimeType: string): boolean {
  return mimeType === 'application/pdf'
}

/**
 * Get file icon based on MIME type
 */
export function getFileIcon(mimeType: string): string {
  if (isImageFile(mimeType)) return 'image'
  if (isPdfFile(mimeType)) return 'file'
  if (mimeType.includes('word')) return 'file'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'file'
  return 'file'
}

