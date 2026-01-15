import { NextResponse } from "next/server"
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server"
import { searchSerpAPI, normalizeDomain, generateDedupeKey } from "@/lib/crm-search/serpapi"
import { classifyResult, type Segment } from "@/lib/crm-search/classifier"
import { extractCompanyName, extractContactInfo } from "@/lib/crm-search/extractor"
import { scoreResult } from "@/lib/crm-search/scorer"
import { PORT_HUBS, generateQueries } from "@/lib/crm-search/query-templates"

type GeoConfig = {
  portHubs?: string[]
  states?: string[]
  cities?: string[]
}

const chunk = <T,>(items: T[], size: number) => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  const supabase = await createAuthenticatedSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ success: false, error: "Company not found" }, { status: 403 })
  }

  const { data: job } = await supabase
    .from("crm_search_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("company_id", profile.company_id)
    .single()

  if (!job) {
    return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 })
  }

  const segments = (job.segments || []) as Segment[]
  const geoConfig = (job.geo_json || {}) as GeoConfig
  const portHubs = geoConfig.portHubs || []
  const states = geoConfig.states || []
  const cities = geoConfig.cities || []
  const serpapiParams = (job.serpapi_params_json || {}) as { num?: number }
  const resultsPerQuery = serpapiParams.num || 20
  const exclusions = (job.exclusions_json || { domains: [], keywords: [] }) as {
    domains: string[]
    keywords: string[]
  }

  const locations: { cities: string[]; states: string[] }[] = []
  portHubs.forEach((hub) => {
    const config = PORT_HUBS[hub]
    if (config) locations.push({ cities: config.cities, states: config.states })
  })
  if (cities.length > 0 && states.length > 0) {
    locations.push({ cities, states })
  }
  if (locations.length === 0) {
    locations.push({ cities: ["United States"], states: ["US"] })
  }

  await supabase
    .from("crm_search_jobs")
    .update({ status: "running", started_at: new Date().toISOString(), error: null })
    .eq("id", jobId)

  let totalQueries = 0
  let totalResults = 0
  let apiCreditsUsed = 0

  try {
    for (const location of locations) {
      const queries = generateQueries(segments, location)
      for (const queryConfig of queries) {
        totalQueries += 1
        const { data, cacheHash, fromCache, searchId } = await searchSerpAPI({
          q: queryConfig.query,
          location: queryConfig.location,
          num: resultsPerQuery,
          gl: "us",
          hl: "en",
        })

        if (!fromCache) apiCreditsUsed += 1

        const { data: queryRow } = await supabase
          .from("crm_search_queries")
          .insert({
            job_id: jobId,
            company_id: profile.company_id,
            query_text: queryConfig.query,
            serpapi_location: queryConfig.location,
            serpapi_params_json: serpapiParams,
            serpapi_search_id: searchId,
            executed_at: new Date().toISOString(),
            results_count: data.organic_results?.length || 0,
            from_cache: fromCache,
            error: null,
          })
          .select()
          .single()

        const organicResults = data.organic_results || []
        const rawResults = organicResults.map((result) => ({
          title: result.title,
          snippet: result.snippet || "",
          url: result.link,
          displayed_link: result.displayed_link || "",
          position: result.position,
          result_date: result.date || null,
        }))

        const filteredResults = rawResults.filter((result) => {
          const domain = normalizeDomain(result.url)
          if (exclusions.domains?.some((item) => domain.includes(item.toLowerCase()))) {
            return false
          }
          if (exclusions.keywords?.some((item) => result.title.toLowerCase().includes(item.toLowerCase()))) {
            return false
          }
          return true
        })

        const dedupeKeys = filteredResults.map((result) =>
          generateDedupeKey(normalizeDomain(result.url), extractCompanyName(result.title))
        )

        const { data: existingResults } = await supabase
          .from("crm_search_results")
          .select("dedupe_key")
          .eq("company_id", profile.company_id)
          .in("dedupe_key", dedupeKeys)

        const existingKeys = new Set((existingResults || []).map((row) => row.dedupe_key))
        const uniqueResults = filteredResults.filter((_, index) => !existingKeys.has(dedupeKeys[index]))

        if (uniqueResults.length === 0 || !queryRow) {
          continue
        }

        const resultRows = uniqueResults.map((result) => {
          const companyName = extractCompanyName(result.title)
          const domain = normalizeDomain(result.url)
          const { segment, confidence } = classifyResult(
            result.title,
            result.snippet,
            segments
          )
          const contactInfo = extractContactInfo(`${result.title} ${result.snippet}`)
          const scoring = scoreResult({
            title: result.title,
            snippet: result.snippet,
            domain,
            segment,
            confidence,
            emails: contactInfo.emails,
            phones: contactInfo.phones,
            address: null,
          })

          return {
            job_id: jobId,
            query_id: queryRow.id,
            company_id: profile.company_id,
            title: result.title,
            snippet: result.snippet,
            url: result.url,
            displayed_link: result.displayed_link,
            domain,
            position: result.position,
            result_date: result.result_date,
            cache_hash: cacheHash,
            classification_segment: segment,
            classification_confidence: confidence,
            extracted_emails: contactInfo.emails,
            extracted_phones: contactInfo.phones,
            extracted_address_text: null,
            contact_confidence: contactInfo.confidence,
            score: scoring.score,
            score_breakdown_json: scoring.breakdown,
            dedupe_key: generateDedupeKey(domain, companyName),
          }
        })

        for (const batch of chunk(resultRows, 50)) {
          const { error } = await supabase.from("crm_search_results").insert(batch)
          if (error) {
            console.error("[crm-search] Failed to insert results:", error)
          }
        }

        totalResults += resultRows.length
      }
    }

    await supabase
      .from("crm_search_jobs")
      .update({
        status: "done",
        finished_at: new Date().toISOString(),
        total_queries: totalQueries,
        total_results: totalResults,
        api_credits_used: apiCreditsUsed,
      })
      .eq("id", jobId)

    return NextResponse.json({ success: true, totalQueries, totalResults })
  } catch (error) {
    await supabase
      .from("crm_search_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", jobId)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
