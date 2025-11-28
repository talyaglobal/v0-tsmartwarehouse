// Operational Risk Management
// Risk classification, thresholds, and automated scoring

export type RiskCategory = "operational" | "financial" | "compliance" | "safety" | "security"
export type RiskLevel = "low" | "medium" | "high" | "critical"

export interface RiskFactor {
  id: string
  name: string
  category: RiskCategory
  weight: number // 1-10
  description: string
}

export interface RiskAssessment {
  id: string
  entityType: "booking" | "incident" | "customer" | "warehouse"
  entityId: string
  factors: RiskFactorScore[]
  totalScore: number
  level: RiskLevel
  recommendations: string[]
  assessedAt: string
  assessedBy: string
}

export interface RiskFactorScore {
  factorId: string
  score: number // 1-10
  notes?: string
}

// Risk factors for different entity types
export const riskFactors: Record<string, RiskFactor[]> = {
  booking: [
    {
      id: "b1",
      name: "Customer Payment History",
      category: "financial",
      weight: 8,
      description: "Past payment reliability",
    },
    { id: "b2", name: "Item Value", category: "financial", weight: 7, description: "Total declared value of items" },
    {
      id: "b3",
      name: "Special Handling Required",
      category: "operational",
      weight: 6,
      description: "Climate control, fragile items, etc.",
    },
    { id: "b4", name: "Duration", category: "operational", weight: 4, description: "Length of storage period" },
    { id: "b5", name: "Item Type Risk", category: "safety", weight: 8, description: "Hazardous or restricted items" },
  ],
  incident: [
    {
      id: "i1",
      name: "Severity Impact",
      category: "operational",
      weight: 10,
      description: "Direct impact on operations",
    },
    {
      id: "i2",
      name: "Financial Exposure",
      category: "financial",
      weight: 9,
      description: "Potential financial liability",
    },
    {
      id: "i3",
      name: "Customer Impact",
      category: "operational",
      weight: 8,
      description: "Number of customers affected",
    },
    {
      id: "i4",
      name: "Regulatory Implications",
      category: "compliance",
      weight: 9,
      description: "Potential compliance violations",
    },
    {
      id: "i5",
      name: "Recurrence Likelihood",
      category: "operational",
      weight: 7,
      description: "Probability of similar incidents",
    },
  ],
  customer: [
    { id: "c1", name: "Payment History", category: "financial", weight: 9, description: "On-time payment record" },
    { id: "c2", name: "Claims History", category: "financial", weight: 7, description: "Past claims filed" },
    { id: "c3", name: "Contract Value", category: "financial", weight: 6, description: "Total contract amount" },
    {
      id: "c4",
      name: "Compliance Record",
      category: "compliance",
      weight: 8,
      description: "Following warehouse rules",
    },
    {
      id: "c5",
      name: "Communication Quality",
      category: "operational",
      weight: 5,
      description: "Responsiveness and clarity",
    },
  ],
  warehouse: [
    {
      id: "w1",
      name: "Capacity Utilization",
      category: "operational",
      weight: 7,
      description: "Current usage vs capacity",
    },
    { id: "w2", name: "Incident Frequency", category: "safety", weight: 9, description: "Recent incident count" },
    {
      id: "w3",
      name: "Equipment Condition",
      category: "operational",
      weight: 8,
      description: "State of equipment and infrastructure",
    },
    { id: "w4", name: "Staff Training", category: "compliance", weight: 7, description: "Training compliance levels" },
    {
      id: "w5",
      name: "Security Measures",
      category: "security",
      weight: 9,
      description: "Security system effectiveness",
    },
  ],
}

// Risk level thresholds
export const riskThresholds: Record<RiskLevel, { min: number; max: number; color: string }> = {
  low: { min: 0, max: 25, color: "green" },
  medium: { min: 26, max: 50, color: "yellow" },
  high: { min: 51, max: 75, color: "orange" },
  critical: { min: 76, max: 100, color: "red" },
}

// Calculate risk score
export function calculateRiskScore(
  entityType: keyof typeof riskFactors,
  scores: RiskFactorScore[],
): { totalScore: number; level: RiskLevel; recommendations: string[] } {
  const factors = riskFactors[entityType]
  if (!factors) {
    return { totalScore: 0, level: "low", recommendations: [] }
  }

  let weightedSum = 0
  let totalWeight = 0
  const recommendations: string[] = []

  for (const factor of factors) {
    const scoreEntry = scores.find((s) => s.factorId === factor.id)
    if (scoreEntry) {
      weightedSum += scoreEntry.score * factor.weight
      totalWeight += factor.weight * 10 // Max score is 10

      // Generate recommendations for high-scoring factors
      if (scoreEntry.score >= 7) {
        recommendations.push(`Address ${factor.name}: ${factor.description}`)
      }
    }
  }

  const totalScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0

  let level: RiskLevel = "low"
  for (const [lvl, threshold] of Object.entries(riskThresholds)) {
    if (totalScore >= threshold.min && totalScore <= threshold.max) {
      level = lvl as RiskLevel
      break
    }
  }

  return { totalScore, level, recommendations }
}

// Auto-score based on entity data
export function autoScoreBooking(booking: {
  totalAmount: number
  itemCount: number
  hasSpecialHandling: boolean
  customerPaymentScore: number
  durationDays: number
}): RiskFactorScore[] {
  const scores: RiskFactorScore[] = []

  // Payment history (inverted - lower is better customer, higher risk for bad history)
  scores.push({
    factorId: "b1",
    score: 10 - Math.min(booking.customerPaymentScore, 10),
    notes: `Customer payment score: ${booking.customerPaymentScore}/10`,
  })

  // Item value risk
  const valueScore =
    booking.totalAmount > 50000
      ? 9
      : booking.totalAmount > 20000
        ? 7
        : booking.totalAmount > 10000
          ? 5
          : booking.totalAmount > 5000
            ? 3
            : 1
  scores.push({ factorId: "b2", score: valueScore, notes: `Value: $${booking.totalAmount}` })

  // Special handling
  scores.push({
    factorId: "b3",
    score: booking.hasSpecialHandling ? 7 : 2,
    notes: booking.hasSpecialHandling ? "Special handling required" : "Standard handling",
  })

  // Duration risk
  const durationScore =
    booking.durationDays > 365
      ? 8
      : booking.durationDays > 180
        ? 6
        : booking.durationDays > 90
          ? 4
          : booking.durationDays > 30
            ? 2
            : 1
  scores.push({ factorId: "b4", score: durationScore, notes: `Duration: ${booking.durationDays} days` })

  return scores
}
