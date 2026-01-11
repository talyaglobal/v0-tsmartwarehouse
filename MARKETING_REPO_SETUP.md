# Marketing Repository Setup Guide

Bu dosya, warebnb.co için ayrı marketing repository'sinin nasıl oluşturulacağını açıklar.

## 1. GitHub Repository Oluşturma

1. GitHub'da yeni repository oluştur: `warebnb-marketing`
2. Description: "Marketing landing page for WarebnB - Smart Warehouse Solutions"
3. Public veya Private (tercihinize göre)
4. Initialize with README ✓

## 2. Local Setup

```bash
# Repository'yi clone et
git clone https://github.com/[your-username]/warebnb-marketing.git
cd warebnb-marketing

# Next.js projesi oluştur
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"

# shadcn/ui kurulumu
npx shadcn-ui@latest init
# Seçenekler:
# - Style: Default
# - Base color: Slate
# - CSS variables: Yes

# Gerekli component'leri ekle
npx shadcn-ui@latest add button card input label
```

## 3. Project Structure

```
warebnb-marketing/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Landing page
│   └── globals.css         # Tailwind styles
├── components/
│   ├── sections/
│   │   ├── hero.tsx        # Hero section
│   │   ├── features.tsx    # Features grid
│   │   ├── pricing.tsx     # Pricing cards
│   │   ├── testimonials.tsx
│   │   ├── cta.tsx         # Call to action
│   │   └── footer.tsx
│   └── ui/                 # shadcn components
├── public/
│   ├── images/
│   │   ├── hero-bg.jpg
│   │   ├── feature-1.svg
│   │   ├── feature-2.svg
│   │   └── ...
│   └── logo.svg
├── lib/
│   └── utils.ts
├── .env.production
├── next.config.js
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## 4. Environment Variables

`.env.production`:
```env
NEXT_PUBLIC_APP_URL=https://beta.warebnb.co
NEXT_PUBLIC_SITE_URL=https://warebnb.co
NEXT_PUBLIC_CONTACT_EMAIL=info@warebnb.co
```

## 5. Landing Page Content

### Hero Section
- **Headline:** "Smart Warehouse Solutions for Modern Businesses"
- **Subheadline:** "Connect with trusted warehouse spaces across Turkey. Store, manage, and scale your inventory effortlessly."
- **CTA Primary:** "Start Free Trial" → beta.warebnb.co/register
- **CTA Secondary:** "View Demo" → beta.warebnb.co/demo

### Features (6 cards)
1. **Instant Search & Booking**
   - Icon: Search
   - Description: Find and book warehouse space in minutes

2. **Verified Warehouse Network**
   - Icon: Shield
   - Description: All warehouses verified for security and quality

3. **Real-time Availability**
   - Icon: Clock
   - Description: See up-to-date availability and pricing

4. **Flexible Storage Options**
   - Icon: Package
   - Description: Pallet storage, area rental, and custom solutions

5. **Secure Payment Processing**
   - Icon: CreditCard
   - Description: Safe and reliable payment with Stripe

6. **24/7 Support**
   - Icon: Headphones
   - Description: Round-the-clock customer support

### Pricing Tiers
1. **Free**
   - Browse warehouses
   - View pricing
   - Compare options
   - CTA: "Get Started"

2. **Pro** - ₺499/month
   - Everything in Free
   - Unlimited bookings
   - Priority support
   - Advanced analytics
   - CTA: "Start Trial"

3. **Enterprise** - Custom
   - Everything in Pro
   - Dedicated account manager
   - Custom integrations
   - Volume discounts
   - CTA: "Contact Sales"

### Testimonials (Placeholder)
```typescript
const testimonials = [
  {
    quote: "WarebnB transformed how we manage our logistics. The platform is intuitive and saves us hours every week.",
    author: "Ahmet Yılmaz",
    title: "Logistics Manager",
    company: "ABC Logistics"
  },
  {
    quote: "Finding warehouse space used to be a nightmare. Now we can compare options and book in minutes.",
    author: "Elif Demir",
    title: "Operations Director",
    company: "XYZ Trading"
  }
]
```

### Footer
- **Company Info:**
  - About Us
  - Contact
  - Careers
  - Blog

- **Product:**
  - Features
  - Pricing
  - Security
  - Documentation

- **Legal:**
  - Terms of Service
  - Privacy Policy
  - Cookie Policy
  - Refund Policy

- **Social:**
  - LinkedIn
  - Twitter
  - Facebook
  - Instagram

- **Contact:**
  - Email: info@warebnb.co
  - Phone: +90 XXX XXX XX XX
  - Address: Istanbul, Turkey

## 6. SEO Metadata

`app/layout.tsx`:
```typescript
export const metadata: Metadata = {
  title: 'WarebnB - Smart Warehouse Solutions',
  description: 'Connect with trusted warehouse spaces across Turkey. Store, manage, and scale your inventory effortlessly.',
  keywords: ['warehouse', 'storage', 'logistics', 'turkey', 'depo', 'depolama'],
  authors: [{ name: 'WarebnB' }],
  openGraph: {
    title: 'WarebnB - Smart Warehouse Solutions',
    description: 'Connect with trusted warehouse spaces across Turkey.',
    url: 'https://warebnb.co',
    siteName: 'WarebnB',
    images: [
      {
        url: 'https://warebnb.co/og-image.jpg',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WarebnB - Smart Warehouse Solutions',
    description: 'Connect with trusted warehouse spaces across Turkey.',
    images: ['https://warebnb.co/twitter-image.jpg'],
  },
}
```

## 7. Vercel Deployment

1. Vercel'e giriş yap
2. "Add New Project"
3. warebnb-marketing repository'sini seç
4. Framework: Next.js (auto-detected)
5. Build Command: `npm run build`
6. Output Directory: `.next`
7. Environment Variables ekle:
   - `NEXT_PUBLIC_APP_URL=https://beta.warebnb.co`
   - `NEXT_PUBLIC_SITE_URL=https://warebnb.co`
8. Deploy

## 8. Domain Configuration

### Vercel'de:
1. Project Settings → Domains
2. Add domain: `warebnb.co`
3. Add domain: `www.warebnb.co`
4. DNS configuration bilgilerini kopyala

### Domain Provider'da:
1. A Record:
   - Type: A
   - Name: @ (root)
   - Value: 76.76.21.21 (Vercel IP)

2. CNAME Record:
   - Type: CNAME
   - Name: www
   - Value: cname.vercel-dns.com

3. TXT Record (verification):
   - Vercel'in verdiği TXT kaydını ekle

## 9. Testing Checklist

- [ ] Homepage loads correctly
- [ ] All sections visible and responsive
- [ ] CTA buttons link to beta.warebnb.co
- [ ] Mobile responsive (test 375px, 768px, 1024px, 1920px)
- [ ] Dark mode works (if implemented)
- [ ] Lighthouse score 90+ (Performance, SEO, Accessibility)
- [ ] Meta tags correct (use og-debugger)
- [ ] Favicon loads
- [ ] SSL certificate active

## 10. Performance Optimization

- [ ] Image optimization (next/image kullan)
- [ ] Lazy loading for images
- [ ] Font optimization (next/font kullan)
- [ ] Code splitting
- [ ] Minification (otomatik)
- [ ] CDN caching (Vercel otomatik)

## 11. Analytics Setup

```bash
# Vercel Analytics
npm install @vercel/analytics
```

`app/layout.tsx`:
```typescript
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

## 12. Quick Start Commands

```bash
# Development
npm run dev

# Build
npm run build

# Start production server
npm run start

# Lint
npm run lint
```

## Support

Sorular için:
- Email: tech@warebnb.co
- Main repo: v0-Warebnb'daki ekip
