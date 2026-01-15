# CURSOR PROMPT — CRM Search Module (warebnb.co)

## Project Context

**Target Application:** warebnb.co (formerly tsmartwarehouse.com)  
**Description:** A USA-based warehouse marketplace + logistics ecosystem  
**Module Name:** CRM Search Module  
**Purpose:** Use **SerpAPI** (Google Search API) to find, enrich, score, dedupe, and route leads into the CRM

> ⚠️ **API Used:** [SerpAPI](https://serpapi.com/) - NOT Serper API. These are different services.

---

## 0. Stack & Constraints

### Technology Stack
- **Framework:** Next.js 14+ (App Router, TypeScript, Server Actions)
- **Database:** Supabase (Postgres, Storage, Row Level Security)
- **Authentication:** SupAuth / Supabase Auth
- **Search API:** SerpAPI (`https://serpapi.com/search.json`)
- **UI Components:** shadcn/ui, Tailwind CSS
- **Validation:** Zod schemas

### Architecture Requirements
- **Multi-tenant:** Each customer/company has isolated data via `org_id`
- **RLS Enforced:** All tables must have Row Level Security policies
- **Type-safe:** Full TypeScript coverage with strict mode
- **Server-first:** Prefer Server Components and Server Actions

### Compliance Requirements (USA)
- **CAN-SPAM:** Opt-out tracking, unsubscribe functionality
- **CCPA:** Basic compliance, data source logging
- **Data Minimization:** Store only publicly available data
- **Evidence Trail:** Keep source URLs as proof of data origin
- **No Heavy Scraping:** If contact data can't be confidently extracted, store only source URL with "needs verification" flag

---

## 1. Module Objectives

### Primary Goal
From curated search templates, find and import leads for the following segments:

| # | Segment | Description |
|---|---------|-------------|
| 1 | Warehouse Owners/Landlords | Space for rent |
| 2 | Warehouse Customers/Shippers | Companies needing space (FMCG, ecom, importers) |
| 3 | 3PL Operators | Third-party logistics providers |
| 4 | Customs Brokers | Licensed customs brokerage services |
| 5 | International Freight Forwarders | Ocean/air freight services |
| 6 | Drayage/Local Trucking | Container/intermodal trucking |
| 7 | Warehouse Staffing | Job postings + job seekers |
| 8 | Equipment Vendors | Racks, forklifts, dock equipment, WMS |
| 9 | FMCG Distributors | Last-mile/regional distribution |
| 10 | Warehouse Real Estate Brokers | Industrial property specialists |
| 11 | Bonded Warehouses | CBP bonded facilities, FTZ warehouses |
| 12 | Customs/CBP Facility Directories | Public port directories |

### End-to-End Flow

```
User selects segments + geography + intent keywords
           ↓
System generates SerpAPI queries (templates + localized)
           ↓
Fetch results → Normalize domains → Dedupe
           ↓
Classify segment → Score → Create CRM records
           ↓
Optional: Light enrichment (contact/about pages)
           ↓
Review UI: Approve / Merge / Reject
           ↓
Outreach preparation with compliance fields
           ↓
Store evidence: query, title, snippet, URL, date
```

---

## 2. UX Screens to Build

### 2.1 CRM Search Dashboard (`/app/crm-search/page.tsx`)

**Features:**
- Search Jobs list with columns: Status, Target segments, Geography, Date, Results count, Leads count
- Quick Start buttons for common searches
- Filters: status, date range, segment
- API usage indicator (remaining searches)

### 2.2 Create Search Job (`/app/crm-search/new/page.tsx`)

**Form Fields:**
- Segment selector (multi-select)
- Geography: State / Metro / City / Port Hub presets
- Intent: buyers / suppliers / both
- Exclusions: domains, keywords
- Results per query (max 100)

### 2.3 Results Review (`/app/crm-search/[jobId]/page.tsx`)

**Table:** Company, Segment, Score, Contact signals, Source URL, Actions (Create/Skip/Merge)

### 2.4 Lead Detail & Compliance Center

Standard CRM views with source tracking and suppression management.

---

## 3. Database Schema (Supabase Postgres)

### Migration: `supabase/migrations/001_crm_search_module.sql`

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE search_job_status AS ENUM ('draft', 'queued', 'running', 'done', 'failed');
CREATE TYPE search_result_status AS ENUM ('new', 'reviewed', 'approved', 'rejected', 'merged');

CREATE TYPE segment_type AS ENUM (
  'warehouse_space_owner',
  'warehouse_space_seeker',
  '3pl_operator',
  'customs_broker',
  'freight_forwarder_international',
  'drayage_trucking_local',
  'warehouse_staffing_jobs',
  'warehouse_job_seekers',
  'equipment_vendor',
  'fmcg_distributor',
  'warehouse_real_estate_broker',
  'bonded_warehouse_antrepo',
  'customs_cbp_facility_directory'
);

CREATE TYPE opportunity_type AS ENUM ('space_available', 'space_needed', 'services_partner', 'hiring_signal');
CREATE TYPE consent_status AS ENUM ('unknown', 'pending', 'opted_in', 'opted_out');
CREATE TYPE suppression_type AS ENUM ('email', 'domain', 'phone');

-- =============================================================================
-- CRM SEARCH TABLES
-- =============================================================================

CREATE TABLE crm_search_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  status search_job_status NOT NULL DEFAULT 'draft',
  segments segment_type[] NOT NULL,
  geo_json JSONB NOT NULL DEFAULT '{}',
  serpapi_params_json JSONB DEFAULT '{}',
  exclusions_json JSONB DEFAULT '{"domains": [], "keywords": []}',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT,
  total_queries INTEGER DEFAULT 0,
  total_results INTEGER DEFAULT 0,
  created_leads INTEGER DEFAULT 0,
  api_credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crm_search_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES crm_search_jobs(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  query_text TEXT NOT NULL,
  serpapi_location TEXT,
  serpapi_params_json JSONB DEFAULT '{}',
  serpapi_search_id TEXT,
  executed_at TIMESTAMPTZ,
  results_count INTEGER DEFAULT 0,
  from_cache BOOLEAN DEFAULT FALSE,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crm_search_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES crm_search_jobs(id) ON DELETE CASCADE,
  query_id UUID NOT NULL REFERENCES crm_search_queries(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  -- Raw result from SerpAPI
  title TEXT NOT NULL,
  snippet TEXT,
  url TEXT NOT NULL,
  displayed_link TEXT,
  domain TEXT NOT NULL,
  position INTEGER,
  result_date TEXT,
  cache_hash TEXT,
  -- Classification
  classification_segment segment_type,
  classification_confidence DECIMAL(3,2) DEFAULT 0,
  -- Extracted contact info
  extracted_emails TEXT[] DEFAULT '{}',
  extracted_phones TEXT[] DEFAULT '{}',
  extracted_address_text TEXT,
  contact_confidence DECIMAL(3,2) DEFAULT 0,
  -- Scoring
  score INTEGER DEFAULT 0,
  score_breakdown_json JSONB DEFAULT '{}',
  -- Dedupe
  dedupe_key TEXT,
  -- Review
  status search_result_status NOT NULL DEFAULT 'new',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_account_id UUID,
  created_lead_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CRM CORE TABLES
-- =============================================================================

CREATE TABLE crm_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT,
  segments segment_type[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  hq_address TEXT,
  hq_city TEXT,
  hq_state TEXT,
  hq_zip TEXT,
  hq_country TEXT DEFAULT 'US',
  score INTEGER DEFAULT 0,
  source_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  needs_verification BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crm_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES crm_accounts(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  title TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  consent_status consent_status DEFAULT 'unknown',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crm_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT,
  company_name TEXT,
  segments segment_type[] DEFAULT '{}',
  score INTEGER DEFAULT 0,
  score_breakdown_json JSONB DEFAULT '{}',
  stage TEXT DEFAULT 'new',
  source TEXT DEFAULT 'serpapi',
  source_job_id UUID REFERENCES crm_search_jobs(id),
  converted_to_account_id UUID REFERENCES crm_accounts(id),
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crm_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES crm_accounts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES crm_leads(id),
  name TEXT NOT NULL,
  type opportunity_type NOT NULL,
  stage TEXT DEFAULT 'new',
  estimated_value DECIMAL(12,2),
  space_sqft INTEGER,
  location_preference TEXT,
  close_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crm_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES crm_accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- COMPLIANCE TABLES
-- =============================================================================

CREATE TABLE crm_suppression_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type suppression_type NOT NULL,
  value TEXT NOT NULL,
  reason TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(org_id, type, value)
);

CREATE TABLE crm_source_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  source_url TEXT NOT NULL,
  source_query TEXT,
  source_title TEXT,
  source_snippet TEXT,
  serpapi_search_id TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_search_jobs_org_status ON crm_search_jobs(org_id, status);
CREATE INDEX idx_search_results_job_id ON crm_search_results(job_id);
CREATE INDEX idx_search_results_org_domain ON crm_search_results(org_id, domain);
CREATE INDEX idx_search_results_dedupe ON crm_search_results(org_id, dedupe_key);
CREATE INDEX idx_accounts_org_domain ON crm_accounts(org_id, domain);
CREATE INDEX idx_leads_org_domain ON crm_leads(org_id, domain);
CREATE INDEX idx_suppression_org_type ON crm_suppression_list(org_id, type);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE crm_search_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_search_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_search_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_source_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (adjust based on your auth setup)
CREATE POLICY "org_isolation" ON crm_search_jobs
  FOR ALL USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_isolation" ON crm_search_queries
  FOR ALL USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_isolation" ON crm_search_results
  FOR ALL USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_isolation" ON crm_accounts
  FOR ALL USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_isolation" ON crm_contacts
  FOR ALL USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_isolation" ON crm_leads
  FOR ALL USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_isolation" ON crm_opportunities
  FOR ALL USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_isolation" ON crm_activities
  FOR ALL USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_isolation" ON crm_suppression_list
  FOR ALL USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_isolation" ON crm_source_log
  FOR ALL USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_search_jobs_updated_at BEFORE UPDATE ON crm_search_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON crm_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON crm_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON crm_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 4. SerpAPI Integration

### API Reference (https://serpapi.com/search-api)

| Parameter | Type | Description |
|-----------|------|-------------|
| `api_key` | string | **Required.** Your SerpAPI key |
| `engine` | string | Search engine: `google` (default) |
| `q` | string | **Required.** Search query |
| `location` | string | Location: `"Austin, Texas, United States"` |
| `gl` | string | Country code: `us`, `uk`, etc. |
| `hl` | string | Language: `en`, `es`, etc. |
| `num` | integer | Results per page (max 100) |
| `start` | integer | Pagination offset (0, 10, 20...) |
| `device` | string | `desktop`, `mobile`, `tablet` |
| `no_cache` | boolean | Force fresh results |
| `safe` | string | Safe search: `active`, `off` |

### Response Structure

```json
{
  "search_metadata": {
    "id": "64c148d35119a60ab1e00cc9",
    "status": "Success",
    "created_at": "2023-07-26 16:24:51 UTC",
    "google_url": "https://www.google.com/search?q=..."
  },
  "search_parameters": {
    "q": "warehouse for lease",
    "location": "Los Angeles, California, United States",
    "gl": "us",
    "hl": "en"
  },
  "organic_results": [
    {
      "position": 1,
      "title": "Industrial Warehouse For Lease | 50,000 SF",
      "link": "https://example.com/warehouse-listing",
      "displayed_link": "example.com › warehouse",
      "snippet": "Prime warehouse space available in downtown LA...",
      "date": "3 days ago"
    }
  ],
  "local_results": {
    "places": [
      {
        "title": "ABC Logistics",
        "place_id": "ChIJ...",
        "address": "123 Industrial Way, LA",
        "phone": "(555) 123-4567",
        "rating": 4.5,
        "reviews": 128
      }
    ]
  },
  "related_searches": [...]
}
```

### Implementation: `lib/crm-search/serpapi.ts`

```typescript
import { z } from 'zod';
import crypto from 'crypto';

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

export const SerpAPIOrganicResultSchema = z.object({
  position: z.number(),
  title: z.string(),
  link: z.string(),
  displayed_link: z.string().optional(),
  snippet: z.string().optional(),
  snippet_highlighted_words: z.array(z.string()).optional(),
  date: z.string().optional(),
  source: z.string().optional(),
});

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
});

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
  local_results: z.object({
    places: z.array(SerpAPILocalResultSchema).optional(),
  }).optional(),
  related_searches: z.array(z.object({
    query: z.string(),
    link: z.string().optional(),
  })).optional(),
  error: z.string().optional(),
});

export type SerpAPIOrganicResult = z.infer<typeof SerpAPIOrganicResultSchema>;
export type SerpAPILocalResult = z.infer<typeof SerpAPILocalResultSchema>;
export type SerpAPIResponse = z.infer<typeof SerpAPIResponseSchema>;

// =============================================================================
// SEARCH PARAMETERS INTERFACE
// =============================================================================

export interface SerpAPISearchParams {
  q: string;                              // Required: search query
  location?: string;                      // "Austin, Texas, United States"
  gl?: string;                            // Country: "us"
  hl?: string;                            // Language: "en"
  num?: number;                           // Results per page (max 100)
  start?: number;                         // Pagination offset (0, 10, 20...)
  device?: 'desktop' | 'mobile' | 'tablet';
  no_cache?: boolean;
  safe?: 'active' | 'off';
}

// =============================================================================
// RATE LIMITING & CACHING
// =============================================================================

// SerpAPI rate limits: 20% of monthly plan per hour
// Developer plan (5000/month) = ~1000/hour
const RATE_LIMIT = {
  maxPerHour: 1000,
  requests: [] as number[],
};

// SerpAPI caches for 1 hour - free cached results
const resultCache = new Map<string, {
  data: SerpAPIResponse;
  timestamp: number;
  searchId: string;
}>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function generateCacheHash(params: SerpAPISearchParams): string {
  const normalized = {
    q: params.q.toLowerCase().trim(),
    location: params.location?.toLowerCase(),
    gl: params.gl || 'us',
    hl: params.hl || 'en',
    num: params.num || 10,
    start: params.start || 0,
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

async function checkRateLimit(): Promise<void> {
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  
  RATE_LIMIT.requests = RATE_LIMIT.requests.filter(t => t > oneHourAgo);
  
  if (RATE_LIMIT.requests.length >= RATE_LIMIT.maxPerHour) {
    const waitTime = RATE_LIMIT.requests[0] - oneHourAgo + 1000;
    console.warn(`SerpAPI rate limit reached. Waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return checkRateLimit();
  }
  
  RATE_LIMIT.requests.push(now);
}

// =============================================================================
// MAIN SEARCH FUNCTION
// =============================================================================

export async function searchSerpAPI(
  params: SerpAPISearchParams,
  options: { retries?: number; useCache?: boolean } = {}
): Promise<{
  data: SerpAPIResponse;
  cacheHash: string;
  fromCache: boolean;
  searchId: string;
}> {
  const { retries = 3, useCache = true } = options;
  const cacheHash = generateCacheHash(params);
  
  // Check local cache (SerpAPI doesn't charge for cached)
  if (useCache) {
    const cached = resultCache.get(cacheHash);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return {
        data: cached.data,
        cacheHash,
        fromCache: true,
        searchId: cached.searchId,
      };
    }
  }

  await checkRateLimit();

  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    throw new Error('SERPAPI_API_KEY environment variable is not set');
  }

  // Build URL with query parameters (SerpAPI uses GET)
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', params.q);
  
  if (params.location) url.searchParams.set('location', params.location);
  if (params.gl) url.searchParams.set('gl', params.gl);
  if (params.hl) url.searchParams.set('hl', params.hl);
  if (params.num) url.searchParams.set('num', String(params.num));
  if (params.start) url.searchParams.set('start', String(params.start));
  if (params.device) url.searchParams.set('device', params.device);
  if (params.no_cache) url.searchParams.set('no_cache', 'true');
  if (params.safe) url.searchParams.set('safe', params.safe);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 429 && retries > 0) {
        const backoff = Math.pow(2, 4 - retries) * 1000;
        await new Promise(r => setTimeout(r, backoff));
        return searchSerpAPI(params, { retries: retries - 1, useCache });
      }
      throw new Error(`SerpAPI error ${response.status}: ${await response.text()}`);
    }

    const rawData = await response.json();
    
    if (rawData.error) {
      throw new Error(`SerpAPI: ${rawData.error}`);
    }

    const data = SerpAPIResponseSchema.parse(rawData);
    const searchId = data.search_metadata.id;

    // Cache the result
    resultCache.set(cacheHash, { data, timestamp: Date.now(), searchId });

    return { data, cacheHash, fromCache: false, searchId };

  } catch (error) {
    if (retries > 0 && error instanceof Error && !error.message.includes('SerpAPI')) {
      await new Promise(r => setTimeout(r, 1000));
      return searchSerpAPI(params, { retries: retries - 1, useCache });
    }
    throw error;
  }
}

