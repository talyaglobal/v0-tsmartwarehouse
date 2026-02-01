"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Loader2, Users, UserPlus, Bell, BellOff } from "@/components/icons"
import { api } from "@/lib/api/client"
import type { TeamMember } from "@/types"

interface TeamMemberWithTeam extends TeamMember {
  teamId: string
  teamName: string
}

interface BookOnBehalfSelectorProps {
  onSelect: (selection: {
    customerId: string | null
    customerName: string | null
    customerEmail: string | null
    requiresApproval: boolean
    requestMessage?: string
  }) => void
  disabled?: boolean
}

export function BookOnBehalfSelector({ onSelect, disabled }: BookOnBehalfSelectorProps) {
  const [bookOnBehalf, setBookOnBehalf] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [requiresApproval, setRequiresApproval] = useState(true)
  const [requestMessage, setRequestMessage] = useState("")

  // Fetch team members available for booking
  const { data: members = [], isLoading } = useQuery<TeamMemberWithTeam[]>({
    queryKey: ["booking-members"],
    queryFn: async () => {
      const result = await api.get<TeamMemberWithTeam[]>("/api/v1/teams/booking-members", { showToast: false })
      return result.success ? (result.data || []) : []
    },
    enabled: bookOnBehalf,
  })

  // Group members by team
  const membersByTeam = members.reduce((acc, member) => {
    if (!acc[member.teamName]) {
      acc[member.teamName] = []
    }
    acc[member.teamName].push(member)
    return acc
  }, {} as Record<string, TeamMemberWithTeam[]>)

  const selectedMember = members.find((m) => m.memberId === selectedMemberId)

  const handleToggleBookOnBehalf = (enabled: boolean) => {
    setBookOnBehalf(enabled)
    if (!enabled) {
      setSelectedMemberId(null)
      setRequiresApproval(true)
      setRequestMessage("")
      onSelect({
        customerId: null,
        customerName: null,
        customerEmail: null,
        requiresApproval: false,
      })
    }
  }

  const handleMemberSelect = (memberId: string) => {
    const member = members.find((m) => m.memberId === memberId)
    setSelectedMemberId(memberId)
    
    if (member) {
      onSelect({
        customerId: member.memberId,
        customerName: member.name || member.email || null,
        customerEmail: member.email || null,
        requiresApproval,
        requestMessage: requestMessage || undefined,
      })
    }
  }

  const handleApprovalChange = (needsApproval: boolean) => {
    setRequiresApproval(needsApproval)
    
    if (selectedMember) {
      onSelect({
        customerId: selectedMember.memberId,
        customerName: selectedMember.name || selectedMember.email || null,
        customerEmail: selectedMember.email || null,
        requiresApproval: needsApproval,
        requestMessage: requestMessage || undefined,
      })
    }
  }

  const handleMessageChange = (message: string) => {
    setRequestMessage(message)
    
    if (selectedMember) {
      onSelect({
        customerId: selectedMember.memberId,
        customerName: selectedMember.name || selectedMember.email || null,
        customerEmail: selectedMember.email || null,
        requiresApproval,
        requestMessage: message || undefined,
      })
    }
  }

  // Don't show if user has no team members to book for
  if (!isLoading && members.length === 0 && !bookOnBehalf) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Book on Behalf
            </CardTitle>
            <CardDescription>
              Create a booking for a team member
            </CardDescription>
          </div>
          <Switch
            checked={bookOnBehalf}
            onCheckedChange={handleToggleBookOnBehalf}
            disabled={disabled || isLoading}
          />
        </div>
      </CardHeader>

      {bookOnBehalf && (
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No team members available</p>
              <p className="text-xs mt-1">You need to be a team admin to book on behalf of members</p>
            </div>
          ) : (
            <>
              {/* Member Selection */}
              <div className="space-y-2">
                <Label>Select Team Member</Label>
                <Select value={selectedMemberId || ""} onValueChange={handleMemberSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(membersByTeam).map(([teamName, teamMembers]) => (
                      <div key={teamName}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          {teamName}
                        </div>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.memberId} value={member.memberId}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={member.avatar} />
                                <AvatarFallback>
                                  {(member.name || member.email || "U").charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span>{member.name || member.email}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected Member Info */}
              {selectedMember && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedMember.avatar} />
                      <AvatarFallback>
                        {(selectedMember.name || selectedMember.email || "U").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{selectedMember.name || "Unnamed"}</p>
                      <p className="text-sm text-muted-foreground">{selectedMember.email}</p>
                    </div>
                    <Badge variant="outline" className="ml-auto">
                      {selectedMember.teamName}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Approval Options */}
              {selectedMember && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        {requiresApproval ? (
                          <Bell className="h-4 w-4 text-amber-500" />
                        ) : (
                          <BellOff className="h-4 w-4 text-muted-foreground" />
                        )}
                        Require Approval
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {requiresApproval
                          ? "Team member must approve before booking is confirmed"
                          : "Booking will be created immediately without approval"}
                      </p>
                    </div>
                    <Switch
                      checked={requiresApproval}
                      onCheckedChange={handleApprovalChange}
                      disabled={disabled}
                    />
                  </div>

                  {requiresApproval && (
                    <div className="space-y-2">
                      <Label>Message (optional)</Label>
                      <Textarea
                        placeholder="Add a note explaining why you're making this booking..."
                        value={requestMessage}
                        onChange={(e) => handleMessageChange(e.target.value)}
                        rows={2}
                        disabled={disabled}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}
