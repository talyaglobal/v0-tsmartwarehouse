import { generateDedupeKey, normalizeDomain } from "./serpapi"

export function buildDedupeKey(url: string, companyName?: string): string {
  return generateDedupeKey(normalizeDomain(url), companyName)
}