// =============================================================================
// PAGINATED SEARCH
// =============================================================================

export async function searchSerpAPIPaginated(
  params: SerpAPISearchParams,
  pages: number = 1
): Promise<SerpAPIOrganicResult[]> {
  const allResults: SerpAPIOrganicResult[] = [];
  const num = params.num || 10;

  for (let page = 0; page < pages; page++) {
    const start = page * num;
    const { data } = await searchSerpAPI({ ...params, start });
    
    if (data.organic_results && data.organic_results.length > 0) {
      allResults.push(...data.organic_results);
    } else {
      break;
    }

    // Delay between pages
    if (page < pages - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return allResults;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function normalizeDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().replace(/^(www|m|mobile|amp)\./, '');
  } catch {
    return url.toLowerCase();
  }
}

export function generateDedupeKey(domain: string, companyName?: string): string {
  const normalizedDomain = normalizeDomain(domain);
  
  if (normalizedDomain && normalizedDomain.includes('.')) {
    return `domain:${normalizedDomain}`;
  }
  
  if (companyName) {
    const normalized = companyName
      .toLowerCase()
      .replace(/\b(inc|llc|corp|ltd|co|company|corporation)\b\.?/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
    return `company:${normalized}`;
  }
  
  return `unknown:${Date.now()}`;
}

// =============================================================================
// SERPAPI LOCATIONS (City, State, Country format)
// =============================================================================

export const SERPAPI_LOCATIONS: Record<string, string> = {
  // Port Hubs
  'NY_NJ': 'New York, New York, United States',
  'LA_LB': 'Los Angeles, California, United States',
  'SAVANNAH': 'Savannah, Georgia, United States',
  'HOUSTON': 'Houston, Texas, United States',
  'MIAMI': 'Miami, Florida, United States',
  'CHICAGO': 'Chicago, Illinois, United States',
  'DALLAS': 'Dallas, Texas, United States',
  'ATLANTA': 'Atlanta, Georgia, United States',
  'SEATTLE_TACOMA': 'Seattle, Washington, United States',
  
  // States
  'CA': 'California, United States',
  'TX': 'Texas, United States',
  'FL': 'Florida, United States',
  'NY': 'New York, United States',
  'NJ': 'New Jersey, United States',
  'GA': 'Georgia, United States',
  'IL': 'Illinois, United States',
  'WA': 'Washington, United States',
};

export function getSerpAPILocation(portHub: string): string {
  return SERPAPI_LOCATIONS[portHub] || 'United States';
}

// =============================================================================
// ACCOUNT INFO (check remaining credits)
// =============================================================================

export async function getSerpAPIAccountInfo(): Promise<{
  plan: string;
  searches_per_month: number;
  this_month_usage: number;
  remaining: number;
}> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) throw new Error('SERPAPI_API_KEY not set');

  const response = await fetch(`https://serpapi.com/account.json?api_key=${apiKey}`);
  if (!response.ok) throw new Error(`Account info failed: ${response.status}`);

  const data = await response.json();
  
  return {
    plan: data.plan_name || 'Unknown',
    searches_per_month: data.plan_searches_left + data.this_month_usage,
    this_month_usage: data.this_month_usage || 0,
    remaining: data.plan_searches_left || 0,
  };
}
```

### Usage Examples

```typescript
import { searchSerpAPI, searchSerpAPIPaginated, getSerpAPILocation } from '@/lib/crm-search/serpapi';

