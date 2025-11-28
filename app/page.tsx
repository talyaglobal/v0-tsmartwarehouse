import { Header } from "@/components/landing/header"
import { Hero } from "@/components/landing/hero"
import { Features } from "@/components/landing/features"
import { Services } from "@/components/landing/services"
import { Contact } from "@/components/landing/contact"
import { Footer } from "@/components/landing/footer"

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Services />
        <Features />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}
