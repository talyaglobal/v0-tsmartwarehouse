import { Calendar, Zap, Shield, Globe, BarChart3, Bell, Clock, CreditCard } from "@/components/icons"

const features = [
  {
    icon: Calendar,
    title: "Self-Service Booking",
    description:
      "Book warehouse space 24/7 through our intuitive online portal. Real-time availability and instant confirmation.",
  },
  {
    icon: Zap,
    title: "Dynamic Pricing",
    description: "Transparent pricing based on product type, pallet size, weight, and duration. No hidden fees.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "24/7 surveillance, access control, and comprehensive incident management to protect your goods.",
  },
  {
    icon: Globe,
    title: "API Integration",
    description: "Connect your systems with our RESTful API. Webhooks for real-time updates on bookings and events.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description: "Track capacity utilization, revenue, and SLA performance with comprehensive reporting tools.",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description: "Multi-channel alerts via email, WhatsApp, and SMS. Stay informed about booking status and incidents.",
  },
  {
    icon: Clock,
    title: "Real-Time Tracking",
    description: "Live updates on task progress, worker check-ins, and dock availability throughout operations.",
  },
  {
    icon: CreditCard,
    title: "Flexible Payments",
    description: "Pay by credit card or membership credit. QuickBooks integration for seamless accounting.",
  },
]

export function Features() {
  return (
    <section id="features" className="py-20 lg:py-32 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Everything you need to manage warehousing
          </h2>
          <p className="text-lg text-muted-foreground text-pretty">
            From booking to billing, our platform provides comprehensive tools for customers, administrators, and
            warehouse workers.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