// Single search
const { data, fromCache, searchId } = await searchSerpAPI({
  q: '"warehouse for lease" Los Angeles',
  location: getSerpAPILocation('LA_LB'),
  gl: 'us',
  hl: 'en',
  num: 20,
});

console.log(`Search ID: ${searchId}`);
console.log(`From cache: ${fromCache}`);
console.log(`Found ${data.organic_results?.length} organic results`);

// Paginated search (3 pages = 30 results)
const allResults = await searchSerpAPIPaginated({
  q: '3PL fulfillment center California',
  location: 'California, United States',
  num: 10,
}, 3);

console.log(`Total: ${allResults.length} results`);

// Check account info
const account = await getSerpAPIAccountInfo();
console.log(`Remaining searches: ${account.remaining}`);
```

---

## 5. Query Template Library

### Implementation: `lib/crm-search/query-templates.ts`

```typescript
import { Segment } from './classifier';

interface QueryTemplate {
  segment: Segment;
  templates: string[];
  negativeKeywords: string[];
}

export const QUERY_TEMPLATES: QueryTemplate[] = [
  {
    segment: 'warehouse_space_owner',
    templates: [
      '"warehouse for lease" {city}',
      '"industrial warehouse space for rent" {city}',
      '"distribution center for lease" {city}',
      '"warehouse space available" {city} {state}',
    ],
    negativeKeywords: ['-"self storage"', '-uhaul', '-"public storage"'],
  },
  {
    segment: '3pl_operator',
    templates: [
      '3PL {city} {state}',
      '"fulfillment center" {city}',
      '"order fulfillment" {city}',
      '"third party logistics" {city}',
      '"ecommerce fulfillment" {city}',
      '"FBA prep center" {city}',
    ],
    negativeKeywords: ['-careers', '-jobs'],
  },
  {
    segment: 'customs_broker',
    templates: [
      '"customs broker" {city}',
      '"licensed customs broker" {state}',
      '"customs brokerage" {city}',
      '"customs clearance" {city}',
    ],
    negativeKeywords: [],
  },
  {
    segment: 'freight_forwarder_international',
    templates: [
      '"international freight forwarder" {city}',
      '"ocean freight forwarder" {city}',
      '"air freight forwarder" {city}',
      'NVOCC {city} {state}',
    ],
    negativeKeywords: [],
  },
  {
    segment: 'drayage_trucking_local',
    templates: [
      'drayage {city}',
      '"container trucking" {city}',
      '"intermodal trucking" {city}',
      '"port trucking" {city}',
    ],
    negativeKeywords: [],
  },
  {
    segment: 'bonded_warehouse_antrepo',
    templates: [
      '"bonded warehouse" {city}',
      '"CBP bonded warehouse" {state}',
      '"FTZ warehouse" {city}',
      '"foreign trade zone" {city}',
    ],
    negativeKeywords: [],
  },
  {
    segment: 'equipment_vendor',
    templates: [
      '"warehouse racking" {state}',
      '"forklift dealer" {city}',
      '"dock equipment" {city}',
      '"pallet racking" {city}',
    ],
    negativeKeywords: [],
  },
  {
    segment: 'fmcg_distributor',
    templates: [
      '"FMCG distributor" {state}',
      '"grocery distributor" {city}',
      '"food distributor" {city}',
      '"beverage distributor" {city}',
    ],
    negativeKeywords: [],
  },
];

