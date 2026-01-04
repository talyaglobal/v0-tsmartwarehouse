"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PhotoGalleryProps {
  photos: string[]
  alt?: string
  className?: string
  showThumbnails?: boolean
  gridCols?: number
}

export function PhotoGallery({
  photos,
  alt = "Warehouse photo",
  className,
  showThumbnails = true,
  gridCols = 4,
}: PhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  if (!photos || photos.length === 0) {
    return (
      <div className={cn("relative aspect-video bg-muted rounded-lg", className)}>
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          No photos available
        </div>
      </div>
    )
  }

  const mainPhoto = photos[selectedIndex] || photos[0]

  const nextPhoto = () => {
    setSelectedIndex((prev) => (prev + 1) % photos.length)
  }

  const prevPhoto = () => {
    setSelectedIndex((prev) => (prev - 1 + photos.length) % photos.length)
  }

  const openLightbox = (index: number) => {
    setSelectedIndex(index)
    setLightboxOpen(true)
  }

  const closeLightbox = () => {
    setLightboxOpen(false)
  }

  return (
    <>
      <div className={cn("space-y-2", className)}>
        {/* Main photo */}
        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted group">
          <Image
            src={mainPhoto}
            alt={`${alt} ${selectedIndex + 1}`}
            fill
            className="object-cover cursor-pointer"
            onClick={() => openLightbox(selectedIndex)}
          />

          {/* Navigation arrows */}
          {photos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
                onClick={(e) => {
                  e.stopPropagation()
                  prevPhoto()
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
                onClick={(e) => {
                  e.stopPropagation()
                  nextPhoto()
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Photo counter */}
          {photos.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs">
              {selectedIndex + 1} / {photos.length}
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {showThumbnails && photos.length > 1 && (
          <div
            className={cn(
              "grid gap-2",
              gridCols === 2 && "grid-cols-2",
              gridCols === 3 && "grid-cols-3",
              gridCols === 4 && "grid-cols-4",
              gridCols === 5 && "grid-cols-5"
            )}
          >
            {photos.slice(0, gridCols * 2).map((photo, index) => (
              <div
                key={index}
                className={cn(
                  "relative aspect-video rounded-md overflow-hidden bg-muted cursor-pointer border-2 transition-all",
                  selectedIndex === index
                    ? "border-primary"
                    : "border-transparent hover:border-primary/50"
                )}
                onClick={() => setSelectedIndex(index)}
              >
                <Image
                  src={photo}
                  alt={`${alt} thumbnail ${index + 1}`}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={closeLightbox}
          >
            <X className="h-6 w-6" />
          </Button>

          {photos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  prevPhoto()
                }}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  nextPhoto()
                }}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}

          <div className="relative w-full h-full max-w-7xl max-h-[90vh] flex items-center justify-center">
            <Image
              src={mainPhoto}
              alt={`${alt} ${selectedIndex + 1}`}
              width={1920}
              height={1080}
              className="object-contain max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Photo counter in lightbox */}
          {photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur px-4 py-2 rounded text-white text-sm">
              {selectedIndex + 1} / {photos.length}
            </div>
          )}
        </div>
      )}
    </>
  )
}

