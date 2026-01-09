"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, X, Video } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface VideoUploadProps {
  onVideosChange: (videos: string[]) => void
  initialVideos?: string[]
  maxVideos?: number
  bucket?: string
}

export function VideoUpload({
  onVideosChange,
  initialVideos = [],
  maxVideos = 5,
  bucket = "docs",
}: VideoUploadProps) {
  const [videos, setVideos] = useState<string[]>(initialVideos)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const supabase = createClient()

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return

      const filesArray = Array.from(files)
      const remainingSlots = maxVideos - videos.length

      if (filesArray.length > remainingSlots) {
        alert(`You can only upload ${remainingSlots} more video(s)`)
        return
      }

      setUploading(true)

      try {
        const uploadPromises = filesArray.map(async (file) => {
          // Validate file type
          if (!file.type.startsWith("video/")) {
            throw new Error(`${file.name} is not a video file`)
          }

          // Validate file size (max 50MB for videos)
          if (file.size > 50 * 1024 * 1024) {
            throw new Error(`${file.name} is too large. Maximum size is 50MB`)
          }

          // Upload via API route to bypass RLS issues
          const formData = new FormData()
          formData.append('file', file)
          formData.append('bucket', bucket)
          formData.append('folder', 'warehouse/videos')

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
        const newVideos = [...videos, ...uploadedUrls]
        setVideos(newVideos)
        onVideosChange(newVideos)
      } catch (error) {
        console.error("Error uploading videos:", error)
        alert(error instanceof Error ? error.message : "Failed to upload videos")
      } finally {
        setUploading(false)
      }
    },
    [videos, maxVideos, bucket, supabase, onVideosChange]
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

  const handleRemoveVideo = useCallback(
    async (index: number) => {
      const videoUrl = videos[index]
      const newVideos = videos.filter((_, i) => i !== index)
      setVideos(newVideos)
      onVideosChange(newVideos)

      // Optionally delete from storage
      try {
        const fileName = videoUrl.split("/").pop()?.split("?")[0]
        if (fileName) {
          await supabase.storage.from(bucket).remove([`warehouse/videos/${fileName}`])
        }
      } catch (error) {
        console.error("Error deleting video from storage:", error)
        // Don't show error to user - video is already removed from UI
      }
    },
    [videos, bucket, supabase, onVideosChange]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileSelect(e.target.files)
    },
    [handleFileSelect]
  )

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {videos.length < maxVideos && (
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
            id="video-upload"
            multiple
            accept="video/*"
            onChange={handleInputChange}
            disabled={uploading}
            className="hidden"
          />
          <label
            htmlFor="video-upload"
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <span className="text-sm font-medium">Click to upload</span> or drag and drop
            </div>
            <div className="text-xs text-muted-foreground">
              MP4, MOV, AVI up to 50MB ({videos.length}/{maxVideos} videos)
            </div>
          </label>
        </div>
      )}

      {/* Video List */}
      {videos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {videos.map((video, index) => (
            <Card
              key={`${video}-${index}`}
              className="relative group"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <Video className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      Video {index + 1}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {video.split("/").pop()?.split("?")[0] || "Video file"}
                    </p>
                    <a
                      href={video}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline mt-1 inline-block"
                    >
                      View video
                    </a>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveVideo(index)}
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
          Uploading videos...
        </div>
      )}

      {videos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Videos are optional and will be displayed on the warehouse detail page.
        </p>
      )}
    </div>
  )
}