// Port Hub Configurations
export const PORT_HUBS: Record<string, { cities: string[]; states: string[] }> = {
  'NY_NJ': { cities: ['New York', 'Newark', 'Elizabeth'], states: ['NY', 'NJ'] },
  'LA_LB': { cities: ['Los Angeles', 'Long Beach', 'Carson'], states: ['CA'] },
  'SAVANNAH': { cities: ['Savannah', 'Garden City'], states: ['GA'] },
  'HOUSTON': { cities: ['Houston', 'Baytown'], states: ['TX'] },
  'MIAMI': { cities: ['Miami', 'Fort Lauderdale'], states: ['FL'] },
  'CHICAGO': { cities: ['Chicago', 'Joliet'], states: ['IL'] },
  'DALLAS': { cities: ['Dallas', 'Fort Worth'], states: ['TX'] },
  'ATLANTA': { cities: ['Atlanta', 'Macon'], states: ['GA'] },
  'SEATTLE_TACOMA': { cities: ['Seattle', 'Tacoma'], states: ['WA'] },
};

export function generateQueries(
  segments: Segment[],
  portHubs: string[],
  maxPerSegment = 5
): { segment: Segment; query: string; location: string }[] {
  const queries: { segment: Segment; query: string; location: string }[] = [];

  for (const segment of segments) {
    const config = QUERY_TEMPLATES.find(t => t.segment === segment);
    if (!config) continue;

    for (const hub of portHubs) {
      const hubConfig = PORT_HUBS[hub];
      if (!hubConfig) continue;

      const city = hubConfig.cities[0];
      const state = hubConfig.states[0];
      const location = `${city}, ${state === 'CA' ? 'California' : state === 'TX' ? 'Texas' : state}, United States`;

      for (const template of config.templates.slice(0, maxPerSegment)) {
        let query = template
          .replace('{city}', city)
          .replace('{state}', state);
        
        if (config.negativeKeywords.length > 0) {
          query += ' ' + config.negativeKeywords.join(' ');
        }

        queries.push({ segment, query: query.trim(), location });
      }
    }
  }

  return queries;
}
```

---

## 6. Segment Classifier

### Implementation: `lib/crm-search/classifier.ts`

```typescript
import { z } from 'zod';

