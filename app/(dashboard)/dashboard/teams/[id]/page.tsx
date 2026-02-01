"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Edit, Trash2, Users } from "@/components/icons"
import { TeamMembers } from "@/features/teams/components/team-members"
import { api } from "@/lib/api/client"
import { useUIStore } from "@/stores/ui.store"
import { useUser } from "@/lib/hooks/use-user"
import type { ClientTeam } from "@/types"

export default function TeamDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const { user } = useUser()
  const teamId = params.id as string

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: "", description: "" })

  // Fetch team details
  const { data: team, isLoading } = useQuery<ClientTeam>({
    queryKey: ["team", teamId],
    queryFn: async () => {
      const result = await api.get<ClientTeam>(`/api/v1/teams/${teamId}`, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch team")
      }
      return result.data!
    },
  })

  // Check if current user is an admin
  const isAdmin = team?.members?.some(
    (m) => m.memberId === user?.id && m.role === "admin"
  )

  // Update team mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { name?: string; description?: string }) => {
      const result = await api.patch(`/api/v1/teams/${teamId}`, data, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || "Failed to update team")
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team", teamId] })
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      setEditDialogOpen(false)
      addNotification({
        type: "success",
        message: "Team updated successfully",
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

  // Delete team mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const result = await api.delete(`/api/v1/teams/${teamId}`, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || "Failed to delete team")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      router.push("/dashboard/teams")
      addNotification({
        type: "success",
        message: "Team deleted successfully",
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Team not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={team.name}
        description={team.description || "Team details and members"}
        backButton={true}
        actions={
          isAdmin ? (
            <div className="flex gap-2">
              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => setEditForm({ name: team.name, description: team.description || "" })}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Team</DialogTitle>
                    <DialogDescription>
                      Update team name and description
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Team Name</Label>
                      <Input
                        id="edit-name"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-description">Description</Label>
                      <Textarea
                        id="edit-description"
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => updateMutation.mutate(editForm)}
                      disabled={updateMutation.isPending || !editForm.name.trim()}
                    >
                      {updateMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Save Changes
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Team</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete this team? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Delete Team
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : null
        }
      />

      {/* Team Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Team Name</p>
            <p className="font-medium">{team.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Members</p>
            <p className="font-medium">{team.memberCount || team.members?.length || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Created</p>
            <p className="font-medium">
              {new Date(team.createdAt).toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <TeamMembers teamId={teamId} isAdmin={isAdmin} />
    </div>
  )
}
