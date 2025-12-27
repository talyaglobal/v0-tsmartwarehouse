"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Edit, Trash2, Loader2, UserPlus } from "@/components/icons"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { useUIStore } from "@/stores/ui.store"

interface CompanyMember {
  id: string
  company_id: string
  email: string
  name: string | null
  role: 'company_owner' | 'company_admin' | 'warehouse_staff' | 'customer'
  avatar: string | null
  phone: string | null
  invited_by: string | null
  created_at: string
  updated_at: string
}

interface Invitation {
  id: string
  company_id: string
  email: string
  role: 'company_owner' | 'company_admin' | 'member'
  invited_by?: string
  token: string
  expires_at: string
  created_at: string
  profiles: {
    id: string
    name: string | null
    email: string
  } | null
}

export default function TeamMembersPage() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<CompanyMember | null>(null)
  const [inviteForm, setInviteForm] = useState({ email: "", fullName: "", role: "company_admin" as 'company_admin' | 'warehouse_staff' })
  const [editForm, setEditForm] = useState({ role: "company_admin" as 'company_admin' | 'warehouse_staff' })

  // Get user's company ID from profiles table
  const { data: companyData } = useQuery({
    queryKey: ['user-company', user?.id],
    queryFn: async () => {
      if (!user) return null
      const supabase = createClient()
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()
      
      if (profileError || !profileData) return null
      return { company_id: profileData.company_id }
    },
    enabled: !!user,
  })

  useEffect(() => {
    if (companyData?.company_id) {
      setCompanyId(companyData.company_id)
    }
  }, [companyData])

  // Fetch company members
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['company-members', companyId],
    queryFn: async () => {
      if (!companyId) return []
      const result = await api.get<CompanyMember[]>(`/api/v1/companies/${companyId}/members`, { showToast: false })
      return result.success ? (result.data || []) : []
    },
    enabled: !!companyId,
  })

  // Fetch invitations
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery({
    queryKey: ['company-invitations', companyId],
    queryFn: async () => {
      if (!companyId) return []
      const result = await api.get<Invitation[]>(`/api/v1/companies/${companyId}/invitations`, { showToast: false })
      return result.success ? (result.data || []) : []
    },
    enabled: !!companyId,
  })

  // Invite member mutation
  const inviteMutation = useMutation({
    mutationFn: async ({ email, fullName, role }: { email: string; fullName: string; role: 'company_admin' | 'warehouse_staff' }) => {
      if (!companyId) throw new Error("No company ID")
      const result = await api.post(`/api/v1/companies/${companyId}/invitations`, { email, fullName, role }, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || 'Failed to send invitation')
      }
      return result.data
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['company-invitations', companyId] })
      setInviteDialogOpen(false)
      setInviteForm({ email: "", fullName: "", role: "company_admin" })
      
      // Check if email was actually sent
      const emailSent = data?.emailSent ?? false
      if (emailSent) {
        addNotification({
          type: 'success',
          message: 'Invitation sent successfully',
          duration: 5000,
        })
      } else {
        addNotification({
          type: 'warning',
          message: 'Invitation created but email could not be sent. Please check SMTP configuration in .env.local',
          duration: 10000,
        })
      }
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to send invitation',
        duration: 5000,
      })
    },
  })

  // Update member mutation
  const updateMemberMutation = useMutation({
    mutationFn: async ({ memberId, updates }: { memberId: string; updates: { role?: string } }) => {
      if (!companyId) throw new Error("No company ID")
      const result = await api.patch(`/api/v1/companies/${companyId}/members/${memberId}`, updates, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || 'Failed to update member')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-members', companyId] })
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
      const result = await api.delete(`/api/v1/companies/${companyId}/members/${memberId}`, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete member')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-members', companyId] })
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
      const result = await api.delete(`/api/v1/companies/${companyId}/invitations/${invitationId}`, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete invitation')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-invitations', companyId] })
      addNotification({
        type: 'success',
        message: 'Invitation cancelled successfully',
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

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    inviteMutation.mutate({ email: inviteForm.email, fullName: inviteForm.fullName, role: inviteForm.role })
  }

  const handleEdit = (member: CompanyMember) => {
    setSelectedMember(member)
    // Map roles: company_owner stays as is, company_admin -> company_admin, warehouse_staff -> warehouse_staff, customer -> company_admin (default)
    let editRole: 'company_admin' | 'warehouse_staff' = 'company_admin'
    if (member.role === 'warehouse_staff') {
      editRole = 'warehouse_staff'
    } else if (member.role === 'company_admin') {
      editRole = 'company_admin'
    }
    setEditForm({ role: editRole })
    setEditDialogOpen(true)
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMember) return
    updateMemberMutation.mutate({
      memberId: selectedMember.id,
      updates: { role: editForm.role },
    })
  }

  const handleDelete = (member: CompanyMember) => {
    if (confirm(`Are you sure you want to remove ${member.name || member.email || 'this member'}?`)) {
      deleteMemberMutation.mutate(member.id)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'company_owner':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
      case 'company_admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'warehouse_staff':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'customer':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400'
    }
  }

  const getInvitationStatus = (invitation: Invitation) => {
    // If invitation has no token, it's already accepted (but shouldn't appear in invitations list)
    if (!invitation.token) {
      return { status: 'accepted', label: 'Accepted' }
    }
    const now = new Date()
    const expiresAt = new Date(invitation.expires_at)
    if (expiresAt < now) {
      return { status: 'expired', label: 'Expired' }
    }
    return { status: 'pending', label: 'Pending' }
  }

  const getInvitationStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'expired':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400'
    }
  }

  // Check if user is company admin (using profiles.role)
  const { data: isCompanyAdmin } = useQuery({
    queryKey: ['company-admin', user?.id, companyId],
    queryFn: async () => {
      if (!user || !companyId) return false
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('role, company_id')
        .eq('id', user.id)
        .eq('company_id', companyId)
        .in('role', ['company_owner', 'company_admin'])
        .maybeSingle()
      
      return !error && !!data
    },
    enabled: !!user && !!companyId,
  })

  // Filter active invitations (invitations that haven't been accepted yet)
  // Since we're using profiles table now, invitations with null invitation_token won't be returned by API
  // But we still filter on client side for safety
  const activeInvitations = invitations.filter(inv => {
    if (!inv.token || !inv.expires_at) return false // No token or expiry means already accepted
    return new Date(inv.expires_at) > new Date() // Not expired
  })

  if (membersLoading || invitationsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!companyId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-lg font-medium">No company associated</p>
          <p className="text-muted-foreground">You need to be part of a company to manage team members.</p>
        </div>
      </div>
    )
  }

  if (isCompanyAdmin === false) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-muted-foreground">Only company admins can manage team members.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Members"
        description="Manage your company team members and invitations"
      >
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to join your company
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={inviteForm.fullName}
                  onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(value) => setInviteForm({ ...inviteForm, role: value as 'company_owner' | 'company_admin' | 'member' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company_admin">Company Admin</SelectItem>
                    <SelectItem value="warehouse_staff">Warehouse Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Invitation"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Active Invitations */}
      {activeInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>Invitations waiting for acceptance</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invited</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeInvitations.map((invitation) => {
                  const invitationStatus = getInvitationStatus(invitation)
                  return (
                    <TableRow key={invitation.id}>
                      <TableCell>{invitation.email}</TableCell>
                      <TableCell>
                        <Badge className={getRoleBadgeColor(invitation.role)}>
                          {invitation.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getInvitationStatusBadgeColor(invitationStatus.status)}>
                          {invitationStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(invitation.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(invitation.expires_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Cancel this invitation?')) {
                              deleteInvitationMutation.mutate(invitation.id)
                            }
                          }}
                          disabled={deleteInvitationMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage your company team members</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No team members found
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                          {member.name?.charAt(0) || member.email?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium">{member.name || 'No name'}</p>
                          <p className="text-sm text-muted-foreground">{member.email || 'No email'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(member.role)}>
                        {member.role === 'customer' ? 'Customer' : member.role === 'company_admin' ? 'Company Admin' : member.role === 'warehouse_staff' ? 'Warehouse Staff' : member.role === 'company_owner' ? 'Company Owner' : member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Activated
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.created_at
                        ? new Date(member.created_at).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(member)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(member)}
                            className="text-destructive"
                            disabled={member.role === 'company_owner'}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Member Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update member role
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(value) => setEditForm({ ...editForm, role: value as 'company_admin' | 'warehouse_staff' })}
                disabled={selectedMember?.role === 'company_owner'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company_admin">Company Admin</SelectItem>
                  <SelectItem value="warehouse_staff">Warehouse Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMemberMutation.isPending}>
                {updateMemberMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