export const SegmentType = z.enum([
  'warehouse_space_owner',
  'warehouse_space_seeker',
  '3pl_operator',
  'customs_broker',
  'freight_forwarder_international',
  'drayage_trucking_local',
  'warehouse_staffing_jobs',
  'warehouse_job_seekers',
  'equipment_vendor',
  'fmcg_distributor',
  'warehouse_real_estate_broker',
  'bonded_warehouse_antrepo',
  'customs_cbp_facility_directory',
]);

export type Segment = z.infer<typeof SegmentType>;

const SEGMENT_PATTERNS: Record<Segment, { strong: RegExp[]; negative: RegExp[] }> = {
  'warehouse_space_owner': {
    strong: [/\bfor\s+(lease|rent)\b/i, /\bspace\s+available\b/i],
    negative: [/\bself[- ]storage\b/i, /\buhaul\b/i],
  },
  'warehouse_space_seeker': {
    strong: [/\b(need|seeking)\s+warehouse\b/i],
    negative: [],
  },
  '3pl_operator': {
    strong: [/\b3pl\b/i, /\bfulfillment\s+center\b/i, /\bthird[- ]party\s+logistics\b/i],
    negative: [],
  },
  'customs_broker': {
    strong: [/\bcustoms\s+broker/i, /\bcbp\s+broker\b/i],
    negative: [],
  },
  'freight_forwarder_international': {
    strong: [/\bfreight\s+forward/i, /\bnvocc\b/i],
    negative: [],
  },
  'drayage_trucking_local': {
    strong: [/\bdrayage\b/i, /\bcontainer\s+trucking\b/i, /\bintermodal\b/i],
    negative: [],
  },
  'warehouse_staffing_jobs': {
    strong: [/\bwarehouse\s+(jobs?|hiring)\b/i],
    negative: [],
  },
  'warehouse_job_seekers': {
    strong: [/\bseeking\s+warehouse\s+position\b/i],
    negative: [],
  },
  'equipment_vendor': {
    strong: [/\bwarehouse\s+(racking|equipment)\b/i, /\bforklift\s+dealer\b/i],
    negative: [],
  },
  'fmcg_distributor': {
    strong: [/\b(fmcg|cpg|grocery)\s+distribut/i],
    negative: [],
  },
  'warehouse_real_estate_broker': {
    strong: [/\bindustrial\s+real\s+estate\b/i],
    negative: [],
  },
  'bonded_warehouse_antrepo': {
    strong: [/\bbonded\s+warehouse\b/i, /\bftz\b/i, /\bforeign[- ]trade\s+zone\b/i],
    negative: [],
  },
  'customs_cbp_facility_directory': {
    strong: [/\bcbp\s+(port|facility)\b/i, /\bport\s+of\s+entry\b/i],
    negative: [],
  },
};

