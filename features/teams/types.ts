export type { ClientTeam, TeamMember, TeamRole } from "@/types"

export interface CreateTeamInput {
  name: string
  description?: string
}

export interface AddMemberInput {
  teamId: string
  memberId: string
  role: "admin" | "member"
}
