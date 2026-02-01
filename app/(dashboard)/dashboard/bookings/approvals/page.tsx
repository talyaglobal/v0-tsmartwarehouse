"use client"

import { useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookingApprovalsList } from "@/features/bookings/components/booking-approvals-list"
import { Bell, Send } from "@/components/icons"

export default function BookingApprovalsPage() {
  const [activeTab, setActiveTab] = useState("pending")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Booking Approvals"
        description="Manage booking approval requests"
        backButton={true}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Bell className="h-4 w-4" />
            Pending Approvals
          </TabsTrigger>
          <TabsTrigger value="requested" className="gap-2">
            <Send className="h-4 w-4" />
            Requested by Me
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <BookingApprovalsList type="pending" />
        </TabsContent>

        <TabsContent value="requested" className="mt-6">
          <BookingApprovalsList type="requested" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
