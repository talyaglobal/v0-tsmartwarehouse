"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, X, GripVertical } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface PhotoUploadProps {
  onPhotosChange: (photos: string[]) => void
  initialPhotos?: string[]
  maxPhotos?: number
  bucket?: string
}

export function PhotoUpload({
  onPhotosChange,
  initialPhotos = [],
  maxPhotos = 10,
  bucket = "docs",
}: PhotoUploadProps) {
  const [photos, setPhotos] = useState<string[]>(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const supabase = createClient()
  const normalizeImageSrc = (src: string) => {
    if (
      src.startsWith("/") ||
      src.startsWith("http://") ||
      src.startsWith("https://") ||
      src.startsWith("blob:") ||
      src.startsWith("data:")
    ) {
      return src
    }
    return `/${src}`
  }

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return

      const filesArray = Array.from(files)
      const remainingSlots = maxPhotos - photos.length

      if (filesArray.length > remainingSlots) {
        alert(`You can only upload ${remainingSlots} more photo(s)`)
        return
      }

      setUploading(true)

      try {
        const uploadPromises = filesArray.map(async (file) => {
          // Validate file type
          if (!file.type.startsWith("image/")) {
            throw new Error(`${file.name} is not an image file`)
          }

          // Validate file size (max 5MB)
          if (file.size > 5 * 1024 * 1024) {
            throw new Error(`${file.name} is too large. Maximum size is 5MB`)
          }

          // Upload via API route to bypass RLS issues
          const formData = new FormData()
          formData.append('file', file)
          formData.append('bucket', bucket)
          formData.append('folder', 'warehouse')

          const response = await fetch('/api/v1/files/upload', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to upload file')
          }

          const result = await response.json()
          if (!result.success || !result.data?.url) {
            throw new Error('Upload failed: Invalid response')
          }

          return result.data.url
        })

        const uploadedUrls = await Promise.all(uploadPromises)
        const newPhotos = [...photos, ...uploadedUrls]
        setPhotos(newPhotos)
        onPhotosChange(newPhotos)
      } catch (error) {
        console.error("Error uploading photos:", error)
        alert(error instanceof Error ? error.message : "Failed to upload photos")
      } finally {
        setUploading(false)
      }
    },
    [photos, maxPhotos, bucket, supabase, onPhotosChange]
  )

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files)
      }
    },
    [handleFileSelect]
  )

  const handleRemovePhoto = useCallback(
    async (index: number) => {
      const photoUrl = photos[index]
      const newPhotos = photos.filter((_, i) => i !== index)
      setPhotos(newPhotos)
      onPhotosChange(newPhotos)

      // Optionally delete from storage
      try {
        const fileName = photoUrl.split("/").pop()?.split("?")[0]
        if (fileName) {
          await supabase.storage.from(bucket).remove([fileName])
        }
      } catch (error) {
        console.error("Error deleting photo from storage:", error)
        // Don't show error to user - photo is already removed from UI
      }
    },
    [photos, bucket, supabase, onPhotosChange]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileSelect(e.target.files)
    },
    [handleFileSelect]
  )

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null) return

    if (draggedIndex !== index) {
      const newPhotos = [...photos]
      const draggedPhoto = newPhotos[draggedIndex]
      newPhotos.splice(draggedIndex, 1)
      newPhotos.splice(index, 0, draggedPhoto)
      setPhotos(newPhotos)
      onPhotosChange(newPhotos)
      setDraggedIndex(index)
    }
  }, [draggedIndex, photos, onPhotosChange])

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null)
  }, [])

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {photos.length < maxPhotos && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            dragActive && "border-primary bg-primary/5",
            !dragActive && "border-muted-foreground/25",
            uploading && "opacity-50 pointer-events-none",
            !uploading && "cursor-pointer hover:border-primary"
          )}
        >
          <input
            type="file"
            id="photo-upload"
            multiple
            accept="image/*"
            onChange={handleInputChange}
            disabled={uploading}
            className="hidden"
          />
          <label
            htmlFor="photo-upload"
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <span className="text-sm font-medium">Click to upload</span> or drag and drop
            </div>
            <div className="text-xs text-muted-foreground">
              PNG, JPG, GIF up to 5MB ({photos.length}/{maxPhotos} photos)
            </div>
          </label>
        </div>
      )}

      {/* Photo Grid with Reorder */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo, index) => (
            <Card
              key={`${photo}-${index}`}
              className={cn(
                "relative group cursor-move",
                draggedIndex === index && "opacity-50"
              )}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <CardContent className="p-0">
                <div className="relative aspect-square">
                  {index === 0 && (
                    <div className="absolute top-2 left-2 z-10 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                      Primary
                    </div>
                  )}
                  <Image
                    src={normalizeImageSrc(photo)}
                    alt={`Photo ${index + 1}`}
                    fill
                    className="object-cover rounded-lg"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                    <GripVertical className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemovePhoto(index)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {uploading && (
        <div className="text-center text-sm text-muted-foreground">
          Uploading photos...
        </div>
      )}

      {photos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Drag photos to reorder. The first photo will be used as the primary image.
        </p>
      )}
    </div>
  )
}