export function classifyResult(
  title: string,
  snippet: string,
  targetSegments: Segment[]
): { segment: Segment; confidence: number } {
  const text = `${title} ${snippet}`.toLowerCase();
  let bestSegment = targetSegments[0];
  let bestScore = 0;

  for (const segment of targetSegments) {
    const patterns = SEGMENT_PATTERNS[segment];
    
    // Skip if negative match
    if (patterns.negative.some(p => p.test(text))) continue;
    
    // Score strong matches
    let score = patterns.strong.filter(p => p.test(text)).length * 30;
    score += 10; // Bonus for being in target list

    if (score > bestScore) {
      bestScore = score;
      bestSegment = segment;
    }
  }

  return {
    segment: bestSegment,
    confidence: Math.min(bestScore / 100, 1),
  };
}
```

---

## 7. Lead Scorer

### Implementation: `lib/crm-search/scorer.ts`

```typescript
import { Segment } from './classifier';

interface ScoringInput {
  title: string;
  snippet: string;
  domain: string;
  segment: Segment;
  confidence: number;
  emails: string[];
  phones: string[];
  address: string | null;
}

const COMMERCIAL_KEYWORDS = ['3pl', 'fulfillment', 'bonded', 'drayage', 'customs', 'logistics', 'ftz'];
const DIRECTORY_PATTERNS = [/\byelp\b/i, /\byellowpages\b/i, /\bmanta\b/i, /\bbbb\.org\b/i];

