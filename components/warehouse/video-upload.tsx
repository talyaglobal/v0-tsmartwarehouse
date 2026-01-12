"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, X, Video, Link as LinkIcon, Youtube, Play } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface VideoUploadProps {
  onVideosChange: (videos: string[]) => void
  initialVideos?: string[]
  maxVideos?: number
  bucket?: string
}

// Helper function to detect video type from URL
function getVideoType(url: string): 'youtube' | 'vimeo' | 'file' | 'other' {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube'
  }
  if (url.includes('vimeo.com')) {
    return 'vimeo'
  }
  if (url.includes('storage.googleapis.com') || url.includes('supabase')) {
    return 'file'
  }
  return 'other'
}

// Helper function to extract YouTube video ID
function getYouTubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

// Helper function to get video thumbnail
function getVideoThumbnail(url: string): string | null {
  const videoType = getVideoType(url)
  if (videoType === 'youtube') {
    const videoId = getYouTubeVideoId(url)
    if (videoId) {
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    }
  }
  return null
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
  const [urlInput, setUrlInput] = useState("")
  const [urlError, setUrlError] = useState("")
  const [activeTab, setActiveTab] = useState<"url" | "file">("url")

  const supabase = createClient()

  // Validate URL
  const isValidVideoUrl = (url: string): boolean => {
    try {
      new URL(url)
      // Check if it's a supported video platform or direct video file
      const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')
      const isVimeo = url.includes('vimeo.com')
      const isDirectVideo = /\.(mp4|mov|avi|webm)$/i.test(url)
      return isYouTube || isVimeo || isDirectVideo || url.startsWith('http')
    } catch {
      return false
    }
  }

  // Handle URL submission
  const handleAddUrl = useCallback(() => {
    if (!urlInput.trim()) {
      setUrlError("Please enter a URL")
      return
    }

    if (!isValidVideoUrl(urlInput)) {
      setUrlError("Please enter a valid video URL")
      return
    }

    if (videos.length >= maxVideos) {
      setUrlError(`Maximum ${maxVideos} videos allowed`)
      return
    }

    if (videos.includes(urlInput)) {
      setUrlError("This video URL is already added")
      return
    }

    const newVideos = [...videos, urlInput]
    setVideos(newVideos)
    onVideosChange(newVideos)
    setUrlInput("")
    setUrlError("")
  }, [urlInput, videos, maxVideos, onVideosChange])

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
    [videos, maxVideos, bucket, onVideosChange]
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

      // Only delete from storage if it's a file upload (not a URL)
      const videoType = getVideoType(videoUrl)
      if (videoType === 'file') {
        try {
          const fileName = videoUrl.split("/").pop()?.split("?")[0]
          if (fileName) {
            await supabase.storage.from(bucket).remove([`warehouse/videos/${fileName}`])
          }
        } catch (error) {
          console.error("Error deleting video from storage:", error)
        }
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddUrl()
    }
  }

  return (
    <div className="space-y-4">
      {/* Tabs for URL vs File Upload */}
      {videos.length < maxVideos && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "url" | "file")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              URL / Link
            </TabsTrigger>
            <TabsTrigger value="file" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload File
            </TabsTrigger>
          </TabsList>

          {/* URL Input Tab */}
          <TabsContent value="url" className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="video-url">Video URL</Label>
              <div className="flex gap-2">
                <Input
                  id="video-url"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value)
                    setUrlError("")
                  }}
                  onKeyDown={handleKeyDown}
                  className={cn(urlError && "border-red-500")}
                />
                <Button type="button" onClick={handleAddUrl}>
                  Add
                </Button>
              </div>
              {urlError && (
                <p className="text-sm text-red-500">{urlError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Supported: YouTube, Vimeo, or direct video URL (.mp4, .mov, .webm)
              </p>
            </div>
          </TabsContent>

          {/* File Upload Tab */}
          <TabsContent value="file">
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
          </TabsContent>
        </Tabs>
      )}

      {/* Video List */}
      {videos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {videos.map((video, index) => {
            const videoType = getVideoType(video)
            const thumbnail = getVideoThumbnail(video)
            const isYouTube = videoType === 'youtube'
            const isVimeo = videoType === 'vimeo'
            
            return (
              <Card
                key={`${video}-${index}`}
                className="relative group overflow-hidden"
              >
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    {/* Thumbnail/Preview */}
                    <div className="w-24 h-20 flex-shrink-0 bg-muted flex items-center justify-center relative">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={`Video ${index + 1} thumbnail`}
                          className="w-full h-full object-cover"
                        />
                      ) : isYouTube ? (
                        <Youtube className="h-8 w-8 text-red-500" />
                      ) : isVimeo ? (
                        <Play className="h-8 w-8 text-blue-500" />
                      ) : (
                        <Video className="h-8 w-8 text-muted-foreground" />
                      )}
                      {thumbnail && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="h-6 w-6 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Video Info */}
                    <div className="flex-1 p-3 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium flex items-center gap-1">
                            {isYouTube && <Youtube className="h-3 w-3 text-red-500" />}
                            {isVimeo && <Play className="h-3 w-3 text-blue-500" />}
                            Video {index + 1}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {isYouTube ? 'YouTube' : isVimeo ? 'Vimeo' : videoType === 'file' ? 'Uploaded file' : 'External URL'}
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
                          className="flex-shrink-0 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveVideo(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {uploading && (
        <div className="text-center text-sm text-muted-foreground">
          Uploading videos...
        </div>
      )}

      {videos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Videos will be displayed on the warehouse detail page. YouTube/Vimeo links will be embedded.
        </p>
      )}

      {videos.length >= maxVideos && (
        <p className="text-xs text-amber-600">
          Maximum number of videos ({maxVideos}) reached.
        </p>
      )}
    </div>
  )
}
