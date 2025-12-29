"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { UserPlus, X } from "@/components/icons"
import type { User } from "@/types"

interface ParticipantSelectorProps {
  selectedUserIds: string[]
  onChange: (userIds: string[]) => void
  excludeUserIds?: string[]
}

export function ParticipantSelector({ selectedUserIds, onChange, excludeUserIds = [] }: ParticipantSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Fetch users for search
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return []
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(10)
      
      if (error) throw error
      return (data || []).map((p: any) => ({
        id: p.id,
        name: p.name || p.email,
        email: p.email,
        role: 'member' as const,
      }))
    },
    enabled: searchQuery.length >= 2,
  })

  const filteredUsers = users.filter(u => 
    !selectedUserIds.includes(u.id) && 
    !excludeUserIds.includes(u.id)
  )

  const selectedUsers = useQuery<User[]>({
    queryKey: ['selected-users', selectedUserIds],
    queryFn: async () => {
      if (selectedUserIds.length === 0) return []
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', selectedUserIds)
      
      if (error) throw error
      return (data || []).map((p: any) => ({
        id: p.id,
        name: p.name || p.email,
        email: p.email,
        role: 'member' as const,
      }))
    },
    enabled: selectedUserIds.length > 0,
  })

  const handleAddUser = (userId: string) => {
    if (!selectedUserIds.includes(userId)) {
      onChange([...selectedUserIds, userId])
      setSearchQuery("")
      setShowSuggestions(false)
    }
  }

  const handleRemoveUser = (userId: string) => {
    onChange(selectedUserIds.filter(id => id !== userId))
  }

  return (
    <div className="space-y-2">
      <Label>Participants</Label>
      
      {/* Selected Users */}
      {selectedUsers.data && selectedUsers.data.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedUsers.data.map((user) => (
            <Badge key={user.id} variant="secondary" className="gap-1">
              {user.name}
              <button
                type="button"
                onClick={() => handleRemoveUser(user.id)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => setShowSuggestions(true)}
        />
        
        {/* Suggestions Dropdown */}
        {showSuggestions && filteredUsers.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleAddUser(user.id)}
                className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                <div>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

