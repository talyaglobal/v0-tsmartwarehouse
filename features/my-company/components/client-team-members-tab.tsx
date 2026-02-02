"use client"

import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Edit, Trash2, Loader2, UserPlus, Eye, EyeOff, User, Mail, Users, Plus } from "@/components/icons"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { useUIStore } from "@/stores/ui.store"
import { PhoneInput } from 'react-international-phone'
import 'react-international-phone/style.css'

interface ClientTeam {
  id: string
  name: string
  description: string | null
  is_default: boolean
  member_count: number
  created_at?: string
}

interface ClientTeamMember {
  id: string
  user_id: string
  company_id: string
  role: 'admin' | 'member'
  invited_by: string | null
  joined_at: string
  created_at: string
  updated_at: string
  teams?: { id: string; name: string }[]
  /** Company name when member is from a different company (for badge display) */
  company_name?: string | null
  profile?: {
    id: string
    name: string | null
    email: string
    phone: string | null
    avatar_url: string | null
  }
}

interface ClientTeamInvitation {
  id: string
  company_id: string
  email: string
  role: 'admin' | 'member'
  invited_by: string | null
  token: string
  expires_at: string
  created_at: string
}

interface CorporateCompanyOption {
  id: string
  name: string
  admin: { id: string; email: string; name: string | null }
}

