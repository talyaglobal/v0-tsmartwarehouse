import { CheckCircle2 } from "@/components/icons"

const services = [
  {
    title: "Pallet Storage",
    description: "Flexible floor loading storage for all your pallet needs",
    features: [
      "Standard & oversized pallet support",
      "Multiple product type handling",
      "Weight-based pricing options",
      "Duration-based billing",
      "Real-time capacity tracking",
    ],
    price: "From $15/day",
  },
  {
    title: "Container Handling",
    description: "Full-service container loading and unloading",
    features: [
      "Up to 50 containers daily",
      "6 dedicated loading docks",
      "Professional crew included",
      "Cross-docking available",
      "Seal tracking & verification",
    ],
    price: "Custom Quote",
    highlighted: true,
  },
  {
    title: "Membership Program",
    description: "Enterprise accounts with credit-based billing",
    features: [
      "Pre-approved credit limits",
      "Volume discounts available",
      "Net-30 payment terms",
      "Priority dock scheduling",
      "Dedicated account manager",
    ],
    price: "Contact Sales",
  },
]

export function Services() {
  return (
    <section id="services" className="py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Services tailored to your needs</h2>
          <p className="text-lg text-muted-foreground text-pretty">
            Whether you need short-term storage or ongoing logistics support, we have flexible solutions for businesses
            of all sizes.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {services.map((service) => (
            <div
              key={service.title}
              className={`p-8 rounded-2xl border ${
                service.highlighted ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
              }`}
            >
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">{service.title}</h3>
                <p
                  className={`text-sm ${service.highlighted ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                >
                  {service.description}
                </p>
              </div>

              <div
                className={`text-3xl font-bold mb-6 ${
                  service.highlighted ? "text-primary-foreground" : "text-foreground"
                }`}
              >
                {service.price}
              </div>

              <ul className="space-y-3">
                {service.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckCircle2
                      className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        service.highlighted ? "text-primary-foreground" : "text-accent"
                      }`}
                    />
                    <span
                      className={`text-sm ${
                        service.highlighted ? "text-primary-foreground/90" : "text-muted-foreground"
                      }`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
