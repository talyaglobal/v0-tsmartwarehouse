"use client"

import { useEffect, useState, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Progress } from "@/components/ui/progress"

export function TopLoadingBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Reset loading state when pathname or searchParams change
    setLoading(true)
    setProgress(0)

    // Clear any existing intervals/timeouts
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Simulate progress
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          return 90
        }
        // Accelerate progress
        const increment = prev < 30 ? 15 : prev < 60 ? 8 : 3
        return prev + increment
      })
    }, 80)

    // Complete progress after a short delay
    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      setProgress(100)
      setTimeout(() => {
        setLoading(false)
        setProgress(0)
      }, 150)
    }, 400)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [pathname, searchParams])

  if (!loading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1">
      <Progress value={progress} className="h-1" />
    </div>
  )
}

