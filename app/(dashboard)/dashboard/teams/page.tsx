"use client"

import { PageHeader } from "@/components/ui/page-header"
import { TeamList } from "@/features/teams/components/team-list"
import { useUser } from "@/lib/hooks/use-user"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "@/components/icons"

export default function TeamsPage() {
  const { user, isLoading: userLoading } = useUser()

  // Get user's company ID
  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const supabase = createClient()
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, client_type")
        .eq("id", user.id)
        .maybeSingle()
      return profile
    },
    enabled: !!user?.id,
  })

  if (userLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams"
        description="Manage your teams and team members for collaborative booking management"
        backButton={true}
      />

      <TeamList companyId={userProfile?.company_id || undefined} />
    </div>
  )
}
