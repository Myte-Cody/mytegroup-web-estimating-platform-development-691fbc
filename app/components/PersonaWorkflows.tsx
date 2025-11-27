'use client'

import { useState } from 'react'
import {
  Building2,
  Calculator,
  ClipboardList,
  ClipboardCheck,
  Construction,
  DraftingCompass,
  Factory,
  Hammer,
  Handshake,
  IdCard,
  LineChart,
  Scale,
  ShoppingCart,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '../lib/utils'
import { Badge } from './ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

type PersonaId =
  | 'estimators'
  | 'detailers'
  | 'fabricators'
  | 'erectors'
  | 'pms'
  | 'owners'
  | 'professionals'
  | 'qaqc'
  | 'safety'
  | 'foreman'
  | 'sales'
  | 'vendors'
  | 'hr'
  | 'compliance'
  | 'procurement'
  | 'cost'

type Persona = {
  id: PersonaId
  label: string
  tagline: string
  intro: string
  bullets: string[]
  tags?: string[]
  icon: LucideIcon
}

type Props = {
  id?: string
  className?: string
}

const personas: Persona[] = [
  {
    id: 'estimators',
    label: 'Estimators',
    tagline: 'ISO-ready bids, human-approved',
    intro:
      'Build bids with ISO-ready forms, connection analysis context, and 3D previews linked to your 2D take-off. Every revision and approval reason is logged.',
    bullets: [
      'Complete ISO review forms and assemble connection analysis packets for expert review—AI assists, but your team approves.',
      'Use 3D previews linked to your 2D take-off so reviewers see context, not just line items—no black-box automation.',
      'Keep every bid version transparent, with reviewer notes and approval reasons tracked for audit and compliance.',
      'Let sales reps and service providers work from the same bid record without breaking the audit trail or losing control.',
    ],
    tags: ['ISO-ready bids', 'Audit trail', '3D previews'],
    icon: Calculator,
  },
  {
    id: 'detailers',
    label: 'Detailers',
    tagline: 'Drawings stay linked',
    intro: 'Upload, mark up, and track drawing revisions alongside RFIs, COs, and field feedback.',
    bullets: [
      'Upload drawings, add markups, and keep revision history intact.',
      'Link drawings directly to RFIs, change orders, and field feedback.',
      'See field notes looped back into the detail set before issuing changes.',
      'Trace every markup to the related coordination thread.',
    ],
    tags: ['Revisions linked', 'RFIs connected', 'Audit trail'],
    icon: DraftingCompass,
  },
  {
    id: 'qaqc',
    label: 'QA / QC',
    tagline: 'Voice NCRs with full lifecycle',
    intro:
      'Create NCRs by voice, tie photos and chat to drawings, and escalate to RFIs with full ISO lifecycle tracking and immutable audit logs.',
    bullets: [
      'Capture NCRs with voice, photos, and markups linked to the impacted drawings and 3D context.',
      'Collaborate on NCR threads with all actions audit-logged.',
      'Convert NCRs to RFIs and track review/response to closure with ISO-ready records.',
      'Surface trends for toolbox talks without dictating means and methods.',
    ],
    tags: ['ISO NCRs', 'Audit logged', 'NCR → RFI'],
    icon: ClipboardCheck,
  },
  {
    id: 'fabricators',
    label: 'Fabricators',
    tagline: 'Work orders that react to change',
    intro: 'Work orders, inspections, and NCRs stay synced to upstream changes, with anomalies flagged for human review.',
    bullets: [
      'Issue work orders with the latest approved changes attached.',
      'Track inspections and NCRs without losing the related approvals.',
      'Change-driven updates flow down to the shop floor automatically.',
      'Production anomalies get flagged for review before they spread.',
    ],
    tags: ['Change-driven', 'Inspections logged', 'Shop-ready'],
    icon: Factory,
  },
  {
    id: 'safety',
    label: 'Health & Safety',
    tagline: 'Incidents and FLRAs captured',
    intro:
      'Digitize incidents and FLRAs in the field—crews upload, the OS logs and routes with full traceability and ISO audit trails.',
    bullets: [
      'Report incidents and near-misses with photos and location context.',
      'Upload paper FLRAs as images; the OS processes and logs them digitally with ISO-ready trails.',
      'Build intelligence pipelines on FLRAs to surface issues for toolbox meetings with audit-ready records.',
      'Track corrective actions and ownership without losing the paper trail.',
    ],
    tags: ['ISO FLRAs', 'Incident logs', 'Audit trail'],
    icon: ShieldAlert,
  },
  {
    id: 'erectors',
    label: 'Erectors / Field',
    tagline: 'Sequences with field-first context',
    intro: 'Erection sequences, daily reports, and safety checks keep photos, annotations, and decisions together—always linked and auditable.',
    bullets: [
      'Run erection sequences with linked drawings and notes.',
      'Log daily reports, issues, and safety checks with photos and annotations.',
      'Capture field decisions and surface them for approvals.',
      'Close the loop from field feedback back to detailing and fab.',
    ],
    tags: ['Field-first', 'Photos + notes', 'Approvals logged'],
    icon: Construction,
  },
  {
    id: 'foreman',
    label: 'Foreman',
    tagline: 'Field prep with job memory',
    intro:
      'Toolbox prep and daily memory for your site—extras, priorities, contacts, and reports in one audit-ready view.',
    bullets: [
      'Auto-build toolbox agendas with job-specific notes and safety/QC items.',
      'Plan crews with project context (extras, priorities, interference cross-trades).',
      'One-tap contacts for other trades to clear issues fast on-site.',
      'Field reports, pick lists, time sheets, and fabrication error notifications stay linked and audit-ready.',
    ],
    tags: ['Toolbox ready', 'Crew planning', 'Audit logged'],
    icon: Hammer,
  },
  {
    id: 'pms',
    label: 'Project Managers',
    tagline: 'Approvals across workflows',
    intro:
      'Approve across workflows with schedule and cost visibility—risk flags and audit trails built in.',
    bullets: [
      'Approve estimates, drawings, RFIs, and COs from one view.',
      'See schedule and cost impact before approving.',
      'Review AI and human actions together with full audit trails.',
      'Risk flags are summarized so nothing slips through.',
    ],
    tags: ['Cross-workflow', 'Schedule + cost', 'Audit trail'],
    icon: ClipboardList,
  },
  {
    id: 'sales',
    label: 'Sales / BD',
    tagline: 'Bid transparency without chaos',
    intro:
      'Manage ISO-ready bids, connection analysis, and 3D visuals from 2D take-off—versioned and reviewable for every stakeholder.',
    bullets: [
      'Share bid packets with reps and service providers in one controlled space.',
      'Track bid versions, reviewer notes, and approval state with receipts.',
      'Generate 3D visuals for presentations without leaving the OS.',
      'Keep pricing logic sovereign while giving clients clarity.',
    ],
    tags: ['Bid packets', 'Approvals logged', '3D visuals'],
    icon: LineChart,
  },
  {
    id: 'owners',
    label: 'Owners / GCs',
    tagline: 'Transparent oversight',
    intro: 'Dashboards, document access, and approval paths with executive summaries—always keeping a human in the loop and audit trails intact.',
    bullets: [
      'See dashboards and document access without digging.',
      'Track approvals and paths across teams and vendors.',
      'Executive summaries stay reviewable before anything ships.',
      'Maintain human oversight while AI handles the busywork.',
    ],
    tags: ['Oversight', 'Approvals', 'Executive summaries'],
    icon: Building2,
  },
  {
    id: 'vendors',
    label: 'Service Providers / Vendors',
    tagline: 'Work with the network, on your terms',
    intro:
      'Join the Myte network; share service info, stay integrated, and control who you work with.',
    bullets: [
      'Publish service capabilities once; let customers pull the latest rev.',
      'Receive scoped work packages with the exact drawings and forms required.',
      'Control visibility and choose who you work with - full vendor sovereignty with audit-ready submissions.',
      'Keep submissions, certs, and deliveries auditable and linked to projects with compliance-ready logs.',
    ],
    tags: ['Vendor sovereignty', 'Scoped packages', 'Audit-ready'],
    icon: Handshake,
  },
  {
    id: 'hr',
    label: 'HR / People Ops',
    tagline: 'People records that travel',
    intro:
      'Crew histories, certifications, and onboarding stay tied to projects; roles sovereign, compliance logged.',
    bullets: [
      'Track certifications and expiries per worker; alerts follow them job to job.',
      'See who you have worked with and how they performed on past sites.',
      'Monitor onboarding status (drug tests, travel, trainings, welcome comms).',
      'Prepare travel bookings, handle layoffs lifecycle, and report hours to union/government with audit-ready records.',
    ],
    tags: ['Certs + alerts', 'Onboarding', 'Compliance logs'],
    icon: IdCard,
  },
  {
    id: 'compliance',
    label: 'Compliance Officer',
    tagline: 'Audit-proof by design',
    intro:
      'Policy-gated workflows with legal hold, PII gating, and immutable audit packs across projects and vendors.',
    bullets: [
      'Enforce ISO-ready forms, legal hold, and data residency per project.',
      'Export audit packs with who/when/why for every approval and exception.',
      'Monitor compliance exceptions and corrective actions with immutable logs.',
    ],
    tags: ['ISO forms', 'Legal hold', 'Audit packs'],
    icon: Scale,
  },
  {
    id: 'procurement',
    label: 'Purchasing / Procurement',
    tagline: 'POs that stay compliant',
    intro:
      'POs, vendor docs, and deliveries stay tied to drawings, scopes, and approvals with full traceability.',
    bullets: [
      'Issue and track POs with linked drawings/scopes and vendor compliance docs.',
      'Capture receiving, delivery photos, and anomalies with audit-ready logs.',
      'Keep vendor certs and insurance up to date with ISO-ready submissions.',
    ],
    tags: ['PO lifecycle', 'Receiving logs', 'Vendor compliance'],
    icon: ShoppingCart,
  },
  {
    id: 'cost',
    label: 'Cost Control / Accounting',
    tagline: 'Dollars tied to evidence',
    intro:
      'COs, pay apps, and invoices stay aligned to approved work and field evidence with immutable trails.',
    bullets: [
      'Tie pay apps and invoices to approved COs, POs, and field receipts.',
      'Track budget deltas when drawings or scope change, with approvals logged.',
      'Keep payouts compliant and auditable across vendors and projects.',
    ],
    tags: ['COs + pay apps', 'Budget deltas', 'Audit trail'],
    icon: Calculator,
  },
  {
    id: 'professionals',
    label: 'Engineers / Architects / Inspectors',
    tagline: 'Outcomes, not means and methods',
    intro:
      'Design assumptions, review comments, and inspection outcomes stay linked to project events while professionals keep control over means and methods.',
    bullets: [
      'Track design assumptions and review comments alongside RFIs and COs.',
      'Keep inspection outcomes auditable without dictating how inspections are performed.',
      'Route AI summaries to reviewers but require human sign-off on anything that ships.',
      'Maintain professional autonomy while sharing outcomes with the team.',
    ],
    tags: ['Traceable reviews', 'Audit outcomes', 'Human sign-off'],
    icon: DraftingCompass,
  },
]

export default function PersonaWorkflows({ id = 'workflows', className }: Props) {
  const [activeId, setActiveId] = useState<PersonaId>('estimators')
  const activePersona = personas.find((persona) => persona.id === activeId) ?? personas[0]
  const ActiveIcon = activePersona.icon

  return (
    <section
      id={id}
      className={cn('mx-auto max-w-6xl px-4 sm:px-6', className)}
      aria-labelledby="persona-heading"
    >
      <div className="space-y-8 rounded-3xl border border-border/60 bg-[color:var(--panel)]/85 px-6 py-10 shadow-card sm:px-10 sm:py-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Badge className="w-fit">Steel roles in the OS</Badge>
            <h2 id="persona-heading" className="text-3xl font-semibold leading-tight sm:text-4xl">
              Workflows by persona
            </h2>
            <p className="max-w-3xl text-base text-muted-foreground">
              AI assists with forms, analysis, and visual context; your teams review and approve. Every decision stays auditable
              across estimators, detailers, fabricators, erectors, PMs, QA/QC, safety, and oversight roles-outcomes are tracked,
              means and methods stay yours.
            </p>
          </div>
          <div className="rounded-full border border-border/60 bg-panel/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground shadow-glow">
            {'Capture > Assist > Approve > Learn'}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-[color:var(--panel-strong)] p-5 shadow-card sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="rounded-full border border-border/60 bg-white/5 px-3 py-1 text-[var(--text)]">Roles</span>
              <span className="rounded-full border border-border/60 bg-white/5 px-3 py-1">Field-first</span>
              <span className="rounded-full border border-border/60 bg-white/5 px-3 py-1">Audit-ready</span>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {personas.map((persona) => {
                const Icon = persona.icon
                const isActive = persona.id === activeId
                return (
                  <button
                    key={persona.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`persona-panel-${persona.id}`}
                    id={`persona-tab-${persona.id}`}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border border-transparent p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
                      isActive
                        ? 'bg-[color:var(--panel)] border-[color:var(--accent)] shadow-inner'
                        : 'hover:border-border/60 hover:bg-white/5'
                    )}
                    onClick={() => setActiveId(persona.id)}
                  >
                    <span className="mt-0.5 rounded-lg bg-white/10 p-2.5 text-accent ring-1 ring-inset ring-accent/40">
                      <Icon size={18} />
                    </span>
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold text-[var(--text)]">{persona.label}</div>
                      <div className="text-xs text-muted-foreground">{persona.tagline}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <Card
            key={activePersona.id}
            role="tabpanel"
            id={`persona-panel-${activePersona.id}`}
            aria-labelledby={`persona-tab-${activePersona.id}`}
            className="h-full max-h-[520px] border-border/60 bg-[color:var(--panel)] shadow-card overflow-hidden"
          >
            <CardHeader className="flex flex-row items-start gap-3 pb-3 px-4 pt-4">
              <div className="rounded-2xl bg-gradient-to-br from-accent/25 via-accent/10 to-transparent p-2.5 text-accent ring-1 ring-inset ring-accent/40">
                <ActiveIcon size={18} />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg">{activePersona.label}</CardTitle>
                <CardDescription className="text-[12px] font-semibold uppercase tracking-[0.14em]">
                  {activePersona.tagline}
                </CardDescription>
                {activePersona.tags && (
                  <div className="flex flex-wrap gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {activePersona.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border/60 bg-white/5 px-2 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground pb-4 pt-1 px-4 overflow-y-auto">
              <p className="text-[13px] leading-snug text-[var(--text)]">{activePersona.intro}</p>
              <ul className="grid gap-1.5 lg:grid-cols-2 lg:gap-x-3 lg:gap-y-1.5">
                {activePersona.bullets.map((point) => (
                  <li key={point} className="flex items-start gap-2 leading-snug text-[13px]">
                    <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-br from-accent to-accent-warm shadow-glow" aria-hidden />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
