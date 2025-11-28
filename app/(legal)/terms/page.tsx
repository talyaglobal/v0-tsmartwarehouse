import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service | TSmart Warehouse",
  description: "Terms of Service for TSmart Warehouse platform",
}

export default function TermsPage() {
  return (
    <main id="main-content" className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold">Terms of Service</h1>
      <p className="mb-4 text-sm text-muted-foreground">Last updated: January 1, 2025</p>

      <div className="prose prose-slate dark:prose-invert max-w-none">
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground">
            By accessing or using TSmart Warehouse services, you agree to be bound by these Terms of Service and all
            applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using
            or accessing this service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">2. Service Description</h2>
          <p className="text-muted-foreground">
            TSmart Warehouse provides warehouse management services including but not limited to storage, inventory
            management, fulfillment, and logistics coordination. We reserve the right to modify, suspend, or discontinue
            any aspect of our services at any time.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">3. User Accounts</h2>
          <p className="text-muted-foreground">
            You are responsible for maintaining the confidentiality of your account credentials and for all activities
            that occur under your account. You must notify us immediately of any unauthorized use of your account.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">4. Acceptable Use</h2>
          <p className="text-muted-foreground">You agree not to:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Use the service for any unlawful purpose</li>
            <li>Store prohibited, hazardous, or illegal items</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Interfere with or disrupt the service</li>
            <li>Violate any applicable laws or regulations</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">5. Liability and Insurance</h2>
          <p className="text-muted-foreground">
            TSmart Warehouse maintains comprehensive insurance coverage for stored items. Liability is limited to the
            declared value of items at the time of booking. Customers are encouraged to maintain additional insurance
            for high-value items.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">6. Payment Terms</h2>
          <p className="text-muted-foreground">
            Payment is due according to the terms specified in your service agreement. Late payments may result in
            service suspension and additional fees. We reserve the right to exercise a lien on stored items for unpaid
            charges.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">7. Termination</h2>
          <p className="text-muted-foreground">
            Either party may terminate services with 30 days written notice. Upon termination, you must remove all
            stored items and settle any outstanding balances.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">8. Dispute Resolution</h2>
          <p className="text-muted-foreground">
            Any disputes arising from these terms shall be resolved through binding arbitration in accordance with the
            rules of the American Arbitration Association. The arbitration shall take place in New Jersey, USA.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">9. Contact Information</h2>
          <p className="text-muted-foreground">
            For questions about these Terms of Service, please contact us at:
            <br />
            Email: legal@tsmartwarehouse.com
            <br />
            Address: Elizabeth, NJ 07201
          </p>
        </section>
      </div>
    </main>
  )
}
