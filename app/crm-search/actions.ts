"use server"

import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server"
import { extractCompanyName } from "@/lib/crm-search/extractor"

export async function createSearchJob(input: {
  segments: string[]
  geography: { portHubs: string[]; states: string[]; cities: string[] }
  intent: "buyers" | "suppliers" | "both"
  exclusions: { domains: string[]; keywords: string[] }
  resultsPerQuery: number
}) {
  const supabase = await createAuthenticatedSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: "Unauthorized" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return { success: false, error: "Company not found" }
  }

  const { data, error } = await supabase
    .from("crm_search_jobs")
    .insert({
      company_id: profile.company_id,
      created_by: user.id,
      status: "queued",
      segments: input.segments,
      geo_json: input.geography,
      exclusions_json: input.exclusions,
      serpapi_params_json: {
        num: input.resultsPerQuery,
        intent: input.intent,
      },
    })
    .select()
    .single()

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to create job" }
  }

  return { success: true, jobId: data.id }
}

export async function updateResultStatus(input: {
  resultId: string
  status: "approved" | "rejected" | "reviewed"
}) {
  const supabase = await createAuthenticatedSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: "Unauthorized" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return { success: false, error: "Company not found" }
  }

  const { data: result } = await supabase
    .from("crm_search_results")
    .select("*")
    .eq("id", input.resultId)
    .eq("company_id", profile.company_id)
    .single()

  if (!result) {
    return { success: false, error: "Result not found" }
  }

  let createdLeadId: string | null = null
  if (input.status === "approved" && !result.created_lead_id) {
    const leadName = extractCompanyName(result.title)
    const { data: lead, error: leadError } = await supabase
      .from("crm_leads")
      .insert({
        company_id: profile.company_id,
        name: leadName,
        company_name: leadName,
        domain: result.domain,
        segments: result.classification_segment ? [result.classification_segment] : [],
        score: result.score || 0,
        score_breakdown_json: result.score_breakdown_json || {},
        source_job_id: result.job_id,
      })
      .select()
      .single()

    if (leadError || !lead) {
      return { success: false, error: leadError?.message || "Failed to create lead" }
    }
    createdLeadId = lead.id

    await supabase.from("crm_source_log").insert({
      company_id: profile.company_id,
      entity_type: "crm_leads",
      entity_id: lead.id,
      source_url: result.url,
      source_query: result.cache_hash || undefined,
      source_title: result.title,
      source_snippet: result.snippet,
      serpapi_search_id: result.cache_hash || undefined,
    })
  }

  const { error } = await supabase
    .from("crm_search_results")
    .update({
      status: input.status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      created_lead_id: createdLeadId || result.created_lead_id,
    })
    .eq("id", input.resultId)
    .eq("company_id", profile.company_id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
