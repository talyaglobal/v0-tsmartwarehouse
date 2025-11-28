import { BookingWizard } from "@/components/booking/booking-wizard"

export const metadata = {
  title: "New Booking | T Smart Warehouse",
}

export default function NewBookingPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Create New Booking</h1>
        <p className="text-muted-foreground">Book warehouse space in a few simple steps</p>
      </div>
      <BookingWizard />
    </div>
  )
}
