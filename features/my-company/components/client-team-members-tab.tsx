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
import { MoreHorizontal, Edit, Trash2, Loader2, UserPlus, Eye, EyeOff, User, Mail, Shield, Users } from "@/components/icons"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { useUIStore } from "@/stores/ui.store"
import { PhoneInput } from 'react-international-phone'
import 'react-international-phone/style.css'

interface ClientTeamMember {
  id: string
  user_id: string
  company_id: string
  role: 'admin' | 'member'
  can_create_bookings: boolean
  can_view_all_bookings: boolean
  can_manage_team: boolean
  invited_by: string | null
  joined_at: string
  created_at: string
  updated_at: string
  // Joined from profiles
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

export function ClientTeamMembersTab() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<ClientTeamMember | null>(null)
  const [showAddPassword, setShowAddPassword] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)

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
  })

  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "member" as "admin" | "member",
    avatarUrl: "",
    password: "",
    canCreateBookings: true,
    canViewAllBookings: false,
    canManageTeam: false,
  })

  // Handle phone change for edit form
  const handleEditPhoneChange = useCallback((value: string) => {
    setEditForm((prev) => ({ ...prev, phone: value }))
  }, [])

  // Get user's company ID
  const { data: companyId, isLoading: isLoadingCompanyId } = useQuery({
    queryKey: ['user-company-id', user?.id],
    queryFn: async () => {
      if (!user) return null
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle()
      return profile?.company_id || null
    },
    enabled: !!user,
  })

  // Fetch client team members (users with this company_id and client_type='corporate')
  const { data: members = [], isLoading: membersLoading } = useQuery<ClientTeamMember[]>({
    queryKey: ['client-team-members', companyId],
    queryFn: async () => {
      if (!companyId) return []
      const supabase = createClient()
      
      // Get all profiles in this company with client_type = 'corporate'
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, phone, avatar_url, created_at, updated_at')
        .eq('company_id', companyId)
        .eq('client_type', 'corporate')
        .order('created_at', { ascending: false })

      if (profilesError) {
        console.error('Error fetching client team members:', profilesError)
        addNotification({
          type: 'error',
          message: 'Failed to load team members',
          duration: 5000,
        })
        return []
      }

      // Get team membership info for each profile
      const profileIds = profiles?.map((p: { id: string }) => p.id) || []
      
      let teamMembersMap: Record<string, { role: string; joined_at: string | null }> = {}
      
      if (profileIds.length > 0) {
        const { data: teamMembers } = await supabase
          .from('client_team_members')
          .select('member_id, role, joined_at')
          .in('member_id', profileIds)
        
        teamMembers?.forEach((tm: any) => {
          // If user is in multiple teams, use the highest role (admin > member)
          if (!teamMembersMap[tm.member_id] || tm.role === 'admin') {
            teamMembersMap[tm.member_id] = { role: tm.role, joined_at: tm.joined_at }
          }
        })
      }

      return (profiles || []).map((profile: any) => ({
        id: profile.id,
        user_id: profile.id,
        company_id: companyId,
        role: teamMembersMap[profile.id]?.role || 'member',
        can_create_bookings: true, // Default permissions
        can_view_all_bookings: teamMembersMap[profile.id]?.role === 'admin',
        can_manage_team: teamMembersMap[profile.id]?.role === 'admin',
        invited_by: null,
        joined_at: teamMembersMap[profile.id]?.joined_at || profile.created_at,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        profile: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          avatar_url: profile.avatar_url,
        }
      }))
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

  // Add member directly mutation
  const addMemberMutation = useMutation({
    mutationFn: async ({ email, fullName, role, password }: { email: string; fullName: string; role: 'admin' | 'member'; password: string }) => {
      if (!companyId) throw new Error("No company ID")
      const result = await api.post(`/api/v1/client-teams/${companyId}/members`, { email, fullName, role, password }, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || 'Failed to add member')
      }
      return result.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['client-team-members', companyId] })
      setAddMemberDialogOpen(false)
      setAddMemberForm({ email: "", fullName: "", role: "member", password: "" })
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

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      admin: { label: "Admin", variant: "default" },
      member: { label: "Member", variant: "outline" },
    }
    const roleInfo = roleMap[role] || { label: role, variant: "outline" as const }
    return <Badge variant={roleInfo.variant}>{roleInfo.label}</Badge>
  }

  const isLoading = isLoadingCompanyId || membersLoading || invitationsLoading

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
            <div className="flex gap-2">
              {/* Add Member Directly */}
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Active Members */}
            <div>
              <h3 className="text-sm font-medium mb-4">Active Members ({members.length})</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No team members yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
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
                            {member.profile?.name || member.profile?.email?.split('@')[0] || 'Unknown'}
                          </div>
                        </TableCell>
                        <TableCell>{member.profile?.email}</TableCell>
                        <TableCell>{getRoleBadge(member.role)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {member.can_create_bookings && (
                              <Badge variant="secondary" className="text-xs">Create Bookings</Badge>
                            )}
                            {member.can_view_all_bookings && (
                              <Badge variant="secondary" className="text-xs">View All</Badge>
                            )}
                            {member.can_manage_team && (
                              <Badge variant="secondary" className="text-xs">Manage Team</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : '-'}
                        </TableCell>
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
                                    canCreateBookings: member.can_create_bookings,
                                    canViewAllBookings: member.can_view_all_bookings,
                                    canManageTeam: member.can_manage_team,
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
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>{getRoleBadge(invitation.role)}</TableCell>
                        <TableCell>{new Date(invitation.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(invitation.expires_at).toLocaleDateString()}</TableCell>
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
              Update member information and permissions
            </DialogDescription>
          </DialogHeader>
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

            {/* Permissions Section */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Permissions
              </Label>
              <div className="space-y-2 pl-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.canCreateBookings}
                    onChange={(e) => setEditForm({ ...editForm, canCreateBookings: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">Can create bookings</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.canViewAllBookings}
                    onChange={(e) => setEditForm({ ...editForm, canViewAllBookings: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">Can view all company bookings</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.canManageTeam}
                    onChange={(e) => setEditForm({ ...editForm, canManageTeam: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">Can manage team members</span>
                </label>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedMember) return
                updateMemberMutation.mutate({
                  memberId: selectedMember.id,
                  name: editForm.name,
                  phone: editForm.phone,
                  role: editForm.role,
                  canCreateBookings: editForm.canCreateBookings,
                  canViewAllBookings: editForm.canViewAllBookings,
                  canManageTeam: editForm.canManageTeam,
                  ...(editForm.password ? { password: editForm.password } : {}),
                })
              }}
              disabled={updateMemberMutation.isPending}
            >
              {updateMemberMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
