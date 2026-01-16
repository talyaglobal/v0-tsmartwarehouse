"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { Upload, X, FileText, ImageIcon, Loader2, AlertCircle } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { formatFileSize, isImageFile } from "@/lib/storage/utils"
import Image from "next/image"
import { api } from "@/lib/api/client"

export interface UploadedFile {
  id: string
  file: File
  preview?: string
  url?: string
  path?: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

interface FileUploadProps {
  value?: UploadedFile[]
  onChange?: (files: UploadedFile[]) => void
  bucket?: string
  folder?: string
  maxSize?: number // in bytes
  maxFiles?: number
  acceptedFileTypes?: string[]
  disabled?: boolean
  className?: string
}

export function FileUpload({
  value = [],
  onChange,
  bucket = 'claim-evidence',
  folder,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 10,
  acceptedFileTypes,
  disabled = false,
  className = '',
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>(value)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync internal state with value prop when it changes externally
  useEffect(() => {
    if (value) {
      // Only update if value is actually different (by comparing IDs and statuses)
      const valueIds = value.map(v => v.id).sort().join(',')
      const filesIds = files.map(f => f.id).sort().join(',')
      const valueStatuses = value.map(v => `${v.id}:${v.status}`).sort().join(',')
      const filesStatuses = files.map(f => `${f.id}:${f.status}`).sort().join(',')
      
      if (valueIds !== filesIds || valueStatuses !== filesStatuses) {
        setFiles(value)
      }
    }
  }, [value])

  const updateFiles = useCallback((newFiles: UploadedFile[]) => {
    setFiles(newFiles)
    onChange?.(newFiles)
  }, [onChange])

  const validateAndAddFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    setError(null)

    // Check max files limit
    if (files.length + fileList.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed. You can upload ${maxFiles - files.length} more file(s).`)
      return
    }

    const newFiles: UploadedFile[] = Array.from(fileList).map((file) => {
      // Validate file size
      if (file.size > maxSize) {
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1)
        return {
          id: `${Date.now()}-${Math.random()}`,
          file,
          status: 'error' as const,
          error: `File size exceeds ${maxSizeMB}MB limit`,
        }
      }

      // Create preview for images
      let preview: string | undefined
      if (isImageFile(file.type)) {
        preview = URL.createObjectURL(file)
      }

      return {
        id: `${Date.now()}-${Math.random()}`,
        file,
        preview,
        status: 'pending' as const,
      }
    })

    updateFiles([...files, ...newFiles])

    // Upload files automatically
    for (const fileItem of newFiles) {
      if (fileItem.status === 'pending') {
        await uploadFileItem(fileItem)
      }
    }
  }, [files, maxFiles, maxSize, updateFiles])

  const uploadFileItem = useCallback(async (fileItem: UploadedFile) => {
    // Use functional update to get current state
    let uploadingFiles: UploadedFile[] = []
    setFiles((currentFiles) => {
      const fileIndex = currentFiles.findIndex((f) => f.id === fileItem.id)
      if (fileIndex === -1) return currentFiles

      // Update status to uploading
      const updatedFiles = [...currentFiles]
      updatedFiles[fileIndex] = { ...fileItem, status: 'uploading' }
      uploadingFiles = updatedFiles
      return updatedFiles
    })
    
    // Call onChange after state update (using setTimeout to avoid render phase update)
    if (uploadingFiles.length > 0) {
      setTimeout(() => onChange?.(uploadingFiles), 0)
    }

    // Create FormData for upload
    const formData = new FormData()
    formData.append('file', fileItem.file)
    formData.append('bucket', bucket)
    if (folder) formData.append('folder', folder)

    try {
      // Upload file via API route
      const result = await api.post('/api/v1/files/upload', formData, {
        showToast: true,
        successMessage: 'File uploaded successfully',
        errorMessage: 'File upload failed',
      })

      // Update with result using functional update
      let successFiles: UploadedFile[] = []
      setFiles((currentFiles) => {
        const finalFiles = [...currentFiles]
        const finalIndex = finalFiles.findIndex((f) => f.id === fileItem.id)
        if (finalIndex !== -1) {
          if (result.success && result.data) {
            finalFiles[finalIndex] = {
              ...fileItem,
              url: result.data.url,
              path: result.data.path,
              status: 'success',
            }
          } else {
            finalFiles[finalIndex] = {
              ...fileItem,
              status: 'error',
              error: result.error || 'Upload failed',
            }
          }
          successFiles = finalFiles
        }
        return finalFiles
      })
      
      // Call onChange after state update (using setTimeout to avoid render phase update)
      if (successFiles.length > 0) {
        setTimeout(() => onChange?.(successFiles), 0)
      }
    } catch (error) {
      // Update with error using functional update
      let errorFiles: UploadedFile[] = []
      setFiles((currentFiles) => {
        const finalFiles = [...currentFiles]
        const finalIndex = finalFiles.findIndex((f) => f.id === fileItem.id)
        if (finalIndex !== -1) {
          finalFiles[finalIndex] = {
            ...fileItem,
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed',
          }
          errorFiles = finalFiles
        }
        return finalFiles
      })
      
      // Call onChange after state update (using setTimeout to avoid render phase update)
      if (errorFiles.length > 0) {
        setTimeout(() => onChange?.(errorFiles), 0)
      }
    }
  }, [bucket, folder, onChange])

  const removeFile = useCallback((id: string) => {
    const fileToRemove = files.find((f) => f.id === id)
    if (fileToRemove?.preview) {
      URL.revokeObjectURL(fileToRemove.preview)
    }
    const newFiles = files.filter((f) => f.id !== id)
    updateFiles(newFiles)
  }, [files, updateFiles])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const fileList = e.dataTransfer.files
    validateAndAddFiles(fileList)
  }, [disabled, validateAndAddFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndAddFiles(e.target.files)
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [validateAndAddFiles])

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }, [disabled])

  const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1)

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
          ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50'}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedFileTypes?.join(',')}
          onChange={handleFileSelect}
          disabled={disabled}
          className="hidden"
        />
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Drag and drop files here, or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Supports: Images, PDFs, Documents (Max {maxSizeMB}MB each, {maxFiles} files max)
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((fileItem) => (
            <FileItem
              key={fileItem.id}
              file={fileItem}
              onRemove={() => removeFile(fileItem.id)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FileItem({
  file,
  onRemove,
  disabled,
}: {
  file: UploadedFile
  onRemove: () => void
  disabled?: boolean
}) {
  const Icon = isImageFile(file.file.type) ? ImageIcon : FileText
  // Use preview first, then url, for image display
  const imageSrc = file.preview || file.url
  const normalizedImageSrc = imageSrc
    ? imageSrc.startsWith("/") ||
      imageSrc.startsWith("http://") ||
      imageSrc.startsWith("https://") ||
      imageSrc.startsWith("blob:") ||
      imageSrc.startsWith("data:")
      ? imageSrc
      : `/${imageSrc}`
    : undefined

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
      {/* Preview/Icon */}
      <div className="flex-shrink-0">
        {normalizedImageSrc ? (
          <div className="relative w-12 h-12 rounded overflow-hidden bg-muted">
            <Image
              src={normalizedImageSrc}
              alt={file.file.name}
              fill
              className="object-cover"
              sizes="48px"
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.file.name}</p>
        {file.file.size > 0 && (
          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.file.size)}
          </p>
        )}
        {file.status === 'success' && file.url && file.file.size === 0 && (
          <p className="text-xs text-muted-foreground">
            Uploaded
          </p>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        {file.status === 'uploading' && (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRemove}
                className="h-8 w-8"
                title="Cancel upload"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
        {file.status === 'error' && (
          <div className="flex items-center gap-1 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs">{file.error}</span>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRemove}
                className="h-8 w-8 ml-1"
                title="Remove file"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        {(file.status === 'success' || file.status === 'pending') && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8"
            title={file.status === 'pending' ? 'Remove file' : 'Remove file'}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

// Export utility function for use in forms
export function getUploadedFileUrls(files: UploadedFile[]): string[] {
  return files
    .filter((f) => f.status === 'success' && f.url)
    .map((f) => f.url!)
}

