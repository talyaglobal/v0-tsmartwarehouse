"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"

export function JobRunner({ jobId }: { jobId: string }) {
  const [isPending, startTransition] = useTransition()

  const handleRun = () => {
    startTransition(async () => {
      await fetch(`/api/crm-search/jobs/${jobId}/execute`, { method: "POST" })
    })
  }

  return (
    <Button onClick={handleRun} disabled={isPending}>
      {isPending ? "Running..." : "Run Job"}
    </Button>
  )
}
