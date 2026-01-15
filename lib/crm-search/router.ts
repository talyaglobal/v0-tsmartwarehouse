import type { Segment } from "./classifier"

export function determineOpportunityType(segment: Segment): "space_available" | "space_needed" | "services_partner" | "hiring_signal" {
  if (segment === "warehouse_space_owner") return "space_available"
  if (segment === "warehouse_space_seeker") return "space_needed"
  if (segment === "warehouse_staffing_jobs" || segment === "warehouse_job_seekers") {
    return "hiring_signal"
  }
  return "services_partner"
}
