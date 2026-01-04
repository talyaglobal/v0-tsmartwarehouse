"use client"

import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface RatingStarsProps {
  rating: number
  reviewCount?: number
  size?: "sm" | "md" | "lg"
  showNumber?: boolean
  showCount?: boolean
  clickable?: boolean
  onRatingClick?: (rating: number) => void
  className?: string
}

export function RatingStars({
  rating,
  reviewCount,
  size = "md",
  showNumber = true,
  showCount = true,
  clickable = false,
  onRatingClick,
  className,
}: RatingStarsProps) {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  const handleClick = (starValue: number) => {
    if (clickable && onRatingClick) {
      onRatingClick(starValue)
    }
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex items-center gap-0.5">
        {/* Full stars */}
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star
            key={`full-${i}`}
            className={cn(
              "fill-yellow-400 text-yellow-400",
              sizeClasses[size],
              clickable && "cursor-pointer hover:scale-110 transition-transform"
            )}
            onClick={() => handleClick(i + 1)}
          />
        ))}

        {/* Half star */}
        {hasHalfStar && (
          <div className="relative">
            <Star
              className={cn(
                "text-gray-300",
                sizeClasses[size],
                clickable && "cursor-pointer hover:scale-110 transition-transform"
              )}
              onClick={() => handleClick(fullStars + 1)}
            />
            <Star
              className={cn(
                "absolute top-0 left-0 fill-yellow-400 text-yellow-400 overflow-hidden",
                sizeClasses[size]
              )}
              style={{ clipPath: "inset(0 50% 0 0)" }}
            />
          </div>
        )}

        {/* Empty stars */}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star
            key={`empty-${i}`}
            className={cn(
              "text-gray-300",
              sizeClasses[size],
              clickable && "cursor-pointer hover:scale-110 transition-transform"
            )}
            onClick={() => handleClick(fullStars + (hasHalfStar ? 1 : 0) + i + 1)}
          />
        ))}
      </div>

      {showNumber && (
        <span className={cn("font-medium", size === "sm" ? "text-xs" : "text-sm")}>
          {rating.toFixed(1)}
        </span>
      )}

      {showCount && reviewCount !== undefined && reviewCount > 0 && (
        <span className={cn("text-muted-foreground", size === "sm" ? "text-xs" : "text-sm")}>
          ({reviewCount})
        </span>
      )}
    </div>
  )
}

