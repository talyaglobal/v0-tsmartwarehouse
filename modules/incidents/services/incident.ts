import type { Incident, CreateIncidentRequest, UpdateIncidentRequest, IncidentFilters } from "../types"
import type { PaginatedResponse, PaginationParams } from "../../common/types"

const incidents: Incident[] = [
  {
    id: "inc-001",
    incident_number: "INC-2024-0001",
    booking_id: "book-001",
    reported_by: "work-001",
    type: "damage",
    severity: "medium",
    title: "Water damage to stored electronics",
    description:
      "Minor water leak detected in zone A affecting 3 pallets of stored electronics. Immediate containment measures taken.",
    affected_items: ["SKU-001", "SKU-002", "SKU-003"],
    photo_urls: [],
    location: "Zone A, Rack 01, Level 1",
    occurred_at: "2024-05-20T14:30:00Z",
    reported_at: "2024-05-20T14:45:00Z",
    status: "investigating",
  },
  {
    id: "inc-002",
    incident_number: "INC-2024-0002",
    booking_id: "book-002",
    reported_by: "work-002",
    type: "loss",
    severity: "low",
    title: "Missing inventory item",
    description:
      "One box of promotional materials reported missing during cycle count. Security footage being reviewed.",
    affected_items: ["SKU-101"],
    photo_urls: [],
    location: "Zone B, Aisle 3",
    occurred_at: "2024-06-10T09:00:00Z",
    reported_at: "2024-06-10T10:30:00Z",
    status: "open",
  },
]

export class IncidentService {
  private static instance: IncidentService

  static getInstance(): IncidentService {
    if (!IncidentService.instance) {
      IncidentService.instance = new IncidentService()
    }
    return IncidentService.instance
  }

  async getIncidents(filters?: IncidentFilters, pagination?: PaginationParams): Promise<PaginatedResponse<Incident>> {
    let filtered = [...incidents]

    if (filters?.type?.length) {
      filtered = filtered.filter((i) => filters.type!.includes(i.type))
    }
    if (filters?.severity?.length) {
      filtered = filtered.filter((i) => filters.severity!.includes(i.severity))
    }
    if (filters?.status?.length) {
      filtered = filtered.filter((i) => filters.status!.includes(i.status))
    }
    if (filters?.booking_id) {
      filtered = filtered.filter((i) => i.booking_id === filters.booking_id)
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

  async getIncidentById(id: string): Promise<Incident | null> {
    return incidents.find((i) => i.id === id) ?? null
  }

  async getIncidentByNumber(incidentNumber: string): Promise<Incident | null> {
    return incidents.find((i) => i.incident_number === incidentNumber) ?? null
  }

  async createIncident(data: CreateIncidentRequest): Promise<Incident> {
    const newIncident: Incident = {
      id: `inc-${Date.now()}`,
      incident_number: `INC-${new Date().getFullYear()}-${String(incidents.length + 1).padStart(4, "0")}`,
      ...data,
      affected_items: data.affected_items ?? [],
      photo_urls: [],
      reported_at: new Date().toISOString(),
      status: "open",
    }
    incidents.push(newIncident)
    return newIncident
  }

  async updateIncident(id: string, data: UpdateIncidentRequest): Promise<Incident | null> {
    const index = incidents.findIndex((i) => i.id === id)
    if (index === -1) return null

    if (data.status === "resolved" || data.status === "closed") {
      incidents[index].resolved_at = new Date().toISOString()
    }

    incidents[index] = { ...incidents[index], ...data }
    return incidents[index]
  }

  async getOpenIncidentsCount(): Promise<number> {
    return incidents.filter((i) => i.status === "open" || i.status === "investigating").length
  }

  async getIncidentsByBooking(bookingId: string): Promise<Incident[]> {
    return incidents.filter((i) => i.booking_id === bookingId)
  }
}

export const incidentService = IncidentService.getInstance()
