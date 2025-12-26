"use client"

import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Crown, Star, Gift, TrendingUp, CheckCircle, CreditCard, DollarSign, Loader2, AlertCircle } from "@/components/icons"
import { formatCurrency } from "@/lib/utils/format"
import { PRICING } from "@/lib/constants"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"
import { format } from "date-fns"

interface MembershipData {
  tier: string
  tierName: string
  totalSpend: number
  creditBalance: number
  memberSince: string
  programEnabled: boolean
  benefits: string[]
  discount: number
  minSpend: number
  nextTier?: {
    tier: string
    name: string
    minSpend: number
    spendNeeded: number
  }
}

interface MembershipTier {
  name: string
  minSpend: number
  discount: number
  color: string
  benefits: string[]
}

const getTierColor = (tierName: string): string => {
  switch (tierName.toLowerCase()) {
    case "bronze":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "silver":
      return "bg-gray-100 text-gray-800 border-gray-200"
    case "gold":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "platinum":
      return "bg-purple-100 text-purple-800 border-purple-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

const membershipTiers: MembershipTier[] = [
  {
    name: "Bronze",
    minSpend: 0,
    discount: 0,
    color: "bg-orange-100 text-orange-800 border-orange-200",
    benefits: ["Standard pricing", "Email support", "Basic reporting"],
  },
  {
    name: "Silver",
    minSpend: 10000,
    discount: 5,
    color: "bg-gray-100 text-gray-800 border-gray-200",
    benefits: ["5% discount on storage", "Priority support", "Monthly reports"],
  },
  {
    name: "Gold",
    minSpend: 50000,
    discount: 10,
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    benefits: [
      "10% discount on all services",
      "Dedicated account manager",
      "Weekly reports",
      "Free value-added services",
    ],
  },
  {
    name: "Platinum",
    minSpend: 100000,
    discount: 15,
    color: "bg-purple-100 text-purple-800 border-purple-200",
    benefits: [
      "15% discount on all services",
      "24/7 priority support",
      "Real-time analytics",
      "Custom solutions",
      "Annual review meetings",
    ],
  },
]

export default function MembershipPage() {
  const { user } = useUser()

  // Fetch membership data from API
  const { data: membershipData, isLoading, error } = useQuery<MembershipData>({
    queryKey: ['membership', user?.id],
    queryFn: async () => {
      const result = await api.get<MembershipData>(
        '/api/v1/membership',
        { showToast: false }
      )
      if (!result.success || !result.data) {
        throw new Error('Failed to load membership data')
      }
      return result.data
    },
    enabled: !!user?.id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !membershipData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-muted-foreground">Failed to load membership data</p>
        </div>
      </div>
    )
  }

  const { tierName, totalSpend, creditBalance, memberSince, programEnabled, benefits, discount, minSpend, nextTier } = membershipData

  // Calculate progress to next tier
  const currentTierMinSpend = minSpend || 0
  const progressToNext = nextTier 
    ? Math.min(100, Math.max(0, ((totalSpend - currentTierMinSpend) / (nextTier.minSpend - currentTierMinSpend)) * 100))
    : 100

  const currentTierColor = getTierColor(tierName)

  // Update tier list with current tier data from API
  const updatedTiers = membershipTiers.map(tierItem => {
    if (tierItem.name.toLowerCase() === tierName.toLowerCase()) {
      return {
        ...tierItem,
        benefits: benefits.length > 0 ? benefits : tierItem.benefits,
        discount: discount,
      }
    }
    return tierItem
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Membership" description="Your loyalty rewards and benefits" />

      {/* Program Status Warning */}
      {!programEnabled && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-semibold text-orange-900 dark:text-orange-100">Membership Program Currently Disabled</p>
                <p className="text-sm text-orange-700 dark:text-orange-200">Membership benefits and discounts are not currently active. Please contact support for more information.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Status Card */}
      <Card className={`border-2 ${currentTierColor}`}>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`flex h-16 w-16 items-center justify-center rounded-full ${currentTierColor}`}>
                <Crown className="h-8 w-8" />
              </div>
              <div>
                <Badge className={`mb-1 ${currentTierColor}`}>{tierName} Member</Badge>
                <h2 className="text-2xl font-bold">{user?.user_metadata?.name || user?.email || 'Member'}</h2>
                <p className="text-muted-foreground">
                  Member since {memberSince ? format(new Date(memberSince), 'MMMM yyyy') : 'N/A'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Spend</p>
                <p className="text-2xl font-bold">{formatCurrency(totalSpend)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Credit Balance</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(creditBalance)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress to Next Tier */}
      {nextTier && programEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Progress to {nextTier.name}
            </CardTitle>
            <CardDescription>
              Spend {formatCurrency(nextTier.spendNeeded)} more to unlock {nextTier.minSpend >= 100000 ? 15 : nextTier.minSpend >= 50000 ? 10 : 5}% discounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{tierName} ({formatCurrency(currentTierMinSpend)})</span>
                <span>{formatCurrency(totalSpend)}</span>
                <span>{nextTier.name} ({formatCurrency(nextTier.minSpend)})</span>
              </div>
              <Progress value={progressToNext} className="h-3" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Benefits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Your {tierName} Benefits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {benefits && benefits.length > 0 ? (
              benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>{benefit}</span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No benefits available</p>
            )}
          </div>
          {programEnabled && discount > 0 && (
            <>
              <Separator className="my-6" />
              <div className="rounded-lg bg-primary/5 p-4">
                <h4 className="font-medium mb-2">Your Discount Applied ({discount}%)</h4>
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between">
                    <span>Pallet In</span>
                    <span>
                      <s className="text-muted-foreground">${PRICING.palletIn.toFixed(2)}</s> → $
                      {(PRICING.palletIn * (1 - discount / 100)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Storage (per pallet/month)</span>
                    <span>
                      <s className="text-muted-foreground">${PRICING.storagePerPalletPerMonth.toFixed(2)}</s> → $
                      {(PRICING.storagePerPalletPerMonth * (1 - discount / 100)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pallet Out</span>
                    <span>
                      <s className="text-muted-foreground">${PRICING.palletOut.toFixed(2)}</s> → $
                      {(PRICING.palletOut * (1 - discount / 100)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* All Tiers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Membership Tiers
          </CardTitle>
          <CardDescription>Unlock better discounts as you grow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {updatedTiers.map((tierItem) => {
              const isCurrent = tierItem.name.toLowerCase() === tierName.toLowerCase()
              return (
                <div
                  key={tierItem.name}
                  className={`rounded-lg border p-4 ${isCurrent ? "border-2 border-primary bg-primary/5" : ""}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Badge className={tierItem.color}>{tierItem.name}</Badge>
                    {isCurrent && <span className="text-xs text-primary font-medium">Current</span>}
                  </div>
                  <p className="text-2xl font-bold mb-1">{tierItem.discount > 0 ? `${tierItem.discount}% off` : "Standard"}</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    {tierItem.minSpend > 0 ? `${formatCurrency(tierItem.minSpend)}+ total spend` : "All customers"}
                  </p>
                  <ul className="space-y-1">
                    {tierItem.benefits.slice(0, 3).map((benefit, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Credit Balance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Credit Balance
          </CardTitle>
          <CardDescription>Use credits towards your next booking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(creditBalance)}</p>
              <p className="text-sm text-muted-foreground">Available credit</p>
            </div>
            <Button>
              <DollarSign className="mr-2 h-4 w-4" />
              Apply to Booking
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
