import type { MembershipCredit, CreditRedemptionRequest } from "../types"

const credits: MembershipCredit[] = []

export class CreditService {
  private static instance: CreditService

  static getInstance(): CreditService {
    if (!CreditService.instance) {
      CreditService.instance = new CreditService()
    }
    return CreditService.instance
  }

  async getCustomerCredits(customerId: string): Promise<MembershipCredit[]> {
    return credits.filter((c) => c.customer_id === customerId)
  }

  async getAvailableBalance(customerId: string): Promise<number> {
    const customerCredits = await this.getCustomerCredits(customerId)
    const now = new Date()

    return customerCredits.reduce((total, credit) => {
      if (credit.expires_at && new Date(credit.expires_at) < now) {
        return total
      }
      if (credit.type === "earned" || credit.type === "bonus") {
        return total + credit.amount
      }
      if (credit.type === "redeemed") {
        return total - credit.amount
      }
      return total
    }, 0)
  }

  async addCredit(
    customerId: string,
    amount: number,
    type: MembershipCredit["type"],
    description: string,
    expiresAt?: string,
  ): Promise<MembershipCredit> {
    const credit: MembershipCredit = {
      id: `credit-${Date.now()}`,
      customer_id: customerId,
      amount,
      type,
      description,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    }
    credits.push(credit)
    return credit
  }

  async redeemCredit(request: CreditRedemptionRequest): Promise<MembershipCredit | null> {
    const balance = await this.getAvailableBalance(request.customer_id)
    if (balance < request.amount) {
      return null
    }

    return this.addCredit(
      request.customer_id,
      request.amount,
      "redeemed",
      request.booking_id ? `Redeemed for booking ${request.booking_id}` : "Credit redemption",
    )
  }

  async awardLoyaltyPoints(customerId: string, bookingAmount: number): Promise<MembershipCredit> {
    const points = Math.floor(bookingAmount * 0.01) // 1% of booking amount
    return this.addCredit(
      customerId,
      points,
      "earned",
      `Earned from booking ($${bookingAmount})`,
      this.getExpirationDate(12), // Expires in 12 months
    )
  }

  private getExpirationDate(months: number): string {
    const date = new Date()
    date.setMonth(date.getMonth() + months)
    return date.toISOString()
  }
}

export const creditService = CreditService.getInstance()
