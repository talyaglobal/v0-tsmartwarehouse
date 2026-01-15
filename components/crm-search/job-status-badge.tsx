"use client"

import { Badge } from "@/components/ui/badge"

export function JobStatusBadge({ status }: { status: string }) {
  const tone =
    status === "done"
      ? "default"
      : status === "failed"
      ? "destructive"
      : status === "running"
      ? "secondary"
      : "outline"

  return <Badge variant={tone}>{status}</Badge>
}
