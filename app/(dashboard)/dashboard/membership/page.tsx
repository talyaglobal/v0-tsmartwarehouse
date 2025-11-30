"use client"

import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Crown, Star, Gift, TrendingUp, CheckCircle, CreditCard, DollarSign } from "@/components/icons"
import { formatCurrency } from "@/lib/utils/format"
import { PRICING } from "@/lib/constants"

const membershipTiers = [
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
  // Mock current user data
  const currentTier = "gold"
  const currentSpend = 62500
  const creditBalance = 2500
  const nextTier = membershipTiers.find((t) => t.minSpend > currentSpend)
  const progressToNext = nextTier ? ((currentSpend - 50000) / (nextTier.minSpend - 50000)) * 100 : 100

  const currentTierData = membershipTiers.find((t) => t.name.toLowerCase() === currentTier)

  return (
    <div className="space-y-6">
      <PageHeader title="Membership" description="Your loyalty rewards and benefits" />

      {/* Current Status Card */}
      <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-white">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
                <Crown className="h-8 w-8 text-yellow-600" />
              </div>
              <div>
                <Badge className="mb-1 bg-yellow-100 text-yellow-800 border-yellow-200">Gold Member</Badge>
                <h2 className="text-2xl font-bold">Sarah Johnson</h2>
                <p className="text-muted-foreground">Member since January 2024</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Spend</p>
                <p className="text-2xl font-bold">{formatCurrency(currentSpend)}</p>
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
      {nextTier && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Progress to {nextTier.name}
            </CardTitle>
            <CardDescription>
              Spend {formatCurrency(nextTier.minSpend - currentSpend)} more to unlock {nextTier.discount}% discounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Gold ({formatCurrency(50000)})</span>
                <span>{formatCurrency(currentSpend)}</span>
                <span>Platinum ({formatCurrency(100000)})</span>
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
            Your Gold Benefits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {currentTierData?.benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
          <Separator className="my-6" />
          <div className="rounded-lg bg-primary/5 p-4">
            <h4 className="font-medium mb-2">Your Discount Applied</h4>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <span>Pallet In</span>
                <span>
                  <s className="text-muted-foreground">${PRICING.palletIn.toFixed(2)}</s> → $
                  {(PRICING.palletIn * 0.9).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Storage (per pallet/month)</span>
                <span>
                  <s className="text-muted-foreground">${PRICING.storagePerPalletPerMonth.toFixed(2)}</s> → $
                  {(PRICING.storagePerPalletPerMonth * 0.9).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Pallet Out</span>
                <span>
                  <s className="text-muted-foreground">${PRICING.palletOut.toFixed(2)}</s> → $
                  {(PRICING.palletOut * 0.9).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
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
            {membershipTiers.map((tier) => {
              const isCurrent = tier.name.toLowerCase() === currentTier
              return (
                <div
                  key={tier.name}
                  className={`rounded-lg border p-4 ${isCurrent ? "border-2 border-primary bg-primary/5" : ""}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Badge className={tier.color}>{tier.name}</Badge>
                    {isCurrent && <span className="text-xs text-primary font-medium">Current</span>}
                  </div>
                  <p className="text-2xl font-bold mb-1">{tier.discount > 0 ? `${tier.discount}% off` : "Standard"}</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    {tier.minSpend > 0 ? `${formatCurrency(tier.minSpend)}+ annual spend` : "All customers"}
                  </p>
                  <ul className="space-y-1">
                    {tier.benefits.slice(0, 3).map((benefit, i) => (
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
