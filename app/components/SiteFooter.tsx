'use client'

import Link from 'next/link'
import { useState } from 'react'

import FooterBrand from './FooterBrand'
import ContactModal from './ContactModal'
import { NAV_SECTIONS } from '../config/nav'
import { cn } from '../lib/utils'
import { buttonVariants } from './ui/button'

const footerNav = NAV_SECTIONS.filter((item) => item.inFooter)
const year = new Date().getFullYear()

export default function SiteFooter() {
  const [contactOpen, setContactOpen] = useState(false)

  return (
    <footer className="global-footer">
      <div className="footer-row">
        <div className="footer-brand-slot">
          <FooterBrand />
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          {footerNav.map((item) => (
            <Link key={item.id} href={`#${item.id}`} className="footer-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="footer-actions">
          <button
            type="button"
            className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'footer-contact-button')}
            onClick={() => setContactOpen(true)}
          >
            Contact
          </button>
        </div>
      </div>
      <div className="footer-meta-row">
        <span>&copy; {year} Myte Group. All rights reserved.</span>
        <span className="divider">&middot;</span>
        <Link href="/legal/privacy">Privacy</Link>
        <span className="divider">&middot;</span>
        <Link href="/legal/terms">Terms</Link>
      </div>
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </footer>
  )
}
