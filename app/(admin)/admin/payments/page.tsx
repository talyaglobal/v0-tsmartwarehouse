"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { mockInvoices } from "@/lib/mock-data"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  Search,
  Download,
  CreditCard,
  Building2,
  Banknote,
} from "lucide-react"

// Mock payment transactions
const recentPayments = [
  {
    id: "1",
    invoice_number: "INV-2024-0001",
    customer: "Acme Corporation",
    amount: 4200,
    method: "credit_card",
    status: "completed",
    date: "2024-06-18T14:30:00Z",
  },
  {
    id: "2",
    invoice_number: "INV-2024-0002",
    customer: "TechStart Inc",
    amount: 1700,
    method: "bank_transfer",
    status: "completed",
    date: "2024-06-17T10:00:00Z",
  },
  {
    id: "3",
    invoice_number: "INV-2024-0003",
    customer: "Global Imports LLC",
    amount: 8500,
    method: "credit_card",
    status: "pending",
    date: "2024-06-16T16:45:00Z",
  },
]

const paymentMethodIcons: Record<string, typeof CreditCard> = {
  credit_card: CreditCard,
  bank_transfer: Building2,
  cash: Banknote,
}

export default function PaymentsPage() {
  const totalReceived = recentPayments.filter((p) => p.status === "completed").reduce((acc, p) => acc + p.amount, 0)

  const pendingAmount = mockInvoices
    .filter((i) => i.status !== "paid")
    .reduce((acc, i) => acc + (i.total_amount - i.paid_amount), 0)

  const overdueAmount = mockInvoices
    .filter((i) => i.status === "overdue")
    .reduce((acc, i) => acc + (i.total_amount - i.paid_amount), 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Track payments and transactions">
        <Button>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Received This Month"
          value={formatCurrency(totalReceived)}
          icon={DollarSign}
          trend={{ value: 15, isPositive: true }}
          description="vs last month"
        />
        <StatCard
          title="Pending Payments"
          value={formatCurrency(pendingAmount)}
          icon={Clock}
          description={`${mockInvoices.filter((i) => i.status === "pending" || i.status === "partial").length} invoices`}
        />
        <StatCard
          title="Overdue"
          value={formatCurrency(overdueAmount)}
          icon={AlertCircle}
          className="border-l-4 border-l-red-500"
        />
        <StatCard
          title="Collection Rate"
          value="94.2%"
          icon={TrendingUp}
          trend={{ value: 2.1, isPositive: true }}
          description="vs last month"
        />
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Transactions</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search transactions..." className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentPayments.map((payment) => {
              const Icon = paymentMethodIcons[payment.method] || CreditCard
              return (
                <div key={payment.id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{payment.customer}</p>
                      <p className="text-sm text-muted-foreground">
                        {payment.invoice_number} • {formatDate(payment.date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-muted-foreground capitalize">{payment.method.replace("_", " ")}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        payment.status === "completed"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {payment.status === "completed" ? "Completed" : "Pending"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods Breakdown */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <CreditCard className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Credit Card</p>
                <p className="text-2xl font-bold">68%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <Building2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bank Transfer</p>
                <p className="text-2xl font-bold">28%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <Banknote className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cash/Check</p>
                <p className="text-2xl font-bold">4%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