export function scoreResult(input: ScoringInput): {
  score: number;
  breakdown: Record<string, number>;
} {
  const text = `${input.title} ${input.snippet}`.toLowerCase();
  const breakdown: Record<string, number> = {};

  // Segment confidence (+20)
  breakdown.segmentMatch = input.confidence >= 0.7 ? 20 : input.confidence >= 0.4 ? 10 : 0;

  // Contact availability (+10)
  breakdown.contactAvailability = 0;
  if (input.emails.length > 0) breakdown.contactAvailability += 5;
  if (input.phones.length > 0) breakdown.contactAvailability += 5;

  // Commercial intent (+10)
  const intentMatches = COMMERCIAL_KEYWORDS.filter(kw => text.includes(kw));
  breakdown.commercialIntent = intentMatches.length >= 2 ? 10 : intentMatches.length === 1 ? 5 : 0;

  // Legitimacy (+10)
  breakdown.legitimacy = 0;
  if (input.address) breakdown.legitimacy += 5;
  if (/\b(about|contact|team)\b/i.test(text)) breakdown.legitimacy += 5;

  // Penalties
  breakdown.penalties = 0;
  if (DIRECTORY_PATTERNS.some(p => p.test(input.domain))) breakdown.penalties -= 10;
  if (/\bself[- ]storage\b/i.test(text)) breakdown.penalties -= 20;

  const score = Math.max(0, Math.min(100,
    Object.values(breakdown).reduce((a, b) => a + b, 0)
  ));

  return { score, breakdown };
}
```

---

## 8. Contact Extractor

### Implementation: `lib/crm-search/extractor.ts`

```typescript
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

