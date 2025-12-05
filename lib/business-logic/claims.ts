import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getClaimById, createClaim, updateClaim, getClaims } from "@/lib/db/claims"
import { getIncidentById, updateIncident } from "@/lib/db/incidents"
import { getBookingById } from "@/lib/db/bookings"
import type { Claim, ClaimStatus, Incident } from "@/types"

/**
 * Business Logic: Claim Processing Workflow
 * 
 * Handles:
 * - Claim submission with validation
 * - Claim review workflow
 * - Claim approval/rejection
 * - Claim payment processing
 * - Automatic claim creation from incidents
 */

export interface SubmitClaimInput {
  customerId: string
  customerName: string
  bookingId: string
  type: string
  description: string
  amount: number
  incidentId?: string
  evidence?: string[]
}

export interface ReviewClaimInput {
  claimId: string
  reviewerId: string
  reviewerName: string
  action: "approve" | "reject"
  approvedAmount?: number
  resolution: string
}

export interface ClaimProcessingResult {
  claim: Claim
  message: string
  nextStatus?: ClaimStatus
}

/**
 * Submit a new claim
 */
export async function submitClaim(
  input: SubmitClaimInput
): Promise<ClaimProcessingResult> {
  // Validate booking exists
  const booking = await getBookingById(input.bookingId)
  if (!booking) {
    throw new Error("Booking not found")
  }

  // Validate customer owns the booking
  if (booking.customerId !== input.customerId) {
    throw new Error("You can only submit claims for your own bookings")
  }

  // If incident ID provided, validate it exists and is linked to the booking
  if (input.incidentId) {
    const incident = await getIncidentById(input.incidentId)
    if (!incident) {
      throw new Error("Incident not found")
    }
    if (incident.affectedBookingId !== input.bookingId) {
      throw new Error("Incident is not associated with this booking")
    }
  }

  // Validate amount is positive
  if (input.amount <= 0) {
    throw new Error("Claim amount must be greater than zero")
  }

  // Create claim
  const claim = await createClaim({
    customerId: input.customerId,
    customerName: input.customerName,
    bookingId: input.bookingId,
    incidentId: input.incidentId,
    type: input.type,
    description: input.description,
    amount: input.amount,
    status: "submitted",
    evidence: input.evidence,
  })

  return {
    claim,
    message: "Claim submitted successfully and is awaiting review",
    nextStatus: "under-review",
  }
}

/**
 * Review a claim (approve or reject)
 * This is typically done by an admin
 */
export async function reviewClaim(
  input: ReviewClaimInput
): Promise<ClaimProcessingResult> {
  const claim = await getClaimById(input.claimId)
  if (!claim) {
    throw new Error("Claim not found")
  }

  // Validate claim is in reviewable status
  if (claim.status !== "submitted" && claim.status !== "under-review") {
    throw new Error(`Claim cannot be reviewed in status: ${claim.status}`)
  }

  let updatedClaim: Claim
  let message: string
  let nextStatus: ClaimStatus

  if (input.action === "approve") {
    // Validate approved amount
    const approvedAmount = input.approvedAmount ?? claim.amount
    if (approvedAmount <= 0) {
      throw new Error("Approved amount must be greater than zero")
    }
    if (approvedAmount > claim.amount) {
      throw new Error("Approved amount cannot exceed claimed amount")
    }

    updatedClaim = await updateClaim(input.claimId, {
      status: "approved",
      approvedAmount: approvedAmount,
      resolution: input.resolution,
      resolvedAt: new Date().toISOString(),
    })

    message = `Claim approved for $${approvedAmount.toFixed(2)}. Payment will be processed.`
    nextStatus = "paid" // Next step would be payment processing
  } else {
    // Reject claim
    updatedClaim = await updateClaim(input.claimId, {
      status: "rejected",
      resolution: input.resolution,
      resolvedAt: new Date().toISOString(),
    })

    message = "Claim has been rejected"
    nextStatus = "rejected"
  }

  // If claim is linked to an incident, update incident status
  if (claim.incidentId) {
    const incident = await getIncidentById(claim.incidentId)
    if (incident && incident.status !== "resolved") {
      await updateIncident(claim.incidentId, {
        status: input.action === "approve" ? "resolved" : "investigating",
        resolution: input.resolution,
        resolvedAt: input.action === "approve" ? new Date().toISOString() : undefined,
      })
    }
  }

  return {
    claim: updatedClaim,
    message,
    nextStatus,
  }
}

/**
 * Move claim to under-review status
 * This is typically done automatically when an admin starts reviewing
 */
export async function startClaimReview(
  claimId: string,
  reviewerId: string
): Promise<ClaimProcessingResult> {
  const claim = await getClaimById(claimId)
  if (!claim) {
    throw new Error("Claim not found")
  }

  if (claim.status !== "submitted") {
    throw new Error(`Claim cannot be moved to review from status: ${claim.status}`)
  }

  const updatedClaim = await updateClaim(claimId, {
    status: "under-review",
  })

  return {
    claim: updatedClaim,
    message: "Claim is now under review",
    nextStatus: "under-review",
  }
}

