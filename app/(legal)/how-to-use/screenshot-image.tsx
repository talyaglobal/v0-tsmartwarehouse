"use client"

import Image from "next/image"
import { useState } from "react"

const PLACEHOLDER_IMAGE = "/placeholder.jpg"

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
  const [usePlaceholder, setUsePlaceholder] = useState(false)

  const handleError = () => {
    setError(true)
    setUsePlaceholder(true)
  }

  const displaySrc = usePlaceholder ? PLACEHOLDER_IMAGE : src

  return (
    <figure className="space-y-3 not-prose">
      <div className="rounded-xl border bg-muted/30 overflow-hidden shadow-md min-h-[200px]">
        <Image
          src={displaySrc}
          alt={alt}
          width={1200}
          height={700}
          className="w-full h-auto object-contain"
          unoptimized
          onError={handleError}
        />
        {error && (
          <div className="mt-2 py-2 px-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-center text-sm text-muted-foreground">
            <p>Ekran görüntüsü henüz eklenmedi. Görseli göstermek için <code className="text-xs bg-muted px-1 rounded">public/how-to-use/</code> klasörüne ilgili PNG dosyasını ekleyin.</p>
          </div>
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
