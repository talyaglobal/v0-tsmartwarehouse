import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, MapPin, Boxes, Container } from "@/components/icons"

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <MapPin className="w-4 h-4" />
            <span>5 Miles from NJ Port, Elizabeth</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-balance mb-6">
            Professional Warehouse
            <br />
            <span className="text-primary">Management Made Simple</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 text-pretty">
            Self-service booking, real-time capacity tracking, and enterprise-grade management tools for your storage
            needs. 1.2M sqft facility ready to serve you.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/register">
                Start Booking Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent" asChild>
              <Link href="#contact">Contact Sales</Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-foreground">1.2M</div>
              <div className="text-sm text-muted-foreground mt-1">Sq Ft Facility</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-foreground">1,000</div>
              <div className="text-sm text-muted-foreground mt-1">Pallet Capacity</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-foreground">50</div>
              <div className="text-sm text-muted-foreground mt-1">Daily Containers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-foreground">6</div>
              <div className="text-sm text-muted-foreground mt-1">Loading Docks</div>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-2 gap-4 mt-16 max-w-4xl mx-auto">
          <div className="flex items-start gap-4 p-6 rounded-xl bg-card border border-border">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Boxes className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Pallet Storage</h3>
              <p className="text-sm text-muted-foreground">
                Flexible storage solutions for standard and oversized pallets with dynamic pricing based on product
                type.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-6 rounded-xl bg-card border border-border">
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Container className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Container Handling</h3>
              <p className="text-sm text-muted-foreground">
                Full container unloading and loading services with dedicated dock assignments and professional crew.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
