"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { User, Users, FileText, Zap, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api/client"
import {
  BookingRequestDetailsForm,
  type BookingRequestFormState,
} from "./booking-request-details-form"

export type BookingEntryChoice = "self" | "another"
export type BookingTypeChoice = "request" | "instant"

export interface BookingRequestFormData {
  averagePalletDays: number
  requestedFloor: string
  ownerOfProduct: string
  skuCount: number
  isSingleType: boolean
  specialMessage?: string
  /** When booking for another client: company admin can choose pre-approved (false) or requires approval (true) */
  requiresApproval?: boolean
}

export interface BookingEntryResult {
  bookingFor: BookingEntryChoice
  bookingType: BookingTypeChoice
  requestForm?: BookingRequestFormData
  /** When bookingFor === "another" and bookingType === "request", selected team member id for the request */
  requestCustomerId?: string
}

const defaultFormState: BookingRequestFormState = {
  customerId: null,
  averagePalletDays: 7,
  requestedFloor: "",
  ownerOfProduct: "",
  skuCount: 1,
  isSingleType: true,
  notes: "",
  requiresApproval: true,
}

interface BookingEntryModalProps {
  open: boolean
  onComplete: (result: BookingEntryResult) => void
  /** Called when modal is closed by user (outside click, Escape, or X) */
  onClose?: () => void
}

const STEPS = [
  { id: "who", title: "Who" },
  { id: "type", title: "Type" },
  { id: "form", title: "Request details" },
] as const

