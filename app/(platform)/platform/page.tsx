'use client'

import Link from 'next/link'

import { buttonVariants } from '../../components/ui/button'

export default function PlatformHomePage() {
  return (
    <section className="dashboard-grid">
      <section className="glass-card space-y-3">
        <div className="badge">Platform portal</div>
        <h1>Platform Ops</h1>
        <p className="subtitle">
          Review inbound requests (waitlist + inquiries), approve who gets access, and keep the entry pipeline tight.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/platform/organizations" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            View organizations
          </Link>
          <Link href="/platform/waitlist" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
            Review waitlist
          </Link>
          <Link href="/platform/inquiries" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            Review inquiries
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          This portal is intended for seeded platform ops only. Organization work happens in the Workspace.
        </p>
      </section>
    </section>
  )
}
