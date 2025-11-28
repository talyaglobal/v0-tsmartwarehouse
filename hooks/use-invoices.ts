"use client"

import useSWR from "swr"
import { invoiceService } from "@/modules/accounting/services/invoice"
import type { PaginationParams, PaymentStatus } from "@/modules/common/types"

export function useInvoices(
  filters?: { status?: PaymentStatus[]; customer_id?: string },
  pagination?: PaginationParams,
) {
  const key = ["invoices", JSON.stringify(filters), JSON.stringify(pagination)]

  const { data, error, isLoading, mutate } = useSWR(key, () => invoiceService.getInvoices(filters, pagination))

  return {
    invoices: data?.data ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useInvoice(id: string) {
  const { data, error, isLoading, mutate } = useSWR(id ? ["invoice", id] : null, () =>
    invoiceService.getInvoiceById(id),
  )

  return {
    invoice: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useOverdueInvoices() {
  const { data, error, isLoading } = useSWR("overdue-invoices", () => invoiceService.getOverdueInvoices())

  return {
    invoices: data ?? [],
    isLoading,
    isError: !!error,
  }
}

export function useRevenueSummary(startDate: string, endDate: string) {
  const key = ["revenue-summary", startDate, endDate]

  const { data, error, isLoading } = useSWR(key, () => invoiceService.getRevenueSummary(startDate, endDate))

  return {
    summary: data,
    isLoading,
    isError: !!error,
  }
}