export function ClientTeamMembersTab() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
  const [addExistingDialogOpen, setAddExistingDialogOpen] = useState(false)
  const [createTeamDialogOpen, setCreateTeamDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<ClientTeamMember | null>(null)
  const [showAddPassword, setShowAddPassword] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [createTeamForm, setCreateTeamForm] = useState({ name: "", description: "" })
  const [addExistingForm, setAddExistingForm] = useState({
    corporateCompanyId: "" as string,
    role: "member" as "admin" | "member",
    teamId: "" as string,
  })

  const [inviteForm, setInviteForm] = useState({
    email: "",
    fullName: "",
    role: "member" as "admin" | "member",
  })

  const [addMemberForm, setAddMemberForm] = useState({
    email: "",
    fullName: "",
    role: "member" as "admin" | "member",
    password: "",
    teamId: "" as string,
  })

  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "member" as "admin" | "member",
    avatarUrl: "",
    password: "",
  })

  // Handle phone change for edit form
  const handleEditPhoneChange = useCallback((value: string) => {
    setEditForm((prev) => ({ ...prev, phone: value }))
  }, [])

  // Get user's company ID and admin status
  const { data: companyData, isLoading: isLoadingCompanyData } = useQuery({
    queryKey: ['user-company-data', user?.id],
    queryFn: async () => {
      if (!user) return { companyId: null, isAdmin: false }
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle()
      
      if (!profile?.company_id) return { companyId: null, isAdmin: false }
      
      // Check if user is team admin
      const { data: teamMember } = await supabase
        .from('client_team_members')
        .select('role')
        .eq('member_id', user.id)
        .eq('role', 'admin')
        .maybeSingle()
      
      return { 
        companyId: profile.company_id, 
        isAdmin: !!teamMember 
      }
    },
    enabled: !!user,
  })

  const companyId = companyData?.companyId || null
  const isAdmin = companyData?.isAdmin || false
  const isLoadingCompanyId = isLoadingCompanyData

  // Fetch teams list
  const { data: teams = [], isLoading: teamsLoading } = useQuery<ClientTeam[]>({
    queryKey: ['client-teams', companyId],
    queryFn: async () => {
      if (!companyId) return []
      const result = await api.get<ClientTeam[]>(`/api/v1/client-teams/${companyId}`, { showToast: false })
      if (!result.success || !result.data) return []
      return Array.isArray(result.data) ? result.data : []
    },
    enabled: !!companyId,
  })

  const defaultTeamId = teams.find((t) => t.is_default)?.id ?? teams[0]?.id ?? ""

  // Fetch other corporate companies (with admin) for "Add Existing User"
  const { data: corporateCompanies = [] } = useQuery<CorporateCompanyOption[]>({
    queryKey: ['corporate-companies', companyId],
    queryFn: async () => {
      if (!companyId) return []
      const result = await api.get<CorporateCompanyOption[]>(`/api/v1/client-teams/${companyId}/corporate-companies`, { showToast: false })
      if (!result.success || !result.data) return []
      return Array.isArray(result.data) ? result.data : []
    },
    enabled: !!companyId && addExistingDialogOpen,
  })

  const selectedCompany = addExistingForm.corporateCompanyId
    ? corporateCompanies.find((c) => c.id === addExistingForm.corporateCompanyId)
    : null

  // Fetch client team members via API (server-side list so newly added members appear immediately)
  const { data: members = [], isLoading: membersLoading } = useQuery<ClientTeamMember[]>({
    queryKey: ['client-team-members', companyId],
    queryFn: async () => {
      if (!companyId) return []
      const result = await api.get<ClientTeamMember[]>(`/api/v1/client-teams/${companyId}/members`, { showToast: false })
      if (!result.success || !result.data) {
        addNotification({
          type: 'error',
          message: result.error || 'Failed to load team members',
          duration: 5000,
        })
        return []
      }
      return Array.isArray(result.data) ? result.data : []
    },
    enabled: !!companyId,
  })

  // Fetch pending invitations (using company_invitations table)
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<ClientTeamInvitation[]>({
    queryKey: ['client-team-invitations', companyId],
    queryFn: async () => {
      if (!companyId) return []
      const supabase = createClient()
      
      // Use company_invitations table for corporate client invitations
      const { data, error } = await supabase
        .from('company_invitations')
        .select('*')
        .eq('company_id', companyId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        // Table might not exist yet, return empty array
        console.log('Invitations table not found or error:', error.message)
        return []
      }

      return (data || []).map((inv: any) => ({
        ...inv,
        role: inv.role || 'member'
      }))
    },
    enabled: !!companyId,
  })

  // Generate password function
  const generatePassword = () => {
    const length = 16
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    let password = ""
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return password
  }

  // Invite member mutation
  const inviteMutation = useMutation({
    mutationFn: async ({ email, fullName, role }: { email: string; fullName: string; role: 'admin' | 'member' }) => {
      if (!companyId) throw new Error("No company ID")
      const result = await api.post(`/api/v1/client-teams/${companyId}/invitations`, { email, fullName, role }, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || 'Failed to send invitation')
      }
      return result.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['client-team-invitations', companyId] })
      setInviteDialogOpen(false)
      setInviteForm({ email: "", fullName: "", role: "member" })
      addNotification({
        type: 'success',
        message: data?.emailSent ? 'Invitation sent successfully' : 'Invitation created but email could not be sent.',
        duration: 5000,
      })
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to send invitation',
        duration: 5000,
      })
    },
  })

  // Add member directly mutation (create new user)
  const addMemberMutation = useMutation({
    mutationFn: async ({ email, fullName, role, password, teamId }: { email: string; fullName: string; role: 'admin' | 'member'; password: string; teamId?: string }) => {
      if (!companyId) throw new Error("No company ID")
      const result = await api.post(`/api/v1/client-teams/${companyId}/members`, { email, fullName, role, password, teamId }, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || 'Failed to add member')
      }
      return result.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['client-team-members', companyId] })
      queryClient.invalidateQueries({ queryKey: ['client-teams', companyId] })
      setAddMemberDialogOpen(false)
      setAddMemberForm({ email: "", fullName: "", role: "member", password: "", teamId: "" })
      addNotification({
        type: 'success',
        message: data?.message || 'Member added successfully',
        duration: 5000,
      })
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to add member',
        duration: 5000,
      })
    },
  })

  // Add existing user to team mutation (by selecting another corporate company – that company's admin is added)
  const addExistingMemberMutation = useMutation({
    mutationFn: async ({ corporateCompanyId, role, teamId }: { corporateCompanyId: string; role: 'admin' | 'member'; teamId: string }) => {
      if (!companyId) throw new Error("No company ID")
      const result = await api.post(`/api/v1/client-teams/${companyId}/members`, { corporateCompanyId, role, teamId }, { showToast: false })
      if (!result.success) throw new Error(result.error || 'Failed to add user')
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-team-members', companyId] })
      queryClient.invalidateQueries({ queryKey: ['client-teams', companyId] })
      setAddExistingDialogOpen(false)
      setAddExistingForm({ corporateCompanyId: "", role: "member", teamId: defaultTeamId })
      addNotification({ type: 'success', message: 'Company admin added to team', duration: 5000 })
    },
    onError: (error: Error) => {
      addNotification({ type: 'error', message: error.message || 'Failed to add user', duration: 5000 })
    },
  })

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      if (!companyId) throw new Error("No company ID")
      const result = await api.post(`/api/v1/client-teams/${companyId}`, { name, description }, { showToast: false })
      if (!result.success) throw new Error(result.error || 'Failed to create team')
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-teams', companyId] })
      setCreateTeamDialogOpen(false)
      setCreateTeamForm({ name: "", description: "" })
      addNotification({ type: 'success', message: 'Team created', duration: 5000 })
    },
    onError: (error: Error) => {
      addNotification({ type: 'error', message: error.message || 'Failed to create team', duration: 5000 })
    },
  })

  // Update member mutation
  const updateMemberMutation = useMutation({
    mutationFn: async (updates: Partial<typeof editForm> & { memberId: string }) => {
      if (!companyId) throw new Error("No company ID")
      const { memberId, ...rest } = updates
      const result = await api.patch(`/api/v1/client-teams/${companyId}/members/${memberId}`, rest, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || 'Failed to update member')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-team-members', companyId] })
      setEditDialogOpen(false)
      setSelectedMember(null)
      addNotification({
        type: 'success',
        message: 'Member updated successfully',
        duration: 5000,
      })
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to update member',
        duration: 5000,
      })
    },
  })

  // Delete member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!companyId) throw new Error("No company ID")
      const result = await api.delete(`/api/v1/client-teams/${companyId}/members/${memberId}`, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || 'Failed to remove member')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-team-members', companyId] })
      addNotification({
        type: 'success',
        message: 'Member removed successfully',
        duration: 5000,
      })
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to remove member',
        duration: 5000,
      })
    },
  })

  // Delete invitation mutation
  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!companyId) throw new Error("No company ID")
      const supabase = createClient()
      const { error } = await supabase
        .from('company_invitations')
        .delete()
        .eq('id', invitationId)
        .eq('company_id', companyId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-team-invitations', companyId] })
      addNotification({
        type: 'success',
        message: 'Invitation cancelled',
        duration: 5000,
      })
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to cancel invitation',
        duration: 5000,
      })
    },
  })

  const filteredMembers = selectedTeamId
    ? (members as ClientTeamMember[]).filter((m) => m.teams?.some((t) => t.id === selectedTeamId))
    : (members as ClientTeamMember[])

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      admin: { label: "Admin", variant: "default" },
      member: { label: "Member", variant: "outline" },
    }
    const roleInfo = roleMap[role] || { label: role, variant: "outline" as const }
    return <Badge variant={roleInfo.variant}>{roleInfo.label}</Badge>
  }

  const isLoading = isLoadingCompanyId || membersLoading || invitationsLoading || teamsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!companyId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>Company ID not found. Please refresh the page.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Teams list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Teams
              </CardTitle>
              <CardDescription>
                Create teams and add members from your organization or other companies
              </CardDescription>
            </div>
            {isAdmin && (
              <Dialog open={createTeamDialogOpen} onOpenChange={setCreateTeamDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Team
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Team</DialogTitle>
                    <DialogDescription>
                      Add a new team. You can add members from any company to this team.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="team-name">Team name *</Label>
                      <Input
                        id="team-name"
                        placeholder="e.g. Logistics, Sales"
                        value={createTeamForm.name}
                        onChange={(e) => setCreateTeamForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="team-desc">Description (optional)</Label>
                      <Input
                        id="team-desc"
                        placeholder="Brief description"
                        value={createTeamForm.description}
                        onChange={(e) => setCreateTeamForm((p) => ({ ...p, description: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setCreateTeamDialogOpen(false)}>Cancel</Button>
                    <Button
                      onClick={() => createTeamMutation.mutate(createTeamForm)}
                      disabled={!createTeamForm.name.trim() || createTeamMutation.isPending}
                    >
                      {createTeamMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams yet. Create a team to add members.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {teams.map((t) => (
                <Badge key={t.id} variant={t.is_default ? "default" : "secondary"} className="text-sm py-1.5 px-3">
                  {t.name} ({t.member_count})
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members
              </CardTitle>
              <CardDescription>
                Manage your company team members and their permissions
              </CardDescription>
            </div>
            {isAdmin && (
            <div className="flex gap-2">
              {/* Add existing user (any company) */}
              <Dialog open={addExistingDialogOpen} onOpenChange={(open) => { setAddExistingDialogOpen(open); if (open) setAddExistingForm((p) => ({ ...p, teamId: defaultTeamId || p.teamId })); if (!open) setAddExistingForm({ corporateCompanyId: "", role: "member", teamId: defaultTeamId }) }}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Existing User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Existing User to Team</DialogTitle>
                    <DialogDescription>
                      Select another corporate company. That company&apos;s admin will be added to your team.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Company *</Label>
                      <Select
                        value={addExistingForm.corporateCompanyId || ""}
                        onValueChange={(v) => setAddExistingForm((p) => ({ ...p, corporateCompanyId: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a company" />
                        </SelectTrigger>
                        <SelectContent>
                          {corporateCompanies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {corporateCompanies.length === 0 && (
                        <p className="text-xs text-muted-foreground">No other corporate companies in the system.</p>
                      )}
                    </div>
                    {selectedCompany && (
                      <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Admin to be added</p>
                        <p className="text-sm font-medium">{selectedCompany.admin.name || selectedCompany.admin.email}</p>
                        <p className="text-xs text-muted-foreground">{selectedCompany.admin.email}</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Team *</Label>
                      <Select
                        value={addExistingForm.teamId || defaultTeamId}
                        onValueChange={(v) => setAddExistingForm((p) => ({ ...p, teamId: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}{t.is_default ? " (default)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="existing-role">Role *</Label>
                      <Select
                        value={addExistingForm.role}
                        onValueChange={(v: "admin" | "member") => setAddExistingForm((p) => ({ ...p, role: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setAddExistingDialogOpen(false)}>Cancel</Button>
                    <Button
                      onClick={() => addExistingMemberMutation.mutate({
                        corporateCompanyId: addExistingForm.corporateCompanyId,
                        role: addExistingForm.role,
                        teamId: addExistingForm.teamId || defaultTeamId,
                      })}
                      disabled={!addExistingForm.corporateCompanyId || !(addExistingForm.teamId || defaultTeamId) || addExistingMemberMutation.isPending}
                    >
                      {addExistingMemberMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Add to Team
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {/* Add Member Directly (create new user) */}
              <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Team Member</DialogTitle>
                    <DialogDescription>
                      Create a new user account and add them to your team
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="add-email">Email *</Label>
                      <Input
                        id="add-email"
                        type="email"
                        placeholder="colleague@example.com"
                        value={addMemberForm.email}
                        onChange={(e) => setAddMemberForm({ ...addMemberForm, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-fullName">Full Name *</Label>
                      <Input
                        id="add-fullName"
                        placeholder="John Doe"
                        value={addMemberForm.fullName}
                        onChange={(e) => setAddMemberForm({ ...addMemberForm, fullName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Team *</Label>
                      <Select
                        value={addMemberForm.teamId ?? defaultTeamId}
                        onValueChange={(v) => setAddMemberForm((p) => ({ ...p, teamId: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}{t.is_default ? " (default)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-role">Role *</Label>
                      <Select
                        value={addMemberForm.role}
                        onValueChange={(value: "admin" | "member") =>
                          setAddMemberForm({ ...addMemberForm, role: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Admins can manage team members and company settings
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="add-password">Password *</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setAddMemberForm({ ...addMemberForm, password: generatePassword() })}
                        >
                          Generate
                        </Button>
                      </div>
                      <div className="relative">
                        <Input
                          id="add-password"
                          type={showAddPassword ? "text" : "password"}
                          placeholder="Set initial password"
                          value={addMemberForm.password}
                          onChange={(e) => setAddMemberForm({ ...addMemberForm, password: e.target.value })}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAddPassword(!showAddPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddMemberDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => addMemberMutation.mutate({
                        email: addMemberForm.email,
                        fullName: addMemberForm.fullName,
                        role: addMemberForm.role,
                        password: addMemberForm.password,
                        teamId: addMemberForm.teamId || defaultTeamId || undefined,
                      })}
                      disabled={addMemberMutation.isPending || !addMemberForm.email || !addMemberForm.fullName || !addMemberForm.password}
                    >
                      {addMemberMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Add Member
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Invite Member */}
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Mail className="h-4 w-4 mr-2" />
                    Invite Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation email to join your team
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="invite-email">Email *</Label>
                      <Input
                        id="invite-email"
                        type="email"
                        placeholder="colleague@example.com"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-fullName">Full Name</Label>
                      <Input
                        id="invite-fullName"
                        placeholder="John Doe"
                        value={inviteForm.fullName}
                        onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-role">Role *</Label>
                      <Select
                        value={inviteForm.role}
                        onValueChange={(value: "admin" | "member") =>
                          setInviteForm({ ...inviteForm, role: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => inviteMutation.mutate({
                        email: inviteForm.email,
                        fullName: inviteForm.fullName,
                        role: inviteForm.role,
                      })}
                      disabled={inviteMutation.isPending || !inviteForm.email}
                    >
                      {inviteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Send Invitation
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Active Members */}
            <div>
              <h3 className="text-sm font-medium mb-4">
                Active Members ({filteredMembers.length}
                {selectedTeamId ? ` in ${teams.find((t) => t.id === selectedTeamId)?.name ?? "team"}` : ""})
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Teams</TableHead>
                    <TableHead>Joined</TableHead>
                    {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {                    filteredMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground">
                        {selectedTeamId ? "No members in this team" : "No team members yet"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-wrap items-center gap-2">
                            {member.profile?.avatar_url ? (
                              <img
                                src={member.profile.avatar_url}
                                alt=""
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                <User className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <span>{member.profile?.name || member.profile?.email?.split('@')[0] || 'Unknown'}</span>
                            {member.company_name && (
                              <Badge variant="secondary" className="text-xs font-normal">
                                {member.company_name}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{member.profile?.email}</TableCell>
                        <TableCell>
                          {member.company_name ? (
                            <Badge variant="secondary">Partner company</Badge>
                          ) : (
                            getRoleBadge(member.role)
                          )}
                        </TableCell>
                        <TableCell>
                          {member.teams?.length
                            ? member.teams.map((t) => (
                                <Badge key={t.id} variant="outline" className="mr-1 mb-0.5">
                                  {t.name}
                                </Badge>
                              ))
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : '-'}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedMember(member)
                                    setEditForm({
                                      name: member.profile?.name || "",
                                      email: member.profile?.email || "",
                                      phone: member.profile?.phone || "",
                                      role: member.role,
                                      avatarUrl: member.profile?.avatar_url || "",
                                      password: "",
                                    })
                                    setShowEditPassword(false)
                                    setEditDialogOpen(true)
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                {member.user_id !== user?.id && (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => {
                                      if (confirm(`Remove ${member.profile?.name || member.profile?.email} from the team?`)) {
                                        deleteMemberMutation.mutate(member.id)
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-4">Pending Invitations ({invitations.length})</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Invited</TableHead>
                      <TableHead>Expires</TableHead>
                      {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>{getRoleBadge(invitation.role)}</TableCell>
                        <TableCell>{new Date(invitation.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(invitation.expires_at).toLocaleDateString()}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => deleteInvitationMutation.mutate(invitation.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Cancel Invitation
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Member Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              {selectedMember?.company_name
                ? "Partner company user – view only. You can remove them from the team."
                : "Update member information and permissions"}
            </DialogDescription>
          </DialogHeader>

          {selectedMember?.company_name ? (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{selectedMember.profile?.name || selectedMember.profile?.email || "Unknown"}</span>
                  <Badge variant="secondary">Partner company</Badge>
                  <Badge variant="outline">{selectedMember.company_name}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{selectedMember.profile?.email}</p>
                {selectedMember.teams?.length ? (
                  <p className="text-xs text-muted-foreground">
                    In teams: {selectedMember.teams.map((t) => t.name).join(", ")}
                  </p>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                This user is from another company. Role and profile are managed by their organization. You can only remove them from your team.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    placeholder="John Doe"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Role</Label>
                  <Select
                    value={editForm.role}
                    onValueChange={(value: "admin" | "member") =>
                      setEditForm({ ...editForm, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <div className="[&_.react-international-phone-input-container]:flex [&_.react-international-phone-input-container]:items-center [&_.react-international-phone-input-container]:gap-2 [&_.react-international-phone-input-container]:w-full">
                  <PhoneInput
                    defaultCountry="us"
                    value={editForm.phone || ""}
                    onChange={handleEditPhoneChange}
                    disabled={updateMemberMutation.isPending}
                    inputProps={{
                      name: 'edit-phone',
                      id: 'edit-phone',
                      className: 'h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
                    }}
                    countrySelectorStyleProps={{
                      buttonClassName: 'h-9 rounded-l-md border border-r-0 border-input bg-transparent px-3 flex items-center justify-center hover:bg-accent transition-colors'
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-password">New Password (optional)</Label>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={showEditPassword ? "text" : "password"}
                    placeholder="Leave empty to keep current"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    disabled={updateMemberMutation.isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                  >
                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {selectedMember?.company_name ? "Close" : "Cancel"}
            </Button>
            {!selectedMember?.company_name && (
              <Button
                onClick={() => {
                  if (!selectedMember) return
                  updateMemberMutation.mutate({
                    memberId: selectedMember.id,
                    name: editForm.name,
                    phone: editForm.phone,
                    role: editForm.role,
                    ...(editForm.password ? { password: editForm.password } : {}),
                  })
                }}
                disabled={updateMemberMutation.isPending}
              >
                {updateMemberMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
