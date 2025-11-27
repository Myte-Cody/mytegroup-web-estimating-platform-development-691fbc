import Link from 'next/link'

import FooterBrand from './FooterBrand'
import { NAV_SECTIONS } from '../config/nav'

const footerNav = NAV_SECTIONS.filter((item) => item.inFooter)
const year = new Date().getFullYear()

export default function SiteFooter() {
  return (
    <footer className="global-footer">
      <FooterBrand />
      <div className="footer-right">
        <nav className="footer-links" aria-label="Footer navigation">
          {footerNav.map((item) => (
            <Link key={item.id} href={`#${item.id}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="footer-meta">© {year} Myte Group. All rights reserved.</div>
      </div>
    </footer>
  )
}
