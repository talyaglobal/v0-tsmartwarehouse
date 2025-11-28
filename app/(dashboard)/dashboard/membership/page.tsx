import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Building2, CreditCard, Calendar, TrendingUp } from "@/components/icons"

export const metadata = {
  title: "Membership | T Smart Warehouse",
}

export default async function MembershipPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, companies(*, memberships(*))")
    .eq("id", user?.id)
    .single()

  const company = profile?.companies
  const membership = company?.memberships?.[0]

  const creditUsedPercent = membership ? (membership.credit_used / membership.credit_limit) * 100 : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Membership</h1>
        <p className="text-muted-foreground">Manage your company membership and credit</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Company Name</p>
              <p className="font-medium">{company?.name || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Address</p>
              <p className="font-medium">
                {company?.address ? (
                  <>
                    {company.address}
                    <br />
                    {company.city}, {company.state} {company.zip_code}
                  </>
                ) : (
                  "Not set"
                )}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{company?.phone || "Not set"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{company?.email || "Not set"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Membership Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Membership Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {membership ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={membership.status === "ACTIVE" ? "default" : "secondary"}>{membership.status}</Badge>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Credit Usage</span>
                    <span className="text-sm font-medium">
                      ${membership.credit_used?.toFixed(2)} / ${membership.credit_limit?.toFixed(2)}
                    </span>
                  </div>
                  <Progress value={creditUsedPercent} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    ${(membership.credit_limit - membership.credit_used).toFixed(2)} available
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Payment Terms</p>
                      <p className="text-sm font-medium">Net {membership.payment_terms_days}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Discount</p>
                      <p className="text-sm font-medium">{membership.discount_percentage}%</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  No membership active. Contact sales to set up a membership account.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