const EMAIL_BLACKLIST = [/noreply@/i, /no-reply@/i, /example\./i, /test@/i];

export function extractContactInfo(text: string): {
  emails: string[];
  phones: string[];
  confidence: number;
} {
  // Extract emails
  const rawEmails = text.match(EMAIL_REGEX) || [];
  const emails = rawEmails
    .map(e => e.toLowerCase())
    .filter(e => !EMAIL_BLACKLIST.some(p => p.test(e)))
    .filter((e, i, arr) => arr.indexOf(e) === i)
    .slice(0, 5);

  // Extract phones
  const rawPhones = text.match(PHONE_REGEX) || [];
  const phones = rawPhones
    .map(normalizePhone)
    .filter((p): p is string => p !== null)
    .filter((p, i, arr) => arr.indexOf(p) === i)
    .slice(0, 5);

  // Calculate confidence
  let confidence = 0;
  if (emails.length > 0) confidence += 0.4;
  if (phones.length > 0) confidence += 0.4;

  return { emails, phones, confidence: Math.min(confidence, 1) };
}

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return null;
}

export function extractCompanyName(title: string): string {
  return title
    .split(/[|\-–—]/)[0]
    .replace(/\b(home|about|contact|welcome)\b/gi, '')
    .trim() || title;
}
```

---

## 9. Environment Variables

```env
# SerpAPI (https://serpapi.com/)
SERPAPI_API_KEY=your_serpapi_key_here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 10. File Structure

```
├── app/
│   ├── api/
│   │   └── crm-search/
│   │       └── jobs/
│   │           └── [jobId]/
│   │               └── execute/
│   │                   └── route.ts
│   └── crm-search/
│       ├── page.tsx
│       ├── new/page.tsx
│       ├── [jobId]/page.tsx
│       ├── compliance/page.tsx
│       └── actions.ts
├── components/
│   └── crm-search/
│       ├── results-table.tsx
│       └── job-status-badge.tsx
├── lib/
│   └── crm-search/
│       ├── serpapi.ts          # SerpAPI client
│       ├── query-templates.ts  # Query generator
│       ├── classifier.ts       # Segment classifier
│       ├── scorer.ts           # Lead scorer
│       ├── extractor.ts        # Contact extractor
│       ├── dedupe.ts           # Dedupe logic
│       ├── router.ts           # CRM routing
│       └── compliance.ts       # Suppression/compliance
└── supabase/
    └── migrations/
        └── 001_crm_search_module.sql
```

---

## 11. Implementation Checklist

- [ ] Run SQL migration in Supabase
- [ ] Set `SERPAPI_API_KEY` environment variable
- [ ] Implement `lib/crm-search/serpapi.ts`
- [ ] Implement query templates and classifier
- [ ] Build job execution API route
- [ ] Create UI pages (dashboard, create, review)
- [ ] Test with a small query first
- [ ] Monitor API credit usage

---

## 12. Key Differences: SerpAPI vs Serper

| Feature | SerpAPI | Serper |
|---------|---------|--------|
| Endpoint | `GET https://serpapi.com/search.json` | `POST https://google.serper.dev/search` |
| Auth | `api_key` query param | `X-API-KEY` header |
| Response | `organic_results` array | `organic` array |
| Pagination | `start` param (0, 10, 20...) | `page` param (1, 2, 3...) |
| Location | `location` (full city, state, country) | Geographic targeting |
| Caching | 1 hour, free cached results | Varies |
| Rate Limit | 20% of monthly plan per hour | Per-minute limits |

---

**Now implement this module using SerpAPI. Start with the database migration, then serpapi.ts, then build out the rest.**
