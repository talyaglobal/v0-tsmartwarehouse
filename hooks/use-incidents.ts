"use client"

import useSWR from "swr"
import { incidentService } from "@/modules/incidents/services/incident"
import { claimService } from "@/modules/incidents/services/claim"
import type { IncidentFilters } from "@/modules/incidents/types"
import type { PaginationParams, ClaimStatus } from "@/modules/common/types"

export function useIncidents(filters?: IncidentFilters, pagination?: PaginationParams) {
  const key = ["incidents", JSON.stringify(filters), JSON.stringify(pagination)]

  const { data, error, isLoading, mutate } = useSWR(key, () => incidentService.getIncidents(filters, pagination))

  return {
    incidents: data?.data ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useIncident(id: string) {
  const { data, error, isLoading, mutate } = useSWR(id ? ["incident", id] : null, () =>
    incidentService.getIncidentById(id),
  )

  return {
    incident: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useOpenIncidentsCount() {
  const { data, error, isLoading } = useSWR("open-incidents-count", () => incidentService.getOpenIncidentsCount())

  return {
    count: data ?? 0,
    isLoading,
    isError: !!error,
  }
}

export function useClaims(filters?: { status?: ClaimStatus[]; customer_id?: string }, pagination?: PaginationParams) {
  const key = ["claims", JSON.stringify(filters), JSON.stringify(pagination)]

  const { data, error, isLoading, mutate } = useSWR(key, () => claimService.getClaims(filters, pagination))

  return {
    claims: data?.data ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useClaim(id: string) {
  const { data, error, isLoading, mutate } = useSWR(id ? ["claim", id] : null, () => claimService.getClaimById(id))

  return {
    claim: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
