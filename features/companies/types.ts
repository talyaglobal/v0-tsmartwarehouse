/**
 * Company Types
 */

export type CompanyType = 'warehouse_company' | 'customer_company'

export interface Company {
  id: string
  name: string
  type: CompanyType
  logoUrl?: string
  createdAt: string
  updatedAt: string
}