export function BookingEntryModal({ open, onComplete, onClose }: BookingEntryModalProps) {
  const [step, setStep] = useState<number>(0)
  const [bookingFor, setBookingFor] = useState<BookingEntryChoice | null>(null)
  const [bookingType, setBookingType] = useState<BookingTypeChoice | null>(null)
  const [form, setForm] = useState<BookingRequestFormState>(defaultFormState)

  const { data: bookingMembersData, isLoading: isLoadingMembers } = useQuery({
    queryKey: ["booking-members"],
    queryFn: async () => {
      const res = await api.get<{ members?: { memberId: string; name?: string; email?: string; teamName?: string; companyName?: string | null }[]; isTeamAdmin?: boolean }>(
        "/api/v1/teams/booking-members",
        { showToast: false }
      )
      if (!res.success) return { members: [], isTeamAdmin: false }
      const data = res.data
      const members = Array.isArray(data) ? [] : (data?.members ?? [])
      const isTeamAdmin = !Array.isArray(data) && (data?.isTeamAdmin === true)
      return { members, isTeamAdmin }
    },
    enabled: bookingFor === "another",
  })
  const members = bookingMembersData?.members ?? []
  const isTeamAdmin = bookingMembersData?.isTeamAdmin ?? false

  const showFormStep = bookingType === "request"

  const handleWhoChoice = (choice: BookingEntryChoice) => {
    setBookingFor(choice)
    setStep(1)
  }

  const handleTypeChoice = (choice: BookingTypeChoice) => {
    setBookingType(choice)
    if (choice === "instant") {
      onComplete({
        bookingFor: bookingFor!,
        bookingType: "instant",
      })
      return
    }
    setStep(2)
    setForm(defaultFormState)
  }

  const handleBack = () => {
    if (step === 1) {
      setStep(0)
      setBookingFor(null)
    } else if (step === 2) {
      setStep(1)
      setBookingType(null)
    }
  }

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (bookingFor === "another" && !form.customerId) return
    onComplete({
      bookingFor: bookingFor!,
      bookingType: "request",
      requestForm: {
        averagePalletDays: form.averagePalletDays,
        requestedFloor: form.requestedFloor,
        ownerOfProduct: form.ownerOfProduct,
        skuCount: form.skuCount,
        isSingleType: form.isSingleType,
        specialMessage: form.notes,
        requiresApproval: form.requiresApproval,
      },
      requestCustomerId: bookingFor === "another" ? form.customerId ?? undefined : undefined,
    })
  }

  const stepTitle =
    step === 0
      ? "Who is this booking for?"
      : step === 1
        ? "Booking request or instant booking?"
        : "Booking request details"

  const stepDescription =
    step === 0
      ? "Choose whether you are booking storage for yourself or for another client in your team."
      : step === 1
        ? "Submit a request for a quote, or search and book instantly."
        : "Fill in the details of your storage request. Single-type products may qualify for a discount (set by warehouse admin)."

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose?.() }}>
      <DialogContent
        className="flex min-w-0 max-h-[90vh] flex-col overflow-hidden sm:max-w-md"
      >
        {/* Stepper indicator */}
        <div className="flex shrink-0 items-center gap-2">
          {STEPS.filter((s) => s.id !== "form" || showFormStep).map((s, i) => (
            <div
              key={s.id}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {i + 1}
            </div>
          ))}
          {STEPS.filter((s) => s.id !== "form" || showFormStep).length > 1 && (
            <div className="h-px flex-1 bg-border" />
          )}
        </div>

        <DialogHeader className="min-w-0 shrink-0">
          <DialogTitle className="break-words pr-6">
            {stepTitle}
          </DialogTitle>
          <DialogDescription className="max-w-full break-words whitespace-normal text-wrap">
            {stepDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Step 0: Who */}
        {step === 0 && (
          <div className="grid min-w-0 grid-cols-1 gap-3 py-4 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto min-w-0 flex-col gap-3 overflow-hidden py-6 sm:max-w-full"
              onClick={() => handleWhoChoice("self")}
            >
              <User className="h-10 w-10 shrink-0 text-muted-foreground" />
              <span className="font-semibold">For myself</span>
              <span className="max-w-full break-words text-center text-xs font-normal text-muted-foreground">
                Book storage for your own company
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-w-0 flex-col gap-3 overflow-hidden py-6 sm:max-w-full"
              onClick={() => handleWhoChoice("another")}
            >
              <Users className="h-10 w-10 shrink-0 text-muted-foreground" />
              <span className="font-semibold">For another client</span>
              <span className="max-w-full break-words text-center text-xs font-normal text-muted-foreground">
                Book on behalf of a team member (approval may be required)
              </span>
            </Button>
          </div>
        )}

        {/* Step 1: Request vs Instant */}
        {step === 1 && (
          <div className="grid min-w-0 grid-cols-1 gap-3 py-4 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto min-w-0 flex-col gap-3 overflow-hidden py-6 sm:max-w-full"
              onClick={() => handleTypeChoice("request")}
            >
              <FileText className="h-10 w-10 shrink-0 text-muted-foreground" />
              <span className="font-semibold">Booking request</span>
              <span className="max-w-full break-words text-center text-xs font-normal text-muted-foreground">
                Submit a request; warehouse will respond with a quote
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-w-0 flex-col gap-3 overflow-hidden py-6 sm:max-w-full"
              onClick={() => handleTypeChoice("instant")}
            >
              <Zap className="h-10 w-10 shrink-0 text-muted-foreground" />
              <span className="font-semibold">Instant booking</span>
              <span className="max-w-full break-words text-center text-xs font-normal text-muted-foreground">
                Search warehouses and book immediately
              </span>
            </Button>
          </div>
        )}

        {/* Step 2: Request form (shared component) */}
        {step === 2 && showFormStep && (
          <BookingRequestDetailsForm
            form={form}
            setForm={setForm}
            members={members}
            isLoadingMembers={isLoadingMembers}
            isTeamAdmin={isTeamAdmin}
            showClientSelect={bookingFor === "another"}
            onSubmit={handleRequestSubmit}
            submitLabel="Submit request"
            onCancel={handleBack}
            cancelLabel="Back"
          />
        )}

        {/* Back button for step 1 */}
        {step === 1 && (
          <div className="pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleBack} className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

