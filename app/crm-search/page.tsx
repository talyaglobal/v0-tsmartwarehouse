import Link from "next/link"
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { JobStatusBadge } from "@/components/crm-search/job-status-badge"
import { getSerpAPIAccountInfo } from "@/lib/crm-search/serpapi"

export default async function CRMSearchDashboard() {
  const supabase = await createAuthenticatedSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>CRM Search</CardTitle>
          </CardHeader>
          <CardContent>Please sign in to access CRM Search.</CardContent>
        </Card>
      </div>
    )
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>CRM Search</CardTitle>
          </CardHeader>
          <CardContent>Company not found for this user.</CardContent>
        </Card>
      </div>
    )
  }

  const { data: jobs } = await supabase
    .from("crm_search_jobs")
    .select("id, status, segments, created_at, total_results, created_leads")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false })

  let apiInfo: { remaining: number; plan: string } | null = null
  try {
    const account = await getSerpAPIAccountInfo()
    apiInfo = { remaining: account.remaining, plan: account.plan }
  } catch {
    apiInfo = null
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">CRM Search</h1>
          <p className="text-sm text-muted-foreground">
            Run SerpAPI searches to discover and score leads.
          </p>
        </div>
        <Button asChild>
          <Link href="/crm-search/new">New Search</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Jobs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{jobs?.length || 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">API Credits</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {apiInfo ? apiInfo.remaining : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Plan</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {apiInfo ? apiInfo.plan : "Not configured"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Jobs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(jobs || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No search jobs yet.</p>
          ) : (
            <div className="space-y-2">
              {(jobs || []).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div className="space-y-1">
                    <div className="font-medium">
                      {job.segments?.join(", ") || "Segments"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(job.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground">
                      Results: {job.total_results || 0} / Leads: {job.created_leads || 0}
                    </div>
                    <JobStatusBadge status={job.status} />
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/crm-search/${job.id}`}>View</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
