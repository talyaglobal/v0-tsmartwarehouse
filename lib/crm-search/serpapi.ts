import { z } from "zod"
import crypto from "crypto"

export const SerpAPIOrganicResultSchema = z.object({
  position: z.number(),
  title: z.string(),
  link: z.string(),
  displayed_link: z.string().optional(),
  snippet: z.string().optional(),
  snippet_highlighted_words: z.array(z.string()).optional(),
  date: z.string().optional(),
  source: z.string().optional(),
})

export const SerpAPILocalResultSchema = z.object({
  position: z.number().optional(),
  title: z.string(),
  place_id: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  rating: z.number().optional(),
  reviews: z.number().optional(),
  type: z.string().optional(),
})

export const SerpAPIResponseSchema = z.object({
  search_metadata: z.object({
    id: z.string(),
    status: z.string(),
    created_at: z.string(),
    processed_at: z.string().optional(),
    google_url: z.string().optional(),
  }),
  search_parameters: z.object({
    q: z.string(),
    location: z.string().optional(),
    gl: z.string().optional(),
    hl: z.string().optional(),
  }),
  organic_results: z.array(SerpAPIOrganicResultSchema).optional().default([]),
  local_results: z
    .object({
      places: z.array(SerpAPILocalResultSchema).optional(),
    })
    .optional(),
  related_searches: z
    .array(
      z.object({
        query: z.string(),
        link: z.string().optional(),
      })
    )
    .optional(),
  error: z.string().optional(),
})

export type SerpAPIOrganicResult = z.infer<typeof SerpAPIOrganicResultSchema>
export type SerpAPILocalResult = z.infer<typeof SerpAPILocalResultSchema>
export type SerpAPIResponse = z.infer<typeof SerpAPIResponseSchema>

export interface SerpAPISearchParams {
  q: string
  location?: string
  gl?: string
  hl?: string
  num?: number
  start?: number
  device?: "desktop" | "mobile" | "tablet"
  no_cache?: boolean
  safe?: "active" | "off"
}

const RATE_LIMIT = {
  maxPerHour: 1000,
  requests: [] as number[],
}

const resultCache = new Map<
  string,
  { data: SerpAPIResponse; timestamp: number; searchId: string }
>()
const CACHE_TTL = 60 * 60 * 1000

function generateCacheHash(params: SerpAPISearchParams): string {
  const normalized = {
    q: params.q.toLowerCase().trim(),
    location: params.location?.toLowerCase(),
    gl: params.gl || "us",
    hl: params.hl || "en",
    num: params.num || 10,
    start: params.start || 0,
  }
  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex")
}

async function checkRateLimit(): Promise<void> {
  const now = Date.now()
  const oneHourAgo = now - 3600000

  RATE_LIMIT.requests = RATE_LIMIT.requests.filter((t) => t > oneHourAgo)

  if (RATE_LIMIT.requests.length >= RATE_LIMIT.maxPerHour) {
    const waitTime = RATE_LIMIT.requests[0] - oneHourAgo + 1000
    await new Promise((resolve) => setTimeout(resolve, waitTime))
    return checkRateLimit()
  }

  RATE_LIMIT.requests.push(now)
}

