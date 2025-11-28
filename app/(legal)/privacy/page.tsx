import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | TSmart Warehouse",
  description: "Privacy Policy for TSmart Warehouse platform - GDPR and CCPA compliant",
}

export default function PrivacyPage() {
  return (
    <main id="main-content" className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-4 text-sm text-muted-foreground">Last updated: January 1, 2025</p>

      <div className="prose prose-slate dark:prose-invert max-w-none">
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">1. Information We Collect</h2>
          <p className="text-muted-foreground">We collect information you provide directly:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Account information (name, email, phone, company)</li>
            <li>Billing and payment information</li>
            <li>Inventory and booking details</li>
            <li>Communications with our support team</li>
            <li>Usage data and analytics</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">2. How We Use Your Information</h2>
          <p className="text-muted-foreground">We use collected information to:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Provide and improve our warehouse services</li>
            <li>Process payments and send invoices</li>
            <li>Communicate about your bookings and account</li>
            <li>Ensure security and prevent fraud</li>
            <li>Comply with legal obligations</li>
            <li>Analyze usage patterns to improve our platform</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">3. Data Sharing</h2>
          <p className="text-muted-foreground">We do not sell your personal information. We may share data with:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Service providers who assist our operations</li>
            <li>Payment processors for billing</li>
            <li>Legal authorities when required by law</li>
            <li>Business partners with your consent</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">4. Data Security</h2>
          <p className="text-muted-foreground">
            We implement industry-standard security measures including encryption, access controls, and regular security
            audits. However, no method of transmission over the Internet is 100% secure.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">5. Data Retention</h2>
          <p className="text-muted-foreground">
            We retain personal data for as long as necessary to provide services and comply with legal obligations.
            Financial records are retained for 7 years. You may request deletion of your data subject to legal
            requirements.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">6. Your Rights (GDPR/CCPA)</h2>
          <p className="text-muted-foreground">You have the right to:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to data processing</li>
            <li>Data portability</li>
            <li>Withdraw consent at any time</li>
            <li>Lodge a complaint with a supervisory authority</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">7. Cookies and Tracking</h2>
          <p className="text-muted-foreground">
            We use cookies and similar technologies to enhance your experience, analyze usage, and provide personalized
            content. You can control cookie preferences through your browser settings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">8. International Data Transfers</h2>
          <p className="text-muted-foreground">
            Your data may be transferred to and processed in the United States. We ensure appropriate safeguards are in
            place for international transfers in compliance with applicable data protection laws.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">9. Children&apos;s Privacy</h2>
          <p className="text-muted-foreground">
            Our services are not intended for individuals under 18 years of age. We do not knowingly collect personal
            information from children.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">10. Contact Us</h2>
          <p className="text-muted-foreground">
            For privacy-related inquiries or to exercise your rights:
            <br />
            Data Protection Officer: privacy@tsmartwarehouse.com
            <br />
            Address: Elizabeth, NJ 07201
          </p>
        </section>
      </div>
    </main>
  )
}
