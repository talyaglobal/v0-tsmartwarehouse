import type { Claim, CreateClaimRequest, UpdateClaimRequest } from "../types"
import type { PaginatedResponse, PaginationParams, ClaimStatus } from "../../common/types"

const claims: Claim[] = [
  {
    id: "clm-001",
    claim_number: "CLM-2024-0001",
    incident_id: "inc-001",
    customer_id: "cust-001",
    claimed_amount: 5000,
    status: "under_review",
    evidence_urls: [],
    submitted_at: "2024-05-21T10:00:00Z",
  },
]

export class ClaimService {
  private static instance: ClaimService

  static getInstance(): ClaimService {
    if (!ClaimService.instance) {
      ClaimService.instance = new ClaimService()
    }
    return ClaimService.instance
  }

  async getClaims(
    filters?: { status?: ClaimStatus[]; customer_id?: string },
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<Claim>> {
    let filtered = [...claims]

    if (filters?.status?.length) {
      filtered = filtered.filter((c) => filters.status!.includes(c.status))
    }
    if (filters?.customer_id) {
      filtered = filtered.filter((c) => c.customer_id === filters.customer_id)
    }

    const page = pagination?.page ?? 1
    const limit = pagination?.limit ?? 10
    const start = (page - 1) * limit
    const end = start + limit

    return {
      data: filtered.slice(start, end),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    }
  }

  async getClaimById(id: string): Promise<Claim | null> {
    return claims.find((c) => c.id === id) ?? null
  }

  async getClaimByNumber(claimNumber: string): Promise<Claim | null> {
    return claims.find((c) => c.claim_number === claimNumber) ?? null
  }

  async getClaimByIncident(incidentId: string): Promise<Claim | null> {
    return claims.find((c) => c.incident_id === incidentId) ?? null
  }

  async createClaim(data: CreateClaimRequest): Promise<Claim> {
    const newClaim: Claim = {
      id: `clm-${Date.now()}`,
      claim_number: `CLM-${new Date().getFullYear()}-${String(claims.length + 1).padStart(4, "0")}`,
      ...data,
      evidence_urls: data.evidence_urls ?? [],
      status: "submitted",
      submitted_at: new Date().toISOString(),
    }
    claims.push(newClaim)
    return newClaim
  }

  async updateClaim(id: string, data: UpdateClaimRequest): Promise<Claim | null> {
    const index = claims.findIndex((c) => c.id === id)
    if (index === -1) return null

    if (data.status === "under_review" && !claims[index].reviewed_at) {
      claims[index].reviewed_at = new Date().toISOString()
    }
    if (data.status === "approved" || data.status === "denied" || data.status === "paid") {
      claims[index].resolved_at = new Date().toISOString()
    }

    claims[index] = { ...claims[index], ...data }
    return claims[index]
  }

  async approveClaim(id: string, approvedAmount: number, notes?: string): Promise<Claim | null> {
    return this.updateClaim(id, {
      status: "approved",
      approved_amount: approvedAmount,
      adjuster_notes: notes,
    })
  }

  async denyClaim(id: string, reason: string): Promise<Claim | null> {
    return this.updateClaim(id, {
      status: "denied",
      adjuster_notes: reason,
    })
  }

  async getPendingClaimsCount(): Promise<number> {
    return claims.filter((c) => c.status === "submitted" || c.status === "under_review").length
  }
}

export const claimService = ClaimService.getInstance()
