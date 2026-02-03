"use client"

import Image from "next/image"
import { useState } from "react"

export function ScreenshotImage({
  src,
  alt,
  caption,
}: {
  src: string
  alt: string
  caption: React.ReactNode
}) {
  const [error, setError] = useState(false)

  return (
    <figure className="space-y-3 not-prose">
      <div className="rounded-xl border bg-muted/30 overflow-hidden shadow-md min-h-[200px]">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-muted/50 text-muted-foreground text-sm">
            <p>Screenshot: {alt}</p>
            <p className="mt-1">Add image to <code className="text-xs bg-muted px-1 rounded">public/how-to-use/</code> to display.</p>
          </div>
        ) : (
          <Image
            src={src}
            alt={alt}
            width={1200}
            height={700}
            className="w-full h-auto object-contain"
            unoptimized
            onError={() => setError(true)}
          />
        )}
      </div>
      {caption && (
        <figcaption className="text-sm text-muted-foreground border-l-2 border-amber-500 pl-4">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