/**
 * Process payment for an approved claim
 * This would typically integrate with a payment gateway
 */
export async function processClaimPayment(
  claimId: string,
  paymentMethod?: string
): Promise<ClaimProcessingResult> {
  const claim = await getClaimById(claimId)
  if (!claim) {
    throw new Error("Claim not found")
  }

  if (claim.status !== "approved") {
    throw new Error(`Claim must be approved before payment can be processed. Current status: ${claim.status}`)
  }

  if (!claim.approvedAmount) {
    throw new Error("Approved amount is missing")
  }

  // In production, this would:
  // 1. Process payment through payment gateway
  // 2. Update customer credit balance or issue refund
  // 3. Record payment transaction
  // 4. Send payment confirmation

  const updatedClaim = await updateClaim(claimId, {
    status: "paid",
    resolvedAt: new Date().toISOString(),
  })

  return {
    claim: updatedClaim,
    message: `Payment of $${claim.approvedAmount.toFixed(2)} processed successfully`,
    nextStatus: "paid",
  }
}

/**
 * Automatically create a claim from an incident
 * This is useful when an incident directly results in customer damage
 */
export async function createClaimFromIncident(
  incidentId: string,
  customerId: string,
  customerName: string,
  amount: number,
  description?: string
): Promise<ClaimProcessingResult> {
  const incident = await getIncidentById(incidentId)
  if (!incident) {
    throw new Error("Incident not found")
  }

  if (!incident.affectedBookingId) {
    throw new Error("Incident must be associated with a booking to create a claim")
  }

  // Get booking to validate customer
  const booking = await getBookingById(incident.affectedBookingId)
  if (!booking) {
    throw new Error("Booking associated with incident not found")
  }

  if (booking.customerId !== customerId) {
    throw new Error("Customer does not match the booking associated with this incident")
  }

  // Check if claim already exists for this incident
  const existingClaims = await getClaims({
    incidentId: incidentId,
  })

  if (existingClaims.length > 0) {
    throw new Error("A claim already exists for this incident")
  }

  // Create claim
  const claim = await createClaim({
    customerId,
    customerName,
    bookingId: incident.affectedBookingId,
    incidentId: incidentId,
    type: incident.type,
    description: description || `Claim related to incident: ${incident.title}`,
    amount,
    status: "submitted",
  })

  return {
    claim,
    message: "Claim created from incident and submitted for review",
    nextStatus: "under-review",
  }
}

/**
 * Get claims statistics for a customer
 */
export async function getCustomerClaimStats(customerId: string): Promise<{
  total: number
  submitted: number
  underReview: number
  approved: number
  rejected: number
  paid: number
  totalAmount: number
  totalApprovedAmount: number
  totalPaidAmount: number
}> {
  const claims = await getClaims({ customerId })

  const stats = {
    total: claims.length,
    submitted: 0,
    underReview: 0,
    approved: 0,
    rejected: 0,
    paid: 0,
    totalAmount: 0,
    totalApprovedAmount: 0,
    totalPaidAmount: 0,
  }

  for (const claim of claims) {
    stats.totalAmount += claim.amount

    switch (claim.status) {
      case "submitted":
        stats.submitted++
        break
      case "under-review":
        stats.underReview++
        break
      case "approved":
        stats.approved++
        if (claim.approvedAmount) {
          stats.totalApprovedAmount += claim.approvedAmount
        }
        break
      case "rejected":
        stats.rejected++
        break
      case "paid":
        stats.paid++
        if (claim.approvedAmount) {
          stats.totalPaidAmount += claim.approvedAmount
        }
        break
    }
  }

  return stats
}

/**
 * Get pending claims that need review
 */
export async function getPendingReviewClaims(): Promise<Claim[]> {
  const claims = await getClaims()
  return claims.filter(
    (claim) => claim.status === "submitted" || claim.status === "under-review"
  )
}

/**
 * Auto-escalate claims that have been pending for too long
 * This would typically be run as a scheduled job
 */
export async function escalatePendingClaims(
  daysThreshold: number = 7
): Promise<{ escalated: number; errors: string[] }> {
  const pendingClaims = await getPendingReviewClaims()
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() - daysThreshold)

  const errors: string[] = []
  let escalated = 0

  for (const claim of pendingClaims) {
    const claimDate = new Date(claim.createdAt)
    if (claimDate < thresholdDate) {
      try {
        // In production, this might:
        // 1. Send notification to admin
        // 2. Update claim priority
        // 3. Assign to senior reviewer
        // For now, we'll just log it
        escalated++
      } catch (err) {
        errors.push(
          `Failed to escalate claim ${claim.id}: ${err instanceof Error ? err.message : "Unknown error"}`
        )
      }
    }
  }

  return { escalated, errors }
}
