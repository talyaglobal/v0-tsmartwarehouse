"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2, MoreHorizontal, UserPlus, Crown, Trash2, ShieldCheck, User } from "@/components/icons"
import { api } from "@/lib/api/client"
import { useUIStore } from "@/stores/ui.store"
import { useUser } from "@/lib/hooks/use-user"
import type { TeamMember, TeamRole } from "@/types"

interface TeamMembersProps {
  teamId: string
  isAdmin?: boolean
}

interface CompanyMember {
  id: string
  name: string
  email: string
  avatar?: string
}

export function TeamMembers({ teamId, isAdmin = false }: TeamMembersProps) {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState("")
  const [selectedRole, setSelectedRole] = useState<TeamRole>("member")
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch team members
  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["team-members", teamId],
    queryFn: async () => {
      const result = await api.get<TeamMember[]>(`/api/v1/teams/${teamId}/members`, { showToast: false })
      return result.success ? (result.data || []) : []
    },
  })

  // Fetch company members for adding
  const { data: companyMembers = [] } = useQuery<CompanyMember[]>({
    queryKey: ["company-members-for-team"],
    queryFn: async () => {
      // Get current user's company
      const supabase = (await import("@/lib/supabase/client")).createClient()
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user?.id)
        .single()
      
      if (!profile?.company_id) return []

      const result = await api.get<CompanyMember[]>(
        `/api/v1/companies/${profile.company_id}/members`,
        { showToast: false }
      )
      return result.success ? (result.data || []) : []
    },
    enabled: addDialogOpen && !!user,
  })

  // Filter out existing members and search
  const availableMembers = companyMembers.filter(
    (cm) => 
      !members.some((m) => m.memberId === cm.id) &&
      (cm.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       cm.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: TeamRole }) => {
      const result = await api.post(`/api/v1/teams/${teamId}/members`, { memberId, role }, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || "Failed to add member")
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", teamId] })
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      setAddDialogOpen(false)
      setSelectedMemberId("")
      setSelectedRole("member")
      addNotification({
        type: "success",
        message: "Member added to team",
        duration: 5000,
      })
    },
    onError: (error: Error) => {
      addNotification({
        type: "error",
        message: error.message,
        duration: 5000,
      })
    },
  })

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: TeamRole }) => {
      const result = await api.patch(
        `/api/v1/teams/${teamId}/members/${memberId}`,
        { role },
        { showToast: false }
      )
      if (!result.success) {
        throw new Error(result.error || "Failed to update role")
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", teamId] })
      addNotification({
        type: "success",
        message: "Member role updated",
        duration: 5000,
      })
    },
    onError: (error: Error) => {
      addNotification({
        type: "error",
        message: error.message,
        duration: 5000,
      })
    },
  })

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const result = await api.delete(`/api/v1/teams/${teamId}/members/${memberId}`, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || "Failed to remove member")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", teamId] })
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      addNotification({
        type: "success",
        message: "Member removed from team",
        duration: 5000,
      })
    },
    onError: (error: Error) => {
      addNotification({
        type: "error",
        message: error.message,
        duration: 5000,
      })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              {members.length} member{members.length !== 1 ? "s" : ""} in this team
            </CardDescription>
          </div>
          {isAdmin && (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Member</DialogTitle>
                  <DialogDescription>
                    Add a company member to this team
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Search Members</Label>
                    <Input
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Select Member</Label>
                    <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a member" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMembers.length === 0 ? (
                          <div className="p-2 text-center text-muted-foreground text-sm">
                            No available members
                          </div>
                        ) : (
                          availableMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={member.avatar} />
                                  <AvatarFallback>
                                    {(member.name || member.email).charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{member.name || member.email}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as TeamRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Admins can manage team members and book on behalf of others
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => addMemberMutation.mutate({ memberId: selectedMemberId, role: selectedRole })}
                    disabled={addMemberMutation.isPending || !selectedMemberId}
                  >
                    {addMemberMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Add Member
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              {isAdmin && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 4 : 3} className="text-center text-muted-foreground">
                  No members in this team
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={member.memberId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar} />
                        <AvatarFallback>
                          {(member.name || member.email || "U").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.name || "Unnamed"}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                      {member.role === "admin" ? (
                        <Crown className="h-3 w-3 mr-1" />
                      ) : (
                        <User className="h-3 w-3 mr-1" />
                      )}
                      {member.role === "admin" ? "Admin" : "Member"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(member.joinedAt).toLocaleDateString()}
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
                          {member.role === "member" ? (
                            <DropdownMenuItem
                              onClick={() => updateRoleMutation.mutate({ memberId: member.memberId, role: "admin" })}
                            >
                              <ShieldCheck className="h-4 w-4 mr-2" />
                              Make Admin
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => updateRoleMutation.mutate({ memberId: member.memberId, role: "member" })}
                              disabled={member.memberId === user?.id}
                            >
                              <User className="h-4 w-4 mr-2" />
                              Make Member
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Are you sure you want to remove this member from the team?")) {
                                removeMemberMutation.mutate(member.memberId)
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove from Team
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
