"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Users, Crown, User, ChevronRight } from "@/components/icons"
import { api } from "@/lib/api/client"
import { useUIStore } from "@/stores/ui.store"
import Link from "next/link"
import type { ClientTeam } from "@/types"

interface TeamListProps {
  companyId?: string
}

export function TeamList({ companyId }: TeamListProps) {
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
  })

  // Fetch teams
  const { data: teams = [], isLoading } = useQuery<ClientTeam[]>({
    queryKey: ["teams", companyId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (companyId) params.set("companyId", companyId)
      else params.set("myTeams", "true")
      
      const result = await api.get<ClientTeam[]>(`/api/v1/teams?${params}`, { showToast: false })
      return result.success ? (result.data || []) : []
    },
  })

  // Create team mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; companyId?: string }) => {
      const result = await api.post("/api/v1/teams", data, { showToast: false })
      if (!result.success) {
        throw new Error(result.error || "Failed to create team")
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      setCreateDialogOpen(false)
      setCreateForm({ name: "", description: "" })
      addNotification({
        type: "success",
        message: "Team created successfully",
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Teams</h2>
          <p className="text-muted-foreground">
            Manage your teams and team members
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>
                Create a team to organize members and manage bookings together
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name *</Label>
                <Input
                  id="team-name"
                  placeholder="e.g., Operations Team"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-description">Description</Label>
                <Textarea
                  id="team-description"
                  placeholder="Optional description of the team's purpose"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  createMutation.mutate({
                    name: createForm.name,
                    description: createForm.description || undefined,
                    companyId,
                  })
                }}
                disabled={createMutation.isPending || !createForm.name.trim()}
              >
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Create Team
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Teams Yet</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              Create a team to organize your company members and manage bookings together
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link key={team.id} href={`/dashboard/teams/${team.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{team.name}</CardTitle>
                      {team.description && (
                        <CardDescription className="line-clamp-2">
                          {team.description}
                        </CardDescription>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{team.memberCount || 0} members</span>
                    </div>
                    {(team as any).userRole === "admin" && (
                      <Badge variant="secondary" className="gap-1">
                        <Crown className="h-3 w-3" />
                        Admin
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
