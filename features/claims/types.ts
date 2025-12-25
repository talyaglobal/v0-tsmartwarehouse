import type { Claim, ClaimStatus } from '@/types'

export type { Claim, ClaimStatus }

export interface ClaimFilters {
  customerId?: string
  companyId?: string
  status?: ClaimStatus
  bookingId?: string
  incidentId?: string
}

export interface CreateClaimInput {
  bookingId: string
  incidentId?: string
  type: string
  description: string
  amount: number
  evidence?: string[]
}

export interface UpdateClaimInput {
  status?: ClaimStatus
  resolution?: string
  approvedAmount?: number
  resolvedAt?: string
  evidence?: string[]
}

export interface ApproveClaimInput {
  claimId: string
  approvedAmount: number
  resolution?: string
}

export interface RejectClaimInput {
  claimId: string
  resolution: string
}

