"use client"

import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import type { CRMContact } from "@/types"

interface PipelineProgressBarProps {
  contact: CRMContact
  milestones?: Array<{ stagePercentage: number; milestoneName: string }>
}

export function PipelineProgressBar({ contact, milestones }: PipelineProgressBarProps) {
  const currentStage = contact.pipelineStage
  const percentage = currentStage

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{contact.pipelineMilestone}</span>
        <Badge variant="secondary">{percentage}%</Badge>
      </div>
      <Progress value={percentage} className="h-2" />
      {milestones && (
        <div className="flex justify-between text-xs text-muted-foreground">
          {milestones.map((milestone) => (
            <span
              key={milestone.stagePercentage}
              className={milestone.stagePercentage <= currentStage ? "font-medium" : ""}
            >
              {milestone.stagePercentage}%
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

