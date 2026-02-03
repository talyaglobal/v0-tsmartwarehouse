import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "How to Use",
  description: "Learn how the Warebnb platform works for all user types: customers, warehouse owners, staff, brokers, and transport partners.",
}

export default function HowToUsePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">How to Use Warebnb</h1>
        <p className="text-muted-foreground">
          A guide to the platform for every user type. Last updated: February 2026.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b pb-2">Overview</h2>
        <p className="text-muted-foreground">
          Warebnb is a warehouse storage and logistics platform. It connects <strong>customers</strong> who need storage
          and services with <strong>warehouse operators</strong> who provide space, and with <strong>partners</strong> such
          as brokers, transport companies, and end-delivery parties. The system supports individual users and corporate
          companies with teams.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b pb-2">Getting Started</h2>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>Go to the <Link href="/" className="text-foreground underline">homepage</Link> and sign up or log in.</li>
          <li>Choose the registration flow that matches your role (customer, warehouse owner, broker, etc.).</li>
          <li>After email verification, you will land in your <strong>Dashboard</strong> with role-specific menus and features.</li>
        </ul>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold border-b pb-2">By User Type</h2>

        <div className="rounded-lg border bg-card p-4 space-y-2">
          <h3 className="font-semibold">System Admin (Root)</h3>
          <p className="text-sm text-muted-foreground">
            Full access to the platform. You can manage companies, users, warehouses, bookings, invoices, and system
            settings. Use the <strong>Admin</strong> panel for user management, analytics, audit logs, and global
            configuration. You can also impersonate other roles for testing via the role selector.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-2">
          <h3 className="font-semibold">Warehouse Owner (Warehouse Admin)</h3>
          <p className="text-sm text-muted-foreground">
            You own or operate one or more warehouses. From the dashboard you can: create and edit <strong>warehouses</strong> (address,
            capacity, floor plans); manage <strong>services</strong> and pricing; handle <strong>bookings</strong> and
            <strong>orders</strong>; view the <strong>calendar</strong>; issue and manage <strong>invoices</strong>; and
            handle <strong>claims</strong>. You also manage <strong>membership</strong> and <strong>settings</strong> for
            your organization.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-2">
          <h3 className="font-semibold">Warehouse Manager (Warehouse Supervisor)</h3>
          <p className="text-sm text-muted-foreground">
            Same core capabilities as the warehouse owner for day-to-day operations: manage warehouses, services, bookings,
            orders, calendar, invoices, claims, and notifications. Use the dashboard to coordinate with customers and
            staff.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-2">
          <h3 className="font-semibold">Customer (Warehouse Client)</h3>
          <p className="text-sm text-muted-foreground">
            You need storage or logistics services. You can be <strong>individual</strong> or <strong>corporate</strong>.
            From the dashboard: search and discover warehouses (<strong>Find Warehouses</strong>), create <strong>booking
            requests</strong> or <strong>book directly</strong>, view your <strong>bookings</strong> and <strong>calendar</strong>,
            and submit <strong>claims</strong> if needed. Corporate customers have <strong>My Organization</strong> (or My
            Company) to manage teams and team members; admins can add members, create teams, and book on behalf of others
            (with optional approval). Invoices and membership may appear depending on your company setup.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-2">
          <h3 className="font-semibold">Warehouse Staff</h3>
          <p className="text-sm text-muted-foreground">
            You work at a warehouse. Your dashboard gives access to warehouses, services, orders, bookings, calendar,
            invoices, claims, and notifications so you can perform operational tasks assigned by managers or owners.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-2">
          <h3 className="font-semibold">Warehouse Finder (Scout)</h3>
          <p className="text-sm text-muted-foreground">
            You find new warehouses for the platform (e.g. for commission). Use the <strong>Warehouse Finder</strong> area:
            <strong>Map</strong> for location-based discovery, <strong>Contacts</strong> to manage leads, <strong>Visits</strong>
            to log and track site visits, and <strong>Performance</strong> to see your metrics. Your pipeline and approvals
            may be managed by admins.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-2">
          <h3 className="font-semibold">Reseller (Warehouse Broker)</h3>
          <p className="text-sm text-muted-foreground">
            You sell or refer customers to the platform. From the dashboard: manage <strong>Leads</strong>, use
            <strong>Communications</strong> for outreach, create and track <strong>Proposals</strong>, and view
            <strong>Performance</strong> and commissions. Your role is focused on customer acquisition and
            relationship management.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-2">
          <h3 className="font-semibold">End Delivery Party</h3>
          <p className="text-sm text-muted-foreground">
            You are the company that receives products from the warehouse (e.g. final delivery). Your dashboard shows
            <strong>Shipments</strong> and <strong>History</strong> so you can coordinate pickups and confirm
            deliveries. Settings are available for your profile and preferences.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-2">
          <h3 className="font-semibold">Local Transport Company</h3>
          <p className="text-sm text-muted-foreground">
            You handle domestic shipping. The dashboard gives you <strong>Jobs</strong>, <strong>Drivers</strong>,
            <strong>Vehicles</strong>, and <strong>Schedule</strong> to manage local transport operations linked to
            warehouse bookings and orders.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-2">
          <h3 className="font-semibold">International Transport Company</h3>
          <p className="text-sm text-muted-foreground">
            You handle cross-border shipping. Your dashboard includes <strong>Shipments</strong>, <strong>Customs</strong>,
            and <strong>Documents</strong> to manage international logistics and compliance.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b pb-2">Common Flows</h2>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Booking storage:</strong> Customer goes to Bookings → New, chooses for self or on behalf of a team member, searches for warehouses, selects a warehouse and services, and completes the booking (and payment if required).</li>
          <li><strong>Managing a team (corporate):</strong> Go to My Organization → Team Members. Add members, create teams, invite by email, or add partner companies. Team admins can rename or delete teams (default team or teams with admin members cannot be deleted until members are moved).</li>
          <li><strong>Warehouse operations:</strong> Owner or manager creates warehouses and services; customers book; staff and managers handle orders, calendar, and invoices; claims can be submitted and processed from the Claims area.</li>
        </ul>
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
