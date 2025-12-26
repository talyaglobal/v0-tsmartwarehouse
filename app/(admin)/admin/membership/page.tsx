"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Save, Loader2, AlertCircle, CheckCircle } from "@/components/icons"
import { formatCurrency } from "@/lib/utils/format"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"
import { useRouter } from "next/navigation"

interface MembershipSetting {
  id: string
  programEnabled: boolean
  tierName: string
  minSpend: number
  discountPercent: number
  benefits: string[]
  createdAt: string
  updatedAt: string
  status: boolean
}

interface MembershipProgramStatus {
  programEnabled: boolean
  tiers: MembershipSetting[]
}

export default function MembershipAdminPage() {
  const { user } = useUser()
  const router = useRouter()
  const queryClient = useQueryClient()

  // Check if user is root (client-side check)
  useEffect(() => {
    if (user && user.role !== 'root') {
      router.push('/dashboard')
    }
  }, [user, router])

  // Fetch membership settings
  const { data: programStatus, isLoading, error } = useQuery<MembershipProgramStatus>({
    queryKey: ['admin', 'membership', 'settings'],
    queryFn: async () => {
      const result = await api.get<MembershipProgramStatus>(
        '/api/v1/admin/membership/settings',
        { showToast: false }
      )
      if (!result.success || !result.data) {
        throw new Error('Failed to load membership settings')
      }
      return result.data
    },
  })

  // Update program enabled status
  const updateProgramStatus = useMutation({
    mutationFn: async (enabled: boolean) => {
      const result = await api.put(
        '/api/v1/admin/membership/settings/program',
        { enabled },
        { successMessage: `Membership program ${enabled ? 'enabled' : 'disabled'} successfully` }
      )
      if (!result.success) {
        throw new Error('Failed to update program status')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'membership', 'settings'] })
      queryClient.invalidateQueries({ queryKey: ['membership'] }) // Also invalidate user membership cache
    },
  })

  // Update tier settings
  const updateTierSettings = useMutation({
    mutationFn: async ({ tierName, updates }: { tierName: string; updates: any }) => {
      const result = await api.put(
        `/api/v1/admin/membership/settings/tier/${tierName}`,
        updates,
        { successMessage: `${tierName} tier settings updated successfully` }
      )
      if (!result.success) {
        throw new Error('Failed to update tier settings')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'membership', 'settings'] })
      queryClient.invalidateQueries({ queryKey: ['membership'] }) // Also invalidate user membership cache
    },
  })

  // Local state for editing tier settings
  const [editingTiers, setEditingTiers] = useState<Record<string, Partial<MembershipSetting>>>({})

  const handleEditTier = (tier: MembershipSetting) => {
    setEditingTiers(prev => ({
      ...prev,
      [tier.tierName]: {
        minSpend: tier.minSpend,
        discountPercent: tier.discountPercent,
        benefits: [...tier.benefits],
      },
    }))
  }

  const handleCancelEdit = (tierName: string) => {
    setEditingTiers(prev => {
      const newState = { ...prev }
      delete newState[tierName]
      return newState
    })
  }

  const handleSaveTier = async (tier: MembershipSetting) => {
    const edits = editingTiers[tier.tierName]
    if (!edits) return

    const updates: any = {}
    if (edits.minSpend !== undefined && edits.minSpend !== tier.minSpend) {
      updates.minSpend = edits.minSpend
    }
    if (edits.discountPercent !== undefined && edits.discountPercent !== tier.discountPercent) {
      updates.discountPercent = edits.discountPercent
    }
    if (edits.benefits && JSON.stringify(edits.benefits) !== JSON.stringify(tier.benefits)) {
      updates.benefits = edits.benefits
    }

    if (Object.keys(updates).length > 0) {
      await updateTierSettings.mutateAsync({ tierName: tier.tierName, updates })
      handleCancelEdit(tier.tierName)
    }
  }

  const handleBenefitsChange = (tierName: string, index: number, value: string) => {
    setEditingTiers(prev => {
      const current = prev[tierName] || { benefits: [] }
      const benefits = [...(current.benefits || [])]
      benefits[index] = value
      return {
        ...prev,
        [tierName]: { ...current, benefits },
      }
    })
  }

  const handleAddBenefit = (tierName: string) => {
    setEditingTiers(prev => {
      const current = prev[tierName] || { benefits: [] }
      const benefits = [...(current.benefits || []), '']
      return {
        ...prev,
        [tierName]: { ...current, benefits },
      }
    })
  }

  const handleRemoveBenefit = (tierName: string, index: number) => {
    setEditingTiers(prev => {
      const current = prev[tierName] || { benefits: [] }
      const benefits = (current.benefits || []).filter((_, i) => i !== index)
      return {
        ...prev,
        [tierName]: { ...current, benefits },
      }
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !programStatus) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-muted-foreground">Failed to load membership settings</p>
        </div>
      </div>
    )
  }

  const { programEnabled, tiers } = programStatus

  return (
    <div className="space-y-6">
      <PageHeader title="Membership Program Settings" description="Manage membership program and tier configurations" />

      {/* Program Status */}
      <Card>
        <CardHeader>
          <CardTitle>Program Status</CardTitle>
          <CardDescription>Enable or disable the membership program system-wide</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Membership Program</p>
              <p className="text-sm text-muted-foreground">
                {programEnabled ? 'Program is currently enabled' : 'Program is currently disabled'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {programEnabled ? (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="outline">Disabled</Badge>
              )}
              <Switch
                checked={programEnabled}
                onCheckedChange={(enabled) => updateProgramStatus.mutate(enabled)}
                disabled={updateProgramStatus.isPending}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier Settings */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Tier Settings</h2>
          <p className="text-muted-foreground">Configure minimum spend thresholds, discounts, and benefits for each tier</p>
        </div>

        {tiers.map((tier) => {
          const isEditing = editingTiers[tier.tierName] !== undefined
          const edits = editingTiers[tier.tierName] || tier

          return (
            <Card key={tier.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="capitalize">{tier.tierName} Tier</CardTitle>
                    <CardDescription>Configure settings for the {tier.tierName} membership tier</CardDescription>
                  </div>
                  {!isEditing && (
                    <Button variant="outline" onClick={() => handleEditTier(tier)}>
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Minimum Spend */}
                <div className="space-y-2">
                  <Label htmlFor={`minSpend-${tier.tierName}`}>Minimum Spend (USD)</Label>
                  {isEditing ? (
                    <Input
                      id={`minSpend-${tier.tierName}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={edits.minSpend ?? tier.minSpend}
                      onChange={(e) =>
                        setEditingTiers(prev => ({
                          ...prev,
                          [tier.tierName]: { ...edits, minSpend: parseFloat(e.target.value) || 0 },
                        }))
                      }
                    />
                  ) : (
                    <p className="text-sm font-medium">{formatCurrency(tier.minSpend)}</p>
                  )}
                </div>

                {/* Discount Percent */}
                <div className="space-y-2">
                  <Label htmlFor={`discount-${tier.tierName}`}>Discount Percent (%)</Label>
                  {isEditing ? (
                    <Input
                      id={`discount-${tier.tierName}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={edits.discountPercent ?? tier.discountPercent}
                      onChange={(e) =>
                        setEditingTiers(prev => ({
                          ...prev,
                          [tier.tierName]: { ...edits, discountPercent: parseFloat(e.target.value) || 0 },
                        }))
                      }
                    />
                  ) : (
                    <p className="text-sm font-medium">{tier.discountPercent}%</p>
                  )}
                </div>

                {/* Benefits */}
                <div className="space-y-2">
                  <Label>Benefits</Label>
                  {isEditing ? (
                    <div className="space-y-2">
                      {(edits.benefits || tier.benefits).map((benefit, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={benefit}
                            onChange={(e) => handleBenefitsChange(tier.tierName, index, e.target.value)}
                            placeholder="Enter benefit"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveBenefit(tier.tierName, index)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddBenefit(tier.tierName)}
                      >
                        Add Benefit
                      </Button>
                    </div>
                  ) : (
                    <ul className="list-disc list-inside space-y-1">
                      {tier.benefits.map((benefit, index) => (
                        <li key={index} className="text-sm text-muted-foreground">
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Edit Actions */}
                {isEditing && (
                  <>
                    <Separator />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleSaveTier(tier)}
                        disabled={updateTierSettings.isPending}
                      >
                        {updateTierSettings.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleCancelEdit(tier.tierName)}
                        disabled={updateTierSettings.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

