import './globals.css'

import type { Metadata } from 'next'

import SiteFooter from './components/SiteFooter'
import SiteHeader from './components/SiteHeader'
import { siteUrl, domainConfig } from './config/domain'

const title = 'MYTE Sovereign OS | Structural Steel'
const description =
  'A sovereign OS for structural steel: open the code, keep humans in control, and capture knowledge across estimating, detailing, fabrication, and erection.'
const canonicalUrl = siteUrl
const ogImage = '/og/structural-steel-os.png'

export const metadata: Metadata = {
  metadataBase: new URL(canonicalUrl),
  title,
  description,
  applicationName: 'MYTE Sovereign OS',
  alternates: {
    canonical: '/',
  },
  keywords: ['structural steel OS', 'sovereign stack', 'human in the loop', 'estimating', 'fabrication', 'erection'],
  openGraph: {
    title,
    description,
    url: canonicalUrl,
    siteName: 'MYTE Sovereign OS',
    type: 'website',
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: 'MYTE Sovereign OS for Structural Steel',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Myte Group',
      url: canonicalUrl,
      logo: `${canonicalUrl}/favicon.png`,
      sameAs: [
        'https://www.linkedin.com/company/myte-group/',
        'https://x.com/mytegroup',
        'https://www.facebook.com/mytegroup',
      ],
      contactPoint: [
        {
          '@type': 'ContactPoint',
          contactType: 'sales',
          email: 'info@mytegroup.ai',
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'MYTE Sovereign OS for Structural Steel',
      description:
        'A sovereign OS for structural steel with human-in-the-loop intelligence across estimating, detailing, fabrication, and erection.',
      brand: 'Myte',
      url: canonicalUrl,
      image: `${canonicalUrl}${ogImage}`,
      offers: [
        {
          '@type': 'Offer',
          price: 0,
          priceCurrency: 'USD',
          description: 'Hosted starter with 5 free seats and included AI actions.',
        },
        {
          '@type': 'Offer',
          price: 55000,
          priceCurrency: 'USD',
          description: 'Sovereign source license for full code, domain, and infra control.',
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Do we own the code and data?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'With the sovereign license, yes. You control the codebase, infrastructure, and data for your instance.',
          },
        },
        {
          '@type': 'Question',
          name: 'Does AI replace our team?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No. AI assists; humans approve. Approvals and critical decisions always sit with your experts.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can we prevent knowledge loss when people leave?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Workflows and decisions are captured, searchable, and reusable.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can we collaborate across companies and still stay sovereign?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Each organization keeps its own data and can opt into shared workflows with fine-grained access.',
          },
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How MYTE Sovereign OS works',
      description: 'Blueprint the roles and guardrails, build and wire intelligence, then handoff with sovereignty.',
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: 'Blueprint',
          text: 'We map roles, workflows, and guardrails. You decide where AI can help and where humans must always approve.',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: 'Build & Wire Intelligence',
          text: 'We stand up the OS, connect your data, and configure human-in-the-loop checkpoints across estimating, detailing, fabrication, erection, and compliance.',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: 'Handoff & Grow',
          text: 'You own the repo, infra, and keys. Extend with your team or have us manage a fork while you keep sovereignty.',
        },
      ],
    },
  ]

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </head>

      <body className="app-body">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
