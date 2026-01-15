import type { Segment } from "./classifier"

interface ScoringInput {
  title: string
  snippet: string
  domain: string
  segment: Segment
  confidence: number
  emails: string[]
  phones: string[]
  address: string | null
}

const COMMERCIAL_KEYWORDS = [
  "3pl",
  "fulfillment",
  "bonded",
  "drayage",
  "customs",
  "logistics",
  "ftz",
]
const DIRECTORY_PATTERNS = [/\byelp\b/i, /\byellowpages\b/i, /\bmanta\b/i, /\bbbb\.org\b/i]

export function scoreResult(input: ScoringInput): {
  score: number
  breakdown: Record<string, number>
} {
  const text = `${input.title} ${input.snippet}`.toLowerCase()
  const breakdown: Record<string, number> = {}

  breakdown.segmentMatch = input.confidence >= 0.7 ? 20 : input.confidence >= 0.4 ? 10 : 0

  breakdown.contactAvailability = 0
  if (input.emails.length > 0) breakdown.contactAvailability += 5
  if (input.phones.length > 0) breakdown.contactAvailability += 5

  const intentMatches = COMMERCIAL_KEYWORDS.filter((keyword) => text.includes(keyword))
  breakdown.commercialIntent =
    intentMatches.length >= 2 ? 10 : intentMatches.length === 1 ? 5 : 0

  breakdown.legitimacy = 0
  if (input.address) breakdown.legitimacy += 5
  if (/\b(about|contact|team)\b/i.test(text)) breakdown.legitimacy += 5

  breakdown.penalties = 0
  if (DIRECTORY_PATTERNS.some((pattern) => pattern.test(input.domain))) breakdown.penalties -= 10
  if (/\bself[- ]storage\b/i.test(text)) breakdown.penalties -= 20

  const score = Math.max(
    0,
    Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0))
  )

  return { score, breakdown }
}
