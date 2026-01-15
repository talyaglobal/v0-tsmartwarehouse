import { z } from "zod"

export const SegmentType = z.enum([
  "warehouse_space_owner",
  "warehouse_space_seeker",
  "3pl_operator",
  "customs_broker",
  "freight_forwarder_international",
  "drayage_trucking_local",
  "warehouse_staffing_jobs",
  "warehouse_job_seekers",
  "equipment_vendor",
  "fmcg_distributor",
  "warehouse_real_estate_broker",
  "bonded_warehouse_antrepo",
  "customs_cbp_facility_directory",
])

export type Segment = z.infer<typeof SegmentType>

const SEGMENT_PATTERNS: Record<
  Segment,
  { strong: RegExp[]; negative: RegExp[] }
> = {
  warehouse_space_owner: {
    strong: [/\bfor\s+(lease|rent)\b/i, /\bspace\s+available\b/i],
    negative: [/\bself[- ]storage\b/i, /\buhaul\b/i],
  },
  warehouse_space_seeker: {
    strong: [/\b(need|seeking)\s+warehouse\b/i],
    negative: [],
  },
  "3pl_operator": {
    strong: [
      /\b3pl\b/i,
      /\bfulfillment\s+center\b/i,
      /\bthird[- ]party\s+logistics\b/i,
    ],
    negative: [],
  },
  customs_broker: {
    strong: [/\bcustoms\s+broker/i, /\bcbp\s+broker\b/i],
    negative: [],
  },
  freight_forwarder_international: {
    strong: [/\bfreight\s+forward/i, /\bnvocc\b/i],
    negative: [],
  },
  drayage_trucking_local: {
    strong: [/\bdrayage\b/i, /\bcontainer\s+trucking\b/i, /\bintermodal\b/i],
    negative: [],
  },
  warehouse_staffing_jobs: {
    strong: [/\bwarehouse\s+(jobs?|hiring)\b/i],
    negative: [],
  },
  warehouse_job_seekers: {
    strong: [/\bseeking\s+warehouse\s+position\b/i],
    negative: [],
  },
  equipment_vendor: {
    strong: [/\bwarehouse\s+(racking|equipment)\b/i, /\bforklift\s+dealer\b/i],
    negative: [],
  },
  fmcg_distributor: {
    strong: [/\b(fmcg|cpg|grocery)\s+distribut/i],
    negative: [],
  },
  warehouse_real_estate_broker: {
    strong: [/\bindustrial\s+real\s+estate\b/i],
    negative: [],
  },
  bonded_warehouse_antrepo: {
    strong: [/\bbonded\s+warehouse\b/i, /\bftz\b/i, /\bforeign[- ]trade\s+zone\b/i],
    negative: [],
  },
  customs_cbp_facility_directory: {
    strong: [/\bcbp\s+(port|facility)\b/i, /\bport\s+of\s+entry\b/i],
    negative: [],
  },
}

export function classifyResult(
  title: string,
  snippet: string,
  targetSegments: Segment[]
): { segment: Segment; confidence: number } {
  const text = `${title} ${snippet}`.toLowerCase()
  let bestSegment = targetSegments[0]
  let bestScore = 0

  for (const segment of targetSegments) {
    const patterns = SEGMENT_PATTERNS[segment]
    if (patterns.negative.some((pattern) => pattern.test(text))) continue

    let score = patterns.strong.filter((pattern) => pattern.test(text)).length * 30
    score += 10

    if (score > bestScore) {
      bestScore = score
      bestSegment = segment
    }
  }

  return {
    segment: bestSegment,
    confidence: Math.min(bestScore / 100, 1),
  }
}
