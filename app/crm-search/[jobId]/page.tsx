import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ResultsTable } from "@/components/crm-search/results-table"
import { JobStatusBadge } from "@/components/crm-search/job-status-badge"
import { JobRunner } from "@/components/crm-search/job-runner"
import Link from "next/link"

export default async function CRMSearchJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
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

  const { data: job } = await supabase
    .from("crm_search_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("company_id", profile.company_id)
    .single()

  if (!job) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>CRM Search</CardTitle>
          </CardHeader>
          <CardContent>Job not found.</CardContent>
        </Card>
      </div>
    )
  }

  const { data: results } = await supabase
    .from("crm_search_results")
    .select("id, title, url, domain, classification_segment, score, status, extracted_emails, extracted_phones")
    .eq("job_id", jobId)
    .order("score", { ascending: false })

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">CRM Search Job</h1>
          <p className="text-sm text-muted-foreground">{job.segments?.join(", ")}</p>
        </div>
        <div className="flex items-center gap-2">
          <JobStatusBadge status={job.status} />
          <JobRunner jobId={jobId} />
          <Button variant="outline" asChild>
            <Link href="/crm-search">Back</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          <ResultsTable results={results || []} />
        </CardContent>
      </Card>
    </div>
  )
}
