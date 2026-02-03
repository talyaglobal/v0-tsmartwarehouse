import type { Metadata } from "next"
import Link from "next/link"
import { ScreenshotImage } from "./screenshot-image"

export const metadata: Metadata = {
  title: "How to Use",
  description: "Learn how the Warebnb platform works for all user types: customers, warehouse owners, staff, brokers, and transport partners.",
}

const screenshotImages = [
  { src: "/how-to-use/01-homepage.png", alt: "Homepage with search and hero" },
  { src: "/how-to-use/02-search-results.png", alt: "Warehouse search results and filters" },
  { src: "/how-to-use/03-warehouse-detail.png", alt: "Warehouse detail and booking summary" },
  { src: "/how-to-use/04-my-organization.png", alt: "My Organization teams and members" },
  { src: "/how-to-use/05-booking-for-modal.png", alt: "Who is this booking for modal" },
  { src: "/how-to-use/06-booking-request-details.png", alt: "Booking request details form" },
  { src: "/how-to-use/07-booking-requests.png", alt: "Booking Requests list" },
  { src: "/how-to-use/08-booking-details.png", alt: "Booking details page" },
  { src: "/how-to-use/09-complete-booking.png", alt: "Complete booking date and time" },
] as const

export default function HowToUsePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-16">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">How to Use Warebnb</h1>
        <p className="text-muted-foreground">
          A visual guide to the platform for every user type. Last updated: February 2026.
        </p>
      </div>

      {/* 1. Homepage */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">1. Homepage & Search</h2>
        <p className="text-muted-foreground">
          From the <Link href="/" className="text-foreground underline">homepage</Link> you can search for warehouse space
          by <strong>location</strong>, <strong>type</strong> (Space or Pallet), <strong>square feet</strong>, <strong>months</strong>,
          and <strong>start/end dates</strong>. Use the main search bar or the &quot;Browse Warehouses&quot; / &quot;Start Free Today&quot;
          buttons. The hero section shows trust indicators (e.g. rating, number of businesses) and the map preview highlights
          booking confirmations and locations.
        </p>
        <ScreenshotImage
          src={screenshotImages[0].src}
          alt={screenshotImages[0].alt}
          caption={
            <>
              <strong>Homepage.</strong> Use the search bar to set location, storage type, size, and dates, then click Search.
              Sign In or Get Started for full access.
            </>
          }
        />
      </section>

      {/* 2. Search results */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">2. Find Warehouses – Results & Filters</h2>
        <p className="text-muted-foreground">
          After searching, you see the <strong>Find Warehouses</strong> page: a top search bar (location, type, pallets/dates)
          and a <strong>Filters</strong> sidebar. Refine by <strong>price range</strong>, <strong>rating</strong>, <strong>goods type</strong>
          (e.g. FMCG, Food, Pharmaceutical, Medical Devices), and <strong>temperature</strong> (Ambient, Chilled, Frozen).
          Results can be sorted by distance and shown in <strong>List</strong> or <strong>Grid</strong>. Each card shows location,
          rating, sq ft, pallet capacity, goods types, and price per pallet per day.
        </p>
        <ScreenshotImage
          src={screenshotImages[1].src}
          alt={screenshotImages[1].alt}
          caption={
            <>
              <strong>Search results.</strong> Use Filters for price, rating, goods type, and temperature. Switch between List and Grid view.
            </>
          }
        />
      </section>

      {/* 3. Warehouse detail */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">3. Warehouse Detail & Booking Summary</h2>
        <p className="text-muted-foreground">
          Click a warehouse to open its detail page. You see the <strong>image gallery</strong>, rating, and &quot;About this warehouse&quot;.
          The right-hand <strong>Booking Summary</strong> shows storage type, quantity, start/end dates, and duration. You must
          fill in <strong>all pallet details</strong> (quantity, height, weight per pallet) to see the total price; until then a
          warning explains that pallet count is required. The booking can be created as a <strong>pre-order</strong>: warehouse
          staff will contact you to finalize. Use <strong>Request to Book</strong> when ready, and choose a drop-off date/time when booking.
        </p>
        <ScreenshotImage
          src={screenshotImages[2].src}
          alt={screenshotImages[2].alt}
          caption={
            <>
              <strong>Warehouse detail.</strong> Complete pallet details to see the price. Request to Book creates a pre-order; staff will confirm.
            </>
          }
        />
      </section>

      {/* 4. My Organization */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">4. My Organization – Teams & Members</h2>
        <p className="text-muted-foreground">
          Corporate customers use <strong>My Organization</strong> (sidebar) → <strong>Team Members</strong>. In <strong>Teams</strong>,
          you see all teams (e.g. All Teams, Default Team, Favorite Partners, Private Team). Use <strong>+ Create Team</strong> to add
          a team; use the <strong>⋯</strong> menu on a team to <strong>Rename</strong> or <strong>Delete team</strong> (default team
          and teams with admin members cannot be deleted until members are moved). In <strong>Team Members</strong>, add people via
          <strong> Add Existing User</strong>, <strong>Add Member</strong>, or <strong>Invite Member</strong>. The table shows Name,
          Email, Role (Admin / Member / Partner company), Teams, and Joined. Use the row <strong>⋯</strong> to <strong>Move to another
          team</strong>, <strong>Edit</strong> (for your own company members), or <strong>Remove</strong>.
        </p>
        <ScreenshotImage
          src={screenshotImages[3].src}
          alt={screenshotImages[3].alt}
          caption={
            <>
              <strong>My Organization.</strong> Manage teams and members. Create teams, add or invite members, move members between teams. Partner company users show as &quot;Partner company&quot; with their company name.
            </>
          }
        />
      </section>

      {/* 5. Who is this booking for */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">5. New Booking – Who Is This For?</h2>
        <p className="text-muted-foreground">
          When you start a <strong>New Booking</strong> from the dashboard (Bookings → New), the first step is <strong>Who is this
          booking for?</strong> Choose <strong>For myself</strong> (book storage for your own company) or <strong>For another
          client</strong> (book on behalf of a team member). This decides whether the booking is under your account or requires
          selecting a client and optionally an approval flow (pre-approved vs requires approval).
        </p>
        <ScreenshotImage
          src={screenshotImages[4].src}
          alt={screenshotImages[4].alt}
          caption={
            <>
              <strong>Step 1.</strong> Select &quot;For myself&quot; or &quot;For another client&quot; to continue to the booking request form.
            </>
          }
        />
      </section>

      {/* 6. Booking request details */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">6. Booking Request Details (On Behalf)</h2>
        <p className="text-muted-foreground">
          If you chose &quot;For another client&quot;, the <strong>Booking request details</strong> form appears. Select the
          <strong> client from your team</strong> and set <strong>Approval</strong>: <strong>Pre-approved</strong> (confirmed without
          client approval) or <strong>Requires approval</strong> (client must approve before confirmation). Fill in average days
          per pallet, requested floor, owner of product, number of SKUs, optional message, and whether it is a <strong>single product
          type</strong> (single type may qualify for a discount set by the warehouse). Submit to create a quote request; the warehouse
          will respond with a quote.
        </p>
        <ScreenshotImage
          src={screenshotImages[5].src}
          alt={screenshotImages[5].alt}
          caption={
            <>
              <strong>Request details.</strong> Choose client and approval type. Single product type can qualify for a discount.
            </>
          }
        />
      </section>

      {/* 7. Booking Requests list */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">7. Booking Requests</h2>
        <p className="text-muted-foreground">
          Under <strong>Bookings → Booking Requests</strong> you see quote requests you submitted. Each card shows summary (e.g. days,
          SKU count, single type), status badges (<strong>Pending</strong>, <strong>Requires approval</strong>), floor, owner, note,
          and date. Use <strong>Edit</strong> or <strong>Delete</strong> when allowed (e.g. company admin or requester). The warehouse
          responds with a quote; once approved, the booking can move to confirmation.
        </p>
        <ScreenshotImage
          src={screenshotImages[6].src}
          alt={screenshotImages[6].alt}
          caption={
            <>
              <strong>Booking Requests.</strong> View, edit, or delete your quote requests. Status shows Pending or Requires approval.
            </>
          }
        />
      </section>

      {/* 8. Booking Details */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">8. Booking Details</h2>
        <p className="text-muted-foreground">
          Open a booking from the Bookings list to see <strong>Booking Details</strong>. The page shows the booking ID and status
          (e.g. Pending). You see the <strong>Pallet Storage</strong> summary (quantity, price, start/end dates), <strong>Booking
          Information</strong> (type, status, pallet count, total amount), <strong>Customer Information</strong>, <strong>Warehouse
          Information</strong> (name, address, View Details), and <strong>Notes</strong> (e.g. requested drop-off date and time).
        </p>
        <ScreenshotImage
          src={screenshotImages[7].src}
          alt={screenshotImages[7].alt}
          caption={
            <>
              <strong>Booking Details.</strong> Full summary, customer, warehouse, and notes in one place.
            </>
          }
        />
      </section>

      {/* 9. Complete booking – date & time */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">9. Complete Your Booking – Date & Time</h2>
        <p className="text-muted-foreground">
          When completing a booking, <strong>Step 2 of 2</strong> is <strong>Date & Time</strong>. Select the <strong>date</strong> from
          the calendar and an <strong>available time slot</strong> (e.g. 08:00, 08:30). The right panel shows the <strong>Booking
          Summary</strong> (pallet storage, quantity, goods type, stacking, pallet dimensions, start/end dates, duration) and
          <strong> Price Breakdown</strong>. The booking is created as a pre-order with status &quot;pending&quot;; warehouse staff
          will review and confirm. Use <strong>Confirm Booking</strong> to submit.
        </p>
        <ScreenshotImage
          src={screenshotImages[8].src}
          alt={screenshotImages[8].alt}
          caption={
            <>
              <strong>Step 2: Date & Time.</strong> Pick date and time slot, review summary and price, then Confirm Booking.
            </>
          }
        />
      </section>

      {/* User types summary */}
      <section className="space-y-4 pt-8 border-t">
        <h2 className="text-2xl font-semibold border-b pb-2">User Types at a Glance</h2>
        <p className="text-muted-foreground">
          <strong>Customers</strong> (individual or corporate) search, request quotes, and book storage; corporate admins manage
          teams and can book on behalf of members. <strong>Warehouse owners/managers</strong> manage warehouses, services, bookings,
          and invoices. <strong>Warehouse staff</strong> use the same dashboard for operations. <strong>Warehouse finders</strong> use
          Map, Contacts, Visits, and Performance. <strong>Brokers</strong> manage Leads, Communications, and Proposals. <strong>Transport
          and end-delivery</strong> roles have dedicated dashboards for jobs, shipments, and documents.
        </p>
      </section>

      <section className="space-y-4 pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          For legal and policies, see <Link href="/terms" className="text-foreground underline">Terms of Service</Link> and{" "}
          <Link href="/privacy" className="text-foreground underline">Privacy Policy</Link>. For questions, use the contact
          options on the <Link href="/" className="text-foreground underline">homepage</Link>.
        </p>
      </section>
    </div>
  )
}
