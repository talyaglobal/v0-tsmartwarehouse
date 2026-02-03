"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Warehouse,
  Package,
  Truck,
  CheckCircle,
  ArrowRight,
  Building2,
  MapPin,
  Phone,
  Mail,
  Shield,
  Clock,
  Users,
  Zap,
  BarChart3,
  Globe,
  ChevronRight,
  Sparkles,
  Search,
  Star,
} from "lucide-react"
import { useUser } from "@/lib/hooks/use-user"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { BookingSearchForm } from "@/components/home/booking-search-form"

// Animated counter component
function AnimatedCounter({ end, suffix = "", prefix = "" }: { end: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0)
  
  useEffect(() => {
    const duration = 2000
    const steps = 60
    const increment = end / steps
    let current = 0
    
    const timer = setInterval(() => {
      current += increment
      if (current >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)
    
    return () => clearInterval(timer)
  }, [end])
  
  return <span>{prefix}{count.toLocaleString()}{suffix}</span>
}

export default function HomePage() {
  const { user } = useUser()
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])
  
  return (
    <div className="flex min-h-screen flex-col bg-background overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="p-2 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 transition-all duration-300 group-hover:scale-105">
              <Warehouse className="h-5 w-5 text-amber-600" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Warebnb</span>
          </Link>
          
          <nav className="hidden lg:flex items-center gap-1">
            {[
              { href: "#services", label: "Services" },
              { href: "#how-it-works", label: "How It Works" },
              { href: "#features", label: "Features" },
              { href: "#contact", label: "Contact" },
            ].map((item) => (
              <a 
                key={item.href}
                href={item.href} 
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent"
              >
                {item.label}
              </a>
            ))}
          </nav>
          
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard">
                <Button className="gap-2">
                  Dashboard <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" className="hidden sm:flex">Sign In</Button>
                </Link>
                <Link href="/register">
                  <Button className="gap-2 shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 transition-all duration-300 bg-amber-500 hover:bg-amber-600">
                    Get Started <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Search Section */}
        <section id="search" className="relative bg-gradient-to-b from-amber-500/5 via-amber-500/5 to-transparent py-8 border-b scroll-mt-16">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <BookingSearchForm compact={true} />
            </div>
          </div>
        </section>

        {/* Hero Section */}
        <section className="relative min-h-[80vh] flex items-center overflow-hidden">
          {/* Background Elements */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-background to-yellow-500/5" />
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-yellow-500/10 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
          
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
          
          <div className="container mx-auto relative px-4 py-20 lg:py-32">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left Content */}
              <div className={cn(
                "space-y-8 transition-all duration-1000 transform",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              )}>
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-600">The Future of Warehouse Storage</span>
                </div>
                
                {/* Headline */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                  Find Your Perfect
                  <span className="block mt-2 bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 bg-clip-text text-transparent">
                    Warehouse Space
                  </span>
                </h1>
                
                {/* Description */}
                <p className="text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed">
                  Connect with verified warehouse owners. Book storage space instantly. 
                  Scale your business with flexible, secure, and affordable solutions.
                </p>
                
                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/register">
                    <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-base gap-2 shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 transition-all duration-300 hover:scale-105 bg-amber-500 hover:bg-amber-600">
                      Start Free Today <ArrowRight className="h-5 w-5" />
                    </Button>
                  </Link>
                  <a href="#search">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base gap-2 border-2 hover:bg-accent hover:border-amber-500/50 transition-all duration-300">
                      <Search className="h-5 w-5" /> Browse Warehouses
                    </Button>
                  </a>
                </div>
                
                {/* Trust indicators */}
                <div className="flex flex-wrap items-center gap-6 pt-4">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {[1,2,3,4,5].map((i) => (
                        <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border-2 border-background flex items-center justify-center">
                          <Users className="h-3 w-3 text-amber-600" />
                        </div>
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      <strong className="text-foreground">500+</strong> businesses trust us
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[1,2,3,4,5].map((i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                    <span className="text-sm text-muted-foreground ml-1">4.9/5 rating</span>
                  </div>
                </div>
              </div>
              
              {/* Right Content - Hero Image/Visual */}
              <div className={cn(
                "relative transition-all duration-1000 delay-300 transform",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              )}>
                <div className="relative aspect-square max-w-lg mx-auto">
                  {/* Main card */}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-orange-500/20 border border-white/10 backdrop-blur-xl shadow-2xl">
                    <div className="absolute inset-4 rounded-2xl bg-background/80 backdrop-blur-sm border overflow-hidden">
                      <Image
                        src="/warehouse-aerial.png"
                        alt="Modern warehouse facility"
                        fill
                        className="object-cover"
                        priority
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                    </div>
                  </div>
                  
                  {/* Floating cards */}
                  <div className="absolute -left-8 top-1/4 p-4 rounded-xl bg-background/95 backdrop-blur border shadow-xl animate-float">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Booking Confirmed</p>
                        <p className="font-semibold text-sm">50 Pallets Reserved</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="absolute -right-8 top-1/2 p-4 rounded-xl bg-background/95 backdrop-blur border shadow-xl animate-float-delayed">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <BarChart3 className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">This Month</p>
                        <p className="font-semibold text-sm">+24% Storage</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="absolute left-1/4 -bottom-4 p-4 rounded-xl bg-background/95 backdrop-blur border shadow-xl animate-float">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Globe className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Locations</p>
                        <p className="font-semibold text-sm">50+ Cities</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 border-y bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: 240, suffix: "K+", label: "Sq Ft Available", icon: Building2 },
                { value: 500, suffix: "+", label: "Active Clients", icon: Users },
                { value: 50, suffix: "+", label: "Cities Covered", icon: MapPin },
                { value: 99, suffix: "%", label: "Satisfaction Rate", icon: Star },
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 mb-4">
                    <stat.icon className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                    <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4">Our Services</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Comprehensive Warehouse Solutions</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need for your storage requirements
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
              <div className="group p-8 rounded-2xl bg-background border hover:border-amber-500/50 hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg">
                  <Package className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Pallet Storage</h3>
                <p className="text-muted-foreground mb-4">Secure pallet storage with flexible terms. Pay only for what you use.</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Flexible storage terms
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Pay only for what you use
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Competitive pricing
                  </li>
                </ul>
              </div>

              <div className="group p-8 rounded-2xl bg-background border-2 border-amber-500 hover:shadow-xl transition-all duration-500 hover:-translate-y-1 relative">
                <Badge className="absolute -top-3 left-6 bg-amber-500 hover:bg-amber-600">Popular</Badge>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br from-amber-500 to-yellow-500 shadow-lg">
                  <Building2 className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Space Storage</h3>
                <p className="text-muted-foreground mb-4">Dedicated warehouse space for large-scale operations.</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Custom pricing from owners
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Dedicated space
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Long-term contracts
                  </li>
                </ul>
              </div>

              <div className="group p-8 rounded-2xl bg-background border hover:border-amber-500/50 hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br from-yellow-500 to-orange-500 shadow-lg">
                  <Truck className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Logistics Support</h3>
                <p className="text-muted-foreground mb-4">Full-service receiving and shipping operations.</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Loading dock access
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Forklift services
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Inventory management
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-24 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-500/5 to-transparent rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          
          <div className="container mx-auto px-4 relative">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4">Simple Process</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Get started in minutes with our streamlined booking process
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  step: 1,
                  title: "Search & Compare",
                  description: "Browse warehouses by location, size, and amenities. Compare prices from multiple verified owners.",
                  icon: Globe,
                  gradient: "from-amber-400 to-amber-500",
                },
                {
                  step: 2,
                  title: "Book Instantly",
                  description: "Select your dates, choose your space type, and book securely online. No hidden fees.",
                  icon: Zap,
                  gradient: "from-amber-500 to-yellow-500",
                },
                {
                  step: 3,
                  title: "Start Storing",
                  description: "Deliver your goods at the scheduled time. Manage everything from your dashboard.",
                  icon: Package,
                  gradient: "from-yellow-500 to-orange-500",
                },
              ].map((item, index) => (
                <div key={index} className="relative group">
                  {/* Connector line */}
                  {index < 2 && (
                    <div className="hidden md:block absolute top-16 left-1/2 w-full h-0.5 bg-gradient-to-r from-border via-amber-500/30 to-border" />
                  )}
                  
                  <div className="relative bg-card rounded-2xl border p-8 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-500 group-hover:-translate-y-2">
                    {/* Step number */}
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br shadow-lg",
                      item.gradient
                    )}>
                      <item.icon className="h-7 w-7 text-white" />
                    </div>
                    
                    <div className="absolute top-6 right-6 text-6xl font-bold text-muted/10">
                      {item.step}
                    </div>
                    
                    <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4">Why Choose Us</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Powerful features designed for modern businesses
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {[
                {
                  icon: Shield,
                  title: "Secure Storage",
                  description: "24/7 security monitoring, CCTV coverage, and access control for your peace of mind.",
                  gradient: "from-amber-400 to-amber-500",
                },
                {
                  icon: Zap,
                  title: "Instant Booking",
                  description: "Book warehouse space in minutes. No lengthy negotiations or paperwork.",
                  gradient: "from-amber-500 to-yellow-500",
                },
                {
                  icon: BarChart3,
                  title: "Real-time Analytics",
                  description: "Track your storage usage, costs, and inventory with detailed dashboards.",
                  gradient: "from-yellow-500 to-orange-500",
                },
                {
                  icon: Clock,
                  title: "Flexible Terms",
                  description: "Daily, weekly, or monthly storage. Scale up or down as your needs change.",
                  gradient: "from-orange-500 to-amber-500",
                },
                {
                  icon: Truck,
                  title: "Logistics Support",
                  description: "Loading docks, forklifts, and receiving services available at most locations.",
                  gradient: "from-yellow-600 to-amber-600",
                },
                {
                  icon: Users,
                  title: "Dedicated Support",
                  description: "Expert team ready to help you find the perfect storage solution.",
                  gradient: "from-amber-600 to-orange-600",
                },
              ].map((feature, index) => (
                <div 
                  key={index} 
                  className="group p-6 rounded-2xl bg-background border hover:border-amber-500/50 hover:shadow-xl transition-all duration-500 hover:-translate-y-1"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br transition-transform duration-300 group-hover:scale-110",
                    feature.gradient
                  )}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-500" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />
          
          <div className="container mx-auto px-4 relative">
            <div className="max-w-3xl mx-auto text-center text-white">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Ready to Transform Your Storage?
              </h2>
              <p className="text-lg md:text-xl opacity-90 mb-10">
                Join thousands of businesses already using Warebnb to simplify their warehouse operations.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button size="lg" variant="secondary" className="h-14 px-8 text-base gap-2 hover:scale-105 transition-transform">
                    Get Started Free <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <a href="#search">
                  <Button size="lg" className="h-14 px-8 text-base bg-white/10 border-2 border-white/40 text-white hover:bg-white/20 hover:border-white/60 transition-all duration-300 backdrop-blur-sm">
                    <Search className="h-5 w-5 mr-2" /> Browse Warehouses
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4">Contact Us</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Get in Touch</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Have questions? Our team is here to help.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                {
                  icon: MapPin,
                  title: "Visit Us",
                  lines: ["123 Warehouse District", "New York, NY 10001"],
                },
                {
                  icon: Phone,
                  title: "Call Us",
                  lines: ["+1 (646) 207-7483", "Mon-Fri 9am-6pm EST"],
                },
                {
                  icon: Mail,
                  title: "Email Us",
                  lines: ["info@warebnb.com", "support@warebnb.com"],
                },
              ].map((contact, index) => (
                <div key={index} className="text-center p-8 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 mb-4">
                    <contact.icon className="h-7 w-7 text-amber-600" />
                  </div>
                  <h3 className="font-semibold mb-3">{contact.title}</h3>
                  {contact.lines.map((line, lineIndex) => (
                    <p key={lineIndex} className="text-sm text-muted-foreground">{line}</p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <div className="grid gap-8 md:grid-cols-4">
            {/* Brand */}
            <div>
              <Link href="/" className="flex items-center gap-2.5 mb-4">
                <div className="p-2 rounded-xl bg-amber-500/10">
                  <Warehouse className="h-5 w-5 text-amber-600" />
                </div>
                <span className="text-xl font-bold">Warebnb</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                Professional warehouse storage solutions for businesses of all sizes.
              </p>
            </div>

            {/* Services */}
            <div>
              <h4 className="font-semibold mb-4">Services</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Pallet Storage
                  </a>
                </li>
                <li>
                  <a href="#services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Space Storage
                  </a>
                </li>
                <li>
                  <a href="#services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Logistics Support
                  </a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/how-to-use" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    How to Use
                  </Link>
                </li>
                <li>
                  <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Warebnb. All rights reserved.
          </div>
        </div>
      </footer>

      {/* CSS for floating animation */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float 3s ease-in-out infinite;
          animation-delay: 1.5s;
        }
      `}</style>
    </div>
  )
}
