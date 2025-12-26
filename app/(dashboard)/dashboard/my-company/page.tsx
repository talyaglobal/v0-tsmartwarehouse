"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/ui/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "@/components/icons"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { TeamMembersTab } from "@/features/my-company/components/team-members-tab"
import { WarehousesTab } from "@/features/my-company/components/warehouses-tab"
import { CompanyInformationTab } from "@/features/my-company/components/company-information-tab"

export default function MyCompanyPage() {
  const { user } = useUser()
  const [activeTab, setActiveTab] = useState("team")

  // Check if user is company admin
  const { data: isCompanyAdmin, isLoading: checkingRole } = useQuery({
    queryKey: ['company-admin-check', user?.id],
    queryFn: async () => {
      if (!user) return false
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, company_id')
        .eq('id', user.id)
        .maybeSingle()
      
      if (!profile || !profile.company_id) return false
      return ['owner', 'company_admin'].includes(profile.role)
    },
    enabled: !!user,
  })

  if (checkingRole) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isCompanyAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only Company Administrators can access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Company"
        description="Manage your company settings, team members, and warehouses"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="team">Team Members</TabsTrigger>
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
          <TabsTrigger value="information">Company Information</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-4">
          <TeamMembersTab />
        </TabsContent>

        <TabsContent value="warehouses" className="space-y-4">
          <WarehousesTab />
        </TabsContent>

        <TabsContent value="information" className="space-y-4">
          <CompanyInformationTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

