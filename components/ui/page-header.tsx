"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export interface PageHeaderProps {
  title: string
  description?: string | React.ReactNode
  children?: React.ReactNode
  className?: string
  backButton?: boolean
  backHref?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, children, className, backButton, backHref, actions }: PageHeaderProps) {
  const router = useRouter()

  const handleBack = () => {
    if (backHref) {
      router.push(backHref)
    } else {
      router.back()
    }
  }

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-center gap-3">
        {backButton && (
          <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            typeof description === 'string' 
              ? <p className="text-muted-foreground">{description}</p>
              : <div className="text-muted-foreground">{description}</div>
          )}
        </div>
      </div>
      {(children || actions) && <div className="flex items-center gap-2">{actions || children}</div>}
    </div>
  )
}