export async function searchSerpAPI(
  params: SerpAPISearchParams,
  options: { retries?: number; useCache?: boolean } = {}
): Promise<{
  data: SerpAPIResponse
  cacheHash: string
  fromCache: boolean
  searchId: string
}> {
  const { retries = 3, useCache = true } = options
  const cacheHash = generateCacheHash(params)

  if (useCache) {
    const cached = resultCache.get(cacheHash)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return {
        data: cached.data,
        cacheHash,
        fromCache: true,
        searchId: cached.searchId,
      }
    }
  }

  await checkRateLimit()

  const apiKey = process.env.SERPAPI_API_KEY
  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY environment variable is not set")
  }

  const url = new URL("https://serpapi.com/search.json")
  url.searchParams.set("api_key", apiKey)
  url.searchParams.set("engine", "google")
  url.searchParams.set("q", params.q)
  if (params.location) url.searchParams.set("location", params.location)
  if (params.gl) url.searchParams.set("gl", params.gl)
  if (params.hl) url.searchParams.set("hl", params.hl)
  if (params.num) url.searchParams.set("num", String(params.num))
  if (params.start) url.searchParams.set("start", String(params.start))
  if (params.device) url.searchParams.set("device", params.device)
  if (params.no_cache) url.searchParams.set("no_cache", "true")
  if (params.safe) url.searchParams.set("safe", params.safe)

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    })

    if (!response.ok) {
      if (response.status === 429 && retries > 0) {
        const backoff = Math.pow(2, 4 - retries) * 1000
        await new Promise((r) => setTimeout(r, backoff))
        return searchSerpAPI(params, { retries: retries - 1, useCache })
      }
      throw new Error(`SerpAPI error ${response.status}: ${await response.text()}`)
    }

    const rawData = await response.json()
    if (rawData.error) {
      throw new Error(`SerpAPI: ${rawData.error}`)
    }

    const data = SerpAPIResponseSchema.parse(rawData)
    const searchId = data.search_metadata.id

    resultCache.set(cacheHash, { data, timestamp: Date.now(), searchId })

    return { data, cacheHash, fromCache: false, searchId }
  } catch (error) {
    if (retries > 0 && error instanceof Error && !error.message.includes("SerpAPI")) {
      await new Promise((r) => setTimeout(r, 1000))
      return searchSerpAPI(params, { retries: retries - 1, useCache })
    }
    throw error
  }
}

export async function searchSerpAPIPaginated(
  params: SerpAPISearchParams,
  pages = 1
): Promise<SerpAPIOrganicResult[]> {
  const allResults: SerpAPIOrganicResult[] = []
  const num = params.num || 10

  for (let page = 0; page < pages; page += 1) {
    const start = page * num
    const { data } = await searchSerpAPI({ ...params, start })
    if (data.organic_results && data.organic_results.length > 0) {
      allResults.push(...data.organic_results)
    } else {
      break
    }
    if (page < pages - 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  return allResults
}

export function normalizeDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.toLowerCase().replace(/^(www|m|mobile|amp)\./, "")
  } catch {
    return url.toLowerCase()
  }
}

export function generateDedupeKey(domain: string, companyName?: string): string {
  const normalizedDomain = normalizeDomain(domain)
  if (normalizedDomain && normalizedDomain.includes(".")) {
    return `domain:${normalizedDomain}`
  }
  if (companyName) {
    const normalized = companyName
      .toLowerCase()
      .replace(/\b(inc|llc|corp|ltd|co|company|corporation)\b\.?/gi, "")
      .replace(/[^a-z0-9]/g, "")
      .trim()
    return `company:${normalized}`
  }
  return `unknown:${Date.now()}`
}

export const SERPAPI_LOCATIONS: Record<string, string> = {
  NY_NJ: "New York, New York, United States",
  LA_LB: "Los Angeles, California, United States",
  SAVANNAH: "Savannah, Georgia, United States",
  HOUSTON: "Houston, Texas, United States",
  MIAMI: "Miami, Florida, United States",
  CHICAGO: "Chicago, Illinois, United States",
  DALLAS: "Dallas, Texas, United States",
  ATLANTA: "Atlanta, Georgia, United States",
  SEATTLE_TACOMA: "Seattle, Washington, United States",
  CA: "California, United States",
  TX: "Texas, United States",
  FL: "Florida, United States",
  NY: "New York, United States",
  NJ: "New Jersey, United States",
  GA: "Georgia, United States",
  IL: "Illinois, United States",
  WA: "Washington, United States",
}

export function getSerpAPILocation(portHub: string): string {
  return SERPAPI_LOCATIONS[portHub] || "United States"
}

export async function getSerpAPIAccountInfo(): Promise<{
  plan: string
  searches_per_month: number
  this_month_usage: number
  remaining: number
}> {
  const apiKey = process.env.SERPAPI_API_KEY
  if (!apiKey) throw new Error("SERPAPI_API_KEY not set")

  const response = await fetch(`https://serpapi.com/account.json?api_key=${apiKey}`)
  if (!response.ok) throw new Error(`Account info failed: ${response.status}`)

  const data = await response.json()

  return {
    plan: data.plan_name || "Unknown",
    searches_per_month: (data.plan_searches_left || 0) + (data.this_month_usage || 0),
    this_month_usage: data.this_month_usage || 0,
    remaining: data.plan_searches_left || 0,
  }
}
