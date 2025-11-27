import type { ReactNode } from 'react'

import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  )
}

