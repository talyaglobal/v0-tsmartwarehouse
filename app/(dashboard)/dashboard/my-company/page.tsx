"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
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
import { AccessLogsTab } from "@/features/my-company/components/access-logs-tab"

export default function MyCompanyPage() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState("team")

  // Handle tab query parameter
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && ["team", "warehouses", "information", "access-logs"].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Update URL when tab changes to trigger loading bar
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    router.push(`${pathname}?tab=${value}`, { scroll: false })
  }

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

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="team">Team Members</TabsTrigger>
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
          <TabsTrigger value="information">Company Information</TabsTrigger>
          <TabsTrigger value="access-logs">Access Logs</TabsTrigger>
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

        <TabsContent value="access-logs" className="space-y-4">
          <AccessLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

