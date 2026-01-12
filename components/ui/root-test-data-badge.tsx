"use client"

import { Badge } from "@/components/ui/badge"
import { FlaskConical } from "@/components/icons"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface RootTestDataBadgeProps {
  className?: string
  showTooltip?: boolean
  size?: "sm" | "default"
}

/**
 * Badge component to indicate data was created by root user for testing purposes.
 * This is a development feature to help distinguish test data from real user data.
 * 
 * @see documents/DEVELOPMENT_RULES.md - Root User Test Modu section
 */
export function RootTestDataBadge({ 
  className = "", 
  showTooltip = true,
  size = "default" 
}: RootTestDataBadgeProps) {
  const badge = (
    <Badge 
      variant="outline" 
      className={`
        bg-amber-50 text-amber-700 border-amber-300 
        dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700
        ${size === "sm" ? "text-xs px-1.5 py-0" : ""}
        ${className}
      `}
    >
      <FlaskConical className={`${size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} mr-1`} />
      Test Data
    </Badge>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">
            <strong>🧪 Test Data</strong>
            <br />
            This data was created by a Root user for testing and demonstration purposes.
            It may not represent real customer or business data.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Inline version of the test data indicator for use in lists and tables
 */
export function RootTestDataIndicator({ className = "" }: { className?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center text-amber-600 dark:text-amber-400 ${className}`}>
            <FlaskConical className="h-4 w-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-sm">Test data created by Root user</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
