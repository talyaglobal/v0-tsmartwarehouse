"use client"

import { useState } from "react"
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
  role: 'root' | 'company_admin' | 'member' | 'warehouse_staff' | 'owner'
  avatar_url: string | null
  avatar: string | null
  phone: string | null
  invited_by: string | null
  membership_tier?: 'bronze' | 'silver' | 'gold' | 'platinum' | null
  credit_balance?: number | null
  created_at: string
  updated_at: string
}

interface Invitation {
  id: string
  company_id: string
  email: string
  role: 'owner' | 'company_admin' | 'member'
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

export function TeamMembersTab() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<CompanyMember | null>(null)
  const [inviteForm, setInviteForm] = useState({
    email: "",
    fullName: "",
    role: "member" as "owner" | "company_admin" | "member",
  })
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "member" as "root" | "company_admin" | "member" | "warehouse_staff" | "owner",
    avatar_url: "",
    membership_tier: "none" as "none" | "bronze" | "silver" | "gold" | "platinum",
    credit_balance: "0",
  })

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

  // Fetch team members using API route (bypasses RLS and ensures proper permissions)
  const { data: members = [], isLoading: membersLoading, error: membersError } = useQuery<CompanyMember[]>({
    queryKey: ['company-members', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.warn('TeamMembersTab: No companyId available')
        return []
      }
      console.log('TeamMembersTab: Fetching members for companyId:', companyId)
      const result = await api.get<CompanyMember[]>(`/api/v1/companies/${companyId}/members`, { showToast: false })
      console.log('TeamMembersTab: API result:', result)
      if (!result.success) {
        console.error('TeamMembersTab: API error:', result.error)
        addNotification({
          type: 'error',
          message: result.error || 'Failed to fetch team members',
          duration: 5000,
        })
        return []
      }
      const membersList = result.data || []
      console.log('TeamMembersTab: Members fetched:', membersList.length)
      return membersList
    },
    enabled: !!companyId,
    retry: 1,
  })

  // Fetch pending invitations
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<Invitation[]>({
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
    mutationFn: async ({ email, fullName, role }: { email: string; fullName: string; role: 'owner' | 'company_admin' | 'member' }) => {
      if (!companyId) throw new Error("No company ID")
      const result = await api.post(`/api/v1/companies/${companyId}/invitations`, { email, fullName, role }, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || 'Failed to send invitation')
      }
      return result.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['company-invitations', companyId] })
      setInviteDialogOpen(false)
      setInviteForm({ email: "", fullName: "", role: "member" })
      addNotification({
        type: 'success',
        message: data.emailSent ? 'Invitation sent successfully' : 'Invitation created but email could not be sent. Check SMTP config.',
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

  // Update member mutation
  const updateMemberMutation = useMutation({
    mutationFn: async (updates: Partial<typeof editForm>) => {
      if (!companyId || !selectedMember) throw new Error("No company ID or member selected")
      const result = await api.patch(`/api/v1/companies/${companyId}/members/${selectedMember.id}`, updates, { showToast: false })
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
        message: 'Member deleted successfully',
        duration: 5000,
      })
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to delete member',
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
        message: 'Invitation deleted successfully',
        duration: 5000,
      })
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to delete invitation',
        duration: 5000,
      })
    },
  })

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      root: { label: "System Admin", variant: "default" },
      owner: { label: "Owner", variant: "default" },
      company_admin: { label: "Company Admin", variant: "secondary" },
      member: { label: "Member", variant: "outline" },
      warehouse_staff: { label: "Warehouse Staff", variant: "outline" },
    }
    const roleInfo = roleMap[role] || { label: role, variant: "outline" as const }
    return <Badge variant={roleInfo.variant}>{roleInfo.label}</Badge>
  }

  // Show loading if companyId, members, or invitations are loading
  const isLoading = isLoadingCompanyId || membersLoading || invitationsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (membersError) {
    console.error('TeamMembersTab: Error loading members:', membersError)
  }

  if (!companyId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>Company ID not found. Please refresh the page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Manage your company team members and invitations
              </CardDescription>
            </div>
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
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
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={inviteForm.fullName}
                      onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={inviteForm.role}
                      onValueChange={(value: "owner" | "company_admin" | "member") =>
                        setInviteForm({ ...inviteForm, role: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="company_admin">Company Admin</SelectItem>
                        <SelectItem value="owner">Owner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setInviteDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      inviteMutation.mutate({
                        email: inviteForm.email,
                        fullName: inviteForm.fullName,
                        role: inviteForm.role,
                      })
                    }}
                    disabled={inviteMutation.isPending || !inviteForm.email}
                  >
                    {inviteMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Send Invitation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No team members yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.name || member.email.split('@')[0]}
                        </TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>{getRoleBadge(member.role)}</TableCell>
                        <TableCell>
                          {new Date(member.created_at).toLocaleDateString()}
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
                                    name: member.name || "",
                                    email: member.email || "",
                                    phone: member.phone || "",
                                    role: member.role,
                                    avatar_url: member.avatar_url || "",
                                    membership_tier: (member.membership_tier || "none") as "none" | "bronze" | "silver" | "gold" | "platinum",
                                    credit_balance: member.credit_balance?.toString() || "0",
                                  })
                                  setEditDialogOpen(true)
                                }}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete ${member.name || member.email}? This action cannot be undone.`)) {
                                    deleteMemberMutation.mutate(member.id)
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
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
                        <TableCell>
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {new Date(invitation.expires_at).toLocaleDateString()}
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
              Update member information
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
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="john@example.com"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(value: "root" | "company_admin" | "member" | "warehouse_staff" | "owner") =>
                    setEditForm({ ...editForm, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="company_admin">Company Admin</SelectItem>
                    <SelectItem value="warehouse_staff">Warehouse Staff</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    {selectedMember?.role === 'root' && (
                      <SelectItem value="root">System Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-avatar">Avatar URL</Label>
              <Input
                id="edit-avatar"
                type="url"
                placeholder="https://example.com/avatar.jpg"
                value={editForm.avatar_url}
                onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-membership-tier">Membership Tier</Label>
                <Select
                  value={editForm.membership_tier}
                  onValueChange={(value: "none" | "bronze" | "silver" | "gold" | "platinum") =>
                    setEditForm({ ...editForm, membership_tier: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="bronze">Bronze</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="platinum">Platinum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-credit-balance">Credit Balance</Label>
                <Input
                  id="edit-credit-balance"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={editForm.credit_balance}
                  onChange={(e) => setEditForm({ ...editForm, credit_balance: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false)
                setSelectedMember(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const updates: any = {}
                if (editForm.name !== selectedMember?.name) updates.name = editForm.name
                if (editForm.email !== selectedMember?.email) updates.email = editForm.email
                if (editForm.phone !== selectedMember?.phone) updates.phone = editForm.phone
                if (editForm.role !== selectedMember?.role) updates.role = editForm.role
                const currentAvatar = selectedMember?.avatar_url || ""
                if (editForm.avatar_url !== currentAvatar) updates.avatar_url = editForm.avatar_url
                if (editForm.membership_tier !== "none") {
                  updates.membership_tier = editForm.membership_tier
                } else if (selectedMember?.membership_tier) {
                  // If changing from a tier to "none", set to null
                  updates.membership_tier = null
                }
                const creditBalance = parseFloat(editForm.credit_balance)
                if (!isNaN(creditBalance) && creditBalance !== (selectedMember?.credit_balance || 0)) {
                  updates.credit_balance = creditBalance
                }

                updateMemberMutation.mutate(updates)
              }}
              disabled={updateMemberMutation.isPending}
            >
              {updateMemberMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

