import Link from 'next/link'
import type { ReactNode } from 'react'

type Props = {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  badge?: string
}

export default function AuthShell({ title, subtitle, children, footer, badge }: Props) {
  return (
    <div className="auth-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="auth-grid">
        <section className="glass-card auth-hero">
          <div className="hero-kicker">MYTE Construction OS</div>
          <h1>Built for secure workflows and fast onboarding.</h1>
          <p>
            Log in, claim your seat, and keep projects moving with transparent audit trails, legal acceptance tracking,
            and a calm interface your team will actually enjoy.
          </p>
          <div className="hero-pills">
            <span className="pill">Session security</span>
            <span className="pill">Audit-ready</span>
            <span className="pill">Legal acceptance</span>
            <span className="pill">PII-aware</span>
          </div>
          <div className="stat-grid">
            <div className="stat-block">
              <div className="stat-label">Live seats</div>
              <div className="stat-value">Early access</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">Support</div>
              <div className="stat-value">Same-day</div>
            </div>
            <div className="stat-block">
              <div className="stat-label">Audit</div>
              <div className="stat-value">Eventized</div>
            </div>
          </div>
          <div className="hero-footnote">
            Need help? <Link href="mailto:support@myteconstruction.com">support@myteconstruction.com</Link>
          </div>
        </section>
        <section className="glass-card auth-card">
          {badge && <div className="badge">{badge}</div>}
          <h2>{title}</h2>
          {subtitle && <p className="subtitle">{subtitle}</p>}
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </section>
      </div>
    </div>
  )
}
