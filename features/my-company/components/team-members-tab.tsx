"use client"

import { useState, useRef, useCallback } from "react"
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
import { MoreHorizontal, Edit, Trash2, Loader2, UserPlus, Eye, EyeOff, Upload, User, X } from "@/components/icons"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { useUIStore } from "@/stores/ui.store"
import { PhoneInput } from 'react-international-phone'
import 'react-international-phone/style.css'

interface CompanyMember {
  id: string
  company_id: string
  email: string
  name: string | null
  role: 'root' | 'company_admin' | 'member' | 'warehouse_staff' | 'company_owner'
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

export function TeamMembersTab() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<CompanyMember | null>(null)
  const [inviteForm, setInviteForm] = useState({
    email: "",
    fullName: "",
    role: "member" as "company_admin" | "member" | "warehouse_staff",
  })
  const [addMemberForm, setAddMemberForm] = useState({
    email: "",
    fullName: "",
    role: "member" as "company_admin" | "member" | "warehouse_staff",
    password: "",
  })
  const [showAddPassword, setShowAddPassword] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "member" as "root" | "company_admin" | "member" | "warehouse_staff" | "company_owner",
    avatarUrl: "",
    password: "",
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
    mutationFn: async ({ email, fullName, role }: { email: string; fullName: string; role: 'company_admin' | 'member' | 'warehouse_staff' }) => {
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

  // Add member directly mutation (no invitation email)
  const addMemberMutation = useMutation({
    mutationFn: async ({ email, fullName, role, password }: { email: string; fullName: string; role: 'company_admin' | 'member' | 'warehouse_staff'; password: string }) => {
      if (!companyId) throw new Error("No company ID")
      const result = await api.post(`/api/v1/companies/${companyId}/members`, { email, fullName, role, password }, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || 'Failed to add member')
      }
      return result.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['company-members', companyId] })
      setAddMemberDialogOpen(false)
      setAddMemberForm({ email: "", fullName: "", role: "member", password: "" })
      
      let message = data.message || 'Member added successfully. User can now login with the provided credentials.'
      if (data.emailSent === false && data.emailError) {
        message += ` However, welcome email could not be sent: ${data.emailError}`
      } else if (data.emailSent === true) {
        message += ' Welcome email has been sent.'
      }
      
      addNotification({
        type: 'success',
        message: message,
        duration: 7000,
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
      company_owner: { label: "Company Owner", variant: "default" },
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
            <div className="flex gap-2">
              <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add New Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Team Member</DialogTitle>
                    <DialogDescription>
                      Create a new user account and add them directly to your company
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
                        onValueChange={(value: "company_admin" | "member" | "warehouse_staff") =>
                          setAddMemberForm({ ...addMemberForm, role: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="company_admin">Company Admin</SelectItem>
                          <SelectItem value="warehouse_staff">Warehouse Staff</SelectItem>
                        </SelectContent>
                      </Select>
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
                          {showAddPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        User will use this password to login
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setAddMemberDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        addMemberMutation.mutate({
                          email: addMemberForm.email,
                          fullName: addMemberForm.fullName,
                          role: addMemberForm.role,
                          password: addMemberForm.password,
                        })
                      }}
                      disabled={addMemberMutation.isPending || !addMemberForm.email || !addMemberForm.fullName || !addMemberForm.password}
                    >
                      {addMemberMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Add Member
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
                      onValueChange={(value: "company_admin" | "member" | "warehouse_staff") =>
                        setInviteForm({ ...inviteForm, role: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="company_admin">Company Admin</SelectItem>
                        <SelectItem value="warehouse_staff">Warehouse Staff</SelectItem>
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
                                    avatarUrl: member.avatar_url || "",
                                    password: "",
                                  })
                                  setShowEditPassword(false)
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
            {/* Avatar Upload Section */}
            <div className="space-y-2">
              <Label>Profile Avatar</Label>
              <div className="flex items-center gap-4">
                {editForm.avatarUrl && editForm.avatarUrl.trim() !== "" ? (
                  <div className="relative">
                    <img
                      src={editForm.avatarUrl}
                      alt="Profile avatar"
                      className="h-20 w-20 object-cover border rounded-full"
                      onError={(e) => {
                        const img = e.currentTarget
                        img.style.display = 'none'
                        const fallback = img.nextElementSibling as HTMLElement
                        if (fallback) {
                          fallback.style.display = 'flex'
                        }
                      }}
                    />
                    <div className="hidden h-20 w-20 rounded-full bg-muted flex items-center justify-center border">
                      <User className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                      onClick={() => setEditForm((prev) => ({ ...prev, avatarUrl: "" }))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border">
                    <User className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return

                      // Validate file type
                      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
                        addNotification({
                          type: 'error',
                          message: 'Only JPEG and PNG images are allowed',
                          duration: 5000,
                        })
                        return
                      }

                      // Validate file size (2MB)
                      if (file.size > 2 * 1024 * 1024) {
                        addNotification({
                          type: 'error',
                          message: 'File size must be less than 2MB',
                          duration: 5000,
                        })
                        return
                      }

                      setIsUploadingAvatar(true)

                      try {
                        const formDataUpload = new FormData()
                        formDataUpload.append('file', file)
                        formDataUpload.append('bucket', 'docs')
                        formDataUpload.append('folder', 'avatar')

                        const result = await api.post('/api/v1/files/upload', formDataUpload, {
                          showToast: false,
                        })

                        if (result.success && result.data?.url) {
                          const newAvatarUrl = result.data.url
                          setEditForm((prev) => ({ ...prev, avatarUrl: newAvatarUrl }))
                          addNotification({
                            type: 'success',
                            message: 'Avatar uploaded successfully',
                            duration: 5000,
                          })
                        } else {
                          addNotification({
                            type: 'error',
                            message: result.error || 'Failed to upload avatar',
                            duration: 5000,
                          })
                        }
                      } catch (error) {
                        console.error('Error uploading avatar:', error)
                        addNotification({
                          type: 'error',
                          message: 'Failed to upload avatar',
                          duration: 5000,
                        })
                      } finally {
                        setIsUploadingAvatar(false)
                        if (avatarInputRef.current) {
                          avatarInputRef.current.value = ''
                        }
                      }
                    }}
                    disabled={isUploadingAvatar}
                    className="hidden"
                    id="edit-avatar-upload"
                  />
                  <Label htmlFor="edit-avatar-upload" className="cursor-pointer">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isUploadingAvatar}
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      {isUploadingAvatar ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Avatar
                        </>
                      )}
                    </Button>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPEG or PNG, max 2MB
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                      required: false,
                      autoFocus: false,
                      autoComplete: 'tel',
                      className: 'h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
                    }}
                    countrySelectorStyleProps={{
                      buttonClassName: 'h-9 rounded-l-md border border-r-0 border-input bg-transparent px-3 flex items-center justify-center hover:bg-accent transition-colors'
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(value: "root" | "company_admin" | "member" | "warehouse_staff" | "company_owner") =>
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
                    <SelectItem value="company_owner">Company Owner</SelectItem>
                    {selectedMember?.role === 'root' && (
                      <SelectItem value="root">System Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Password</Label>
              <div className="relative">
                <Input
                  id="edit-password"
                  type={showEditPassword ? "text" : "password"}
                  placeholder="Leave empty to keep current password"
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
                  disabled={updateMemberMutation.isPending}
                >
                  {showEditPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to keep the current password
              </p>
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
                
                // Normalize empty strings to null for comparison (nullable fields)
                const normalizeEmptyToNull = (value: string | null | undefined): string | null => {
                  if (value === null || value === undefined || value.trim() === "") return null
                  return value.trim()
                }
                
                // Compare name (nullable field - normalize empty strings to null)
                const normalizedName = normalizeEmptyToNull(editForm.name)
                const currentName = normalizeEmptyToNull(selectedMember?.name || null)
                if (normalizedName !== currentName) {
                  updates.name = normalizedName
                }
                
                // Compare email (required field, but we still need to check for changes)
                const normalizedEmail = editForm.email.trim()
                if (normalizedEmail !== (selectedMember?.email || "").trim()) {
                  updates.email = normalizedEmail
                }
                
                // Compare phone (nullable field - normalize empty strings to null)
                const normalizedPhone = normalizeEmptyToNull(editForm.phone)
                const currentPhone = normalizeEmptyToNull(selectedMember?.phone || null)
                if (normalizedPhone !== currentPhone) {
                  updates.phone = normalizedPhone
                }
                
                // Compare role (required field)
                if (editForm.role !== selectedMember?.role) {
                  updates.role = editForm.role
                }
                
                // Compare avatar_url (nullable field - normalize empty strings to null)
                const normalizedAvatarUrl = normalizeEmptyToNull(editForm.avatarUrl)
                const currentAvatarUrl = normalizeEmptyToNull(selectedMember?.avatar_url || null)
                if (normalizedAvatarUrl !== currentAvatarUrl) {
                  updates.avatar_url = normalizedAvatarUrl
                }
                
                // Only update password if it's provided and not empty
                if (editForm.password && editForm.password.trim() !== "") {
                  if (editForm.password.length < 6) {
                    addNotification({
                      type: 'error',
                      message: 'Password must be at least 6 characters',
                      duration: 5000,
                    })
                    return
                  }
                  updates.password = editForm.password
                }

                // Only make the API call if there are actual updates
                if (Object.keys(updates).length === 0) {
                  addNotification({
                    type: 'info',
                    message: 'No changes to save',
                    duration: 3000,
                  })
                  return
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

