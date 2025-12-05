import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import {
  Warehouse,
  Package,
  Truck,
  CheckCircle,
  ArrowRight,
  Building2,
  Layers,
  MapPin,
  Phone,
  Mail,
} from "@/components/icons"
import { PRICING, WAREHOUSE_CONFIG } from "@/lib/constants"
import { formatCurrency, formatNumber } from "@/lib/utils/format"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Warehouse className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">TSmart Warehouse</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#services" className="text-sm font-medium hover:text-primary transition-colors">
              Services
            </Link>
            <Link href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">
              Pricing
            </Link>
            <Link href="#facility" className="text-sm font-medium hover:text-primary transition-colors">
              Facility
            </Link>
            <Link href="#contact" className="text-sm font-medium hover:text-primary transition-colors">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 md:py-32 overflow-hidden min-h-[calc(100vh-4rem)] flex items-center">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
          <div className="container relative w-full">
            <div className="mx-auto max-w-4xl text-center">
              <Badge variant="outline" className="mb-4">
                240,000 sq ft of Premium Storage Space
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                Professional Warehouse
                <span className="text-primary"> Storage Solutions</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                Secure, scalable, and smart warehouse management for businesses of all sizes. From pallet storage to
                full area rentals, we have the perfect solution for your needs.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register">
                  <Button size="lg" className="gap-2">
                    Start Storing Today <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#pricing">
                  <Button size="lg" variant="outline">
                    View Pricing
                  </Button>
                </Link>
              </div>
              {/* Quick Pricing */}
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
                <Card className="text-center">
                  <CardContent className="pt-6">
                    <div className="text-3xl font-bold text-primary">{formatCurrency(PRICING.palletIn)}</div>
                    <div className="text-sm text-muted-foreground">Pallet In</div>
                  </CardContent>
                </Card>
                <Card className="text-center border-primary">
                  <CardContent className="pt-6">
                    <div className="text-3xl font-bold text-primary">
                      {formatCurrency(PRICING.storagePerPalletPerMonth)}
                    </div>
                    <div className="text-sm text-muted-foreground">Per Pallet/Month</div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="pt-6">
                    <div className="text-3xl font-bold text-primary">{formatCurrency(PRICING.palletOut)}</div>
                    <div className="text-sm text-muted-foreground">Pallet Out</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className="py-20 bg-muted/50">
          <div className="container">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Our Services</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Comprehensive warehouse solutions for your business</p>
            </div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
              <Card>
                <CardHeader>
                  <Package className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Pallet Storage</CardTitle>
                  <CardDescription>
                    Secure pallet storage with flexible terms. Pay only for what you use.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      {formatCurrency(PRICING.palletIn)} per pallet in
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      {formatCurrency(PRICING.storagePerPalletPerMonth)}/month storage
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      {formatCurrency(PRICING.palletOut)} per pallet out
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-primary">
                <CardHeader>
                  <Building2 className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Area Rental</CardTitle>
                  <Badge className="w-fit">Level 3 Exclusive</Badge>
                  <CardDescription>Dedicated warehouse space for large-scale operations.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      {formatCurrency(PRICING.areaRentalPerSqFtPerYear)}/sq ft/year
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Min {formatNumber(PRICING.areaRentalMinSqFt)} sq ft
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Dedicated space on Level 3
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Truck className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Logistics Support</CardTitle>
                  <CardDescription>Full-service receiving and shipping operations.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Loading dock access
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Forklift services
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Inventory management
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Facility Section */}
        <section id="facility" className="py-20">
          <div className="container">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Our Facility</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {formatNumber(WAREHOUSE_CONFIG.totalSqFt)} sq ft of modern warehouse space
              </p>
            </div>

            <div className="mb-16 max-w-6xl mx-auto">
              <Card className="overflow-hidden">
                <div className="relative aspect-[16/9] md:aspect-[21/9]">
                  <Image
                    src="/warehouse-aerial.png"
                    alt="TSmart Warehouse aerial view - Myrtle St location"
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-5 w-5" />
                      <span className="font-semibold">Myrtle St Location</span>
                    </div>
                    <p className="text-sm text-white/80">
                      240,000 sq ft facility with easy highway access and multiple loading docks
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Floor Layout */}
            <div className="grid gap-8 md:grid-cols-3 mb-16 max-w-6xl mx-auto">
              {WAREHOUSE_CONFIG.floors.map((floor) => (
                <Card key={floor.id} className={floor.floorNumber === 3 ? "border-primary" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Layers className="h-8 w-8 text-primary" />
                      {floor.floorNumber === 3 && <Badge>Area Rental</Badge>}
                    </div>
                    <CardTitle>{floor.name}</CardTitle>
                    <CardDescription>{formatNumber(floor.totalSqFt)} sq ft total</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {floor.halls.map((hall) => (
                        <div key={hall.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                          <div>
                            <div className="font-medium">Hall {hall.hallName}</div>
                            <div className="text-sm text-muted-foreground">{formatNumber(hall.sqFt)} sq ft</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-green-600">
                              {formatNumber(hall.availableSqFt)} available
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Amenities */}
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="text-center">Facility Amenities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {WAREHOUSE_CONFIG.amenities.map((amenity) => (
                    <div key={amenity} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{amenity}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 bg-muted/50">
          <div className="container">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">No hidden fees. Pay only for what you use.</p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
              {/* Pallet Storage Pricing */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Pallet Storage
                  </CardTitle>
                  <CardDescription>Perfect for businesses of all sizes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Pallet In</span>
                      <span className="font-bold">{formatCurrency(PRICING.palletIn)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Monthly Storage</span>
                      <span className="font-bold">{formatCurrency(PRICING.storagePerPalletPerMonth)}/pallet</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Pallet Out</span>
                      <span className="font-bold">{formatCurrency(PRICING.palletOut)}</span>
                    </div>
                  </div>
                  <div className="pt-4">
                    <div className="text-sm font-medium mb-2">Volume Discounts:</div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {PRICING.volumeDiscounts.map((discount) => (
                        <li key={discount.palletThreshold}>
                          {discount.palletThreshold}+ pallets: {discount.discountPercent}% off
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link href="/register">
                    <Button className="w-full">Get Started</Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Area Rental Pricing */}
              <Card className="border-primary">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Area Rental
                    </CardTitle>
                    <Badge>Level 3</Badge>
                  </div>
                  <CardDescription>Dedicated space for large operations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Annual Rate</span>
                      <span className="font-bold">{formatCurrency(PRICING.areaRentalPerSqFtPerYear)}/sq ft</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Minimum Area</span>
                      <span className="font-bold">{formatNumber(PRICING.areaRentalMinSqFt)} sq ft</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Starting From</span>
                      <span className="font-bold">
                        {formatCurrency(PRICING.areaRentalMinSqFt * PRICING.areaRentalPerSqFtPerYear)}/year
                      </span>
                    </div>
                  </div>
                  <div className="pt-4">
                    <div className="text-sm font-medium mb-2">Includes:</div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Dedicated space on Level 3</li>
                      <li>• 24/7 access</li>
                      <li>• Climate control</li>
                      <li>• Security monitoring</li>
                    </ul>
                  </div>
                  <Link href="/register">
                    <Button className="w-full" variant="default">
                      Contact Sales
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-20">
          <div className="container">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Contact Us</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Get in touch with our team</p>
            </div>
            <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
              <Card className="text-center">
                <CardContent className="pt-6">
                  <MapPin className="h-8 w-8 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold">Address</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {WAREHOUSE_CONFIG.address}
                    <br />
                    {WAREHOUSE_CONFIG.city}, {WAREHOUSE_CONFIG.state} {WAREHOUSE_CONFIG.zipCode}
                  </p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-6">
                  <Phone className="h-8 w-8 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold">Phone</h3>
                  <p className="text-sm text-muted-foreground mt-2">+1 (646) 207-7483</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-6">
                  <Mail className="h-8 w-8 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold">Email</h3>
                  <p className="text-sm text-muted-foreground mt-2">info@tsmartwarehouse.com</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <Link href="/" className="flex items-center gap-2 mb-4">
                <Warehouse className="h-6 w-6 text-primary" />
                <span className="font-bold">TSmart Warehouse</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                Professional warehouse storage solutions for businesses of all sizes.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Services</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="#services" className="hover:text-foreground">
                    Pallet Storage
                  </Link>
                </li>
                <li>
                  <Link href="#services" className="hover:text-foreground">
                    Area Rental
                  </Link>
                </li>
                <li>
                  <Link href="#services" className="hover:text-foreground">
                    Logistics Support
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="#facility" className="hover:text-foreground">
                    Our Facility
                  </Link>
                </li>
                <li>
                  <Link href="#pricing" className="hover:text-foreground">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="#contact" className="hover:text-foreground">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/terms" className="hover:text-foreground">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-foreground">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/admin" className="hover:text-foreground">
                    Admin
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} TSmart Warehouse. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
