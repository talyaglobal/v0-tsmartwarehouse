import type { Segment } from "./classifier"

interface QueryTemplate {
  segment: Segment
  templates: string[]
  negativeKeywords: string[]
}

export const QUERY_TEMPLATES: QueryTemplate[] = [
  {
    segment: "warehouse_space_owner",
    templates: [
      '"warehouse for lease" {city}',
      '"industrial warehouse space for rent" {city}',
      '"distribution center for lease" {city}',
      '"warehouse space available" {city} {state}',
    ],
    negativeKeywords: ['-"self storage"', "-uhaul", '-"public storage"'],
  },
  {
    segment: "3pl_operator",
    templates: [
      "3PL {city} {state}",
      '"fulfillment center" {city}',
      '"order fulfillment" {city}',
      '"third party logistics" {city}',
      '"ecommerce fulfillment" {city}',
      '"FBA prep center" {city}',
    ],
    negativeKeywords: ["-careers", "-jobs"],
  },
  {
    segment: "customs_broker",
    templates: [
      '"customs broker" {city}',
      '"licensed customs broker" {state}',
      '"customs brokerage" {city}',
      '"customs clearance" {city}',
    ],
    negativeKeywords: [],
  },
  {
    segment: "freight_forwarder_international",
    templates: [
      '"international freight forwarder" {city}',
      '"ocean freight forwarder" {city}',
      '"air freight forwarder" {city}',
      "NVOCC {city} {state}",
    ],
    negativeKeywords: [],
  },
  {
    segment: "drayage_trucking_local",
    templates: [
      "drayage {city}",
      '"container trucking" {city}',
      '"intermodal trucking" {city}',
      '"port trucking" {city}',
    ],
    negativeKeywords: [],
  },
  {
    segment: "bonded_warehouse_antrepo",
    templates: [
      '"bonded warehouse" {city}',
      '"CBP bonded warehouse" {state}',
      '"FTZ warehouse" {city}',
      '"foreign trade zone" {city}',
    ],
    negativeKeywords: [],
  },
  {
    segment: "equipment_vendor",
    templates: [
      '"warehouse racking" {state}',
      '"forklift dealer" {city}',
      '"dock equipment" {city}',
      '"pallet racking" {city}',
    ],
    negativeKeywords: [],
  },
  {
    segment: "fmcg_distributor",
    templates: [
      '"FMCG distributor" {state}',
      '"grocery distributor" {city}',
      '"food distributor" {city}',
      '"beverage distributor" {city}',
    ],
    negativeKeywords: [],
  },
]

export const PORT_HUBS: Record<string, { cities: string[]; states: string[] }> = {
  NY_NJ: { cities: ["New York", "Newark", "Elizabeth"], states: ["NY", "NJ"] },
  LA_LB: { cities: ["Los Angeles", "Long Beach", "Carson"], states: ["CA"] },
  SAVANNAH: { cities: ["Savannah", "Garden City"], states: ["GA"] },
  HOUSTON: { cities: ["Houston", "Baytown"], states: ["TX"] },
  MIAMI: { cities: ["Miami", "Fort Lauderdale"], states: ["FL"] },
  CHICAGO: { cities: ["Chicago", "Joliet"], states: ["IL"] },
  DALLAS: { cities: ["Dallas", "Fort Worth"], states: ["TX"] },
  ATLANTA: { cities: ["Atlanta", "Macon"], states: ["GA"] },
  SEATTLE_TACOMA: { cities: ["Seattle", "Tacoma"], states: ["WA"] },
}

export function generateQueries(
  segments: Segment[],
  locations: { cities: string[]; states: string[] },
  maxPerSegment = 5
): { segment: Segment; query: string; location: string }[] {
  const queries: { segment: Segment; query: string; location: string }[] = []
  const city = locations.cities[0]
  const state = locations.states[0]
  const locationLabel = `${city}, ${state === "CA" ? "California" : state === "TX" ? "Texas" : state}, United States`

  for (const segment of segments) {
    const config = QUERY_TEMPLATES.find((template) => template.segment === segment)
    if (!config) continue

    for (const template of config.templates.slice(0, maxPerSegment)) {
      let query = template.replace("{city}", city).replace("{state}", state)
      if (config.negativeKeywords.length > 0) {
        query += ` ${config.negativeKeywords.join(" ")}`
      }
      queries.push({ segment, query: query.trim(), location: locationLabel })
    }
  }

  return queries
}
