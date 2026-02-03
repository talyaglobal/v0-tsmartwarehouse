"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/ui/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "@/components/icons"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { TeamMembersTab, type TeamMembersTabRef } from "@/features/my-company/components/team-members-tab"
import { WarehousesTab } from "@/features/my-company/components/warehouses-tab"
import { CompanyInformationTab } from "@/features/my-company/components/company-information-tab"
import { AccessLogsTab } from "@/features/my-company/components/access-logs-tab"
import { ClientTeamMembersTab } from "@/features/my-company/components/client-team-members-tab"

type UserType = 'warehouse' | 'corporate_client' | null

export default function MyCompanyPage() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState("team")
  const teamMembersTabRef = useRef<TeamMembersTabRef>(null)

  // Handle tab query parameter
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && ["team", "warehouses", "information", "access-logs"].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Handle openAddMemberDialog query parameter
  useEffect(() => {
    const openAddMember = searchParams.get("openAddMember")
    const role = searchParams.get("role")
    if (openAddMember === "true" && activeTab === "team") {
      // Small delay to ensure TeamMembersTab is mounted
      setTimeout(() => {
        teamMembersTabRef.current?.openAddMemberDialog?.(role || undefined)
        // Clean up URL
        const newSearchParams = new URLSearchParams(searchParams.toString())
        newSearchParams.delete("openAddMember")
        newSearchParams.delete("role")
        router.replace(`${pathname}?${newSearchParams.toString()}`, { scroll: false })
      }, 100)
    }
  }, [searchParams, activeTab, pathname, router])

  // Update URL when tab changes to trigger loading bar
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    router.push(`${pathname}?tab=${value}`, { scroll: false })
  }

  // Check if user is company admin and determine user type
  const { data: adminData, isLoading: checkingRole } = useQuery({
    queryKey: ['company-admin-check', user?.id],
    queryFn: async () => {
      if (!user) return { isAdmin: false, userType: null as UserType, hasAccess: false }
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, company_id, client_type')
        .eq('id', user.id)
        .maybeSingle()
      
      if (!profile || !profile.company_id) return { isAdmin: false, userType: null as UserType, hasAccess: false }
      
      // Warehouse admin/supervisor can access (as admin)
      if (['warehouse_admin', 'warehouse_supervisor'].includes(profile.role)) {
        return { isAdmin: true, userType: 'warehouse' as UserType, hasAccess: true }
      }
      
      // Corporate clients: team admin can edit, all can view
      if (profile.role === 'warehouse_client' && profile.client_type === 'corporate') {
        const { data: teamMember } = await supabase
          .from('client_team_members')
          .select('role')
          .eq('member_id', user.id)
          .eq('role', 'admin')
          .maybeSingle()
        
        return { 
          isAdmin: !!teamMember, 
          userType: 'corporate_client' as UserType, 
          hasAccess: true 
        }
      }
      
      // Warehouse client with company_id (e.g. individual with company): allow access, show "My Company"
      if (profile.role === 'warehouse_client') {
        return { isAdmin: false, userType: null as UserType, hasAccess: true }
      }
      
      return { isAdmin: false, userType: null as UserType, hasAccess: false }
    },
    enabled: !!user,
  })

  const isCompanyAdmin = adminData?.isAdmin
  const userType = adminData?.userType
  const hasAccess = adminData?.hasAccess

  if (checkingRole) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need to be part of a company to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Different title and description based on user type
  const pageTitle = userType === 'corporate_client' ? "My Organization" : "My Company"
  const pageDescription = userType === 'corporate_client' 
    ? isCompanyAdmin 
      ? "Manage your organization settings and team members"
      : "View your organization and team information"
    : "Manage your company settings, team members, and warehouses"

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        description={pageDescription}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="team">Team Members</TabsTrigger>
          {userType === 'warehouse' && (
            <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
          )}
          <TabsTrigger value="information">Company Information</TabsTrigger>
          {userType === 'warehouse' && (
            <TabsTrigger value="access-logs">Access Logs</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="team" className="space-y-4">
          {userType === 'corporate_client' ? (
            <ClientTeamMembersTab />
          ) : (
            <TeamMembersTab ref={teamMembersTabRef} />
          )}
        </TabsContent>

        {userType === 'warehouse' && (
          <TabsContent value="warehouses" className="space-y-4">
            <WarehousesTab />
          </TabsContent>
        )}

        <TabsContent value="information" className="space-y-4">
          <CompanyInformationTab canEdit={isCompanyAdmin} />
        </TabsContent>

        {userType === 'warehouse' && (
          <TabsContent value="access-logs" className="space-y-4">
            <AccessLogsTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

