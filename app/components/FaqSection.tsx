import { cn } from '../lib/utils'
import { Badge } from './ui/badge'

type Props = {
  id?: string
  className?: string
}

const faqs = [
  {
    question: 'Who owns our code and data—hosted vs sovereign?',
    answer:
      'On the hosted plan, MYTE runs the code and infrastructure while your data is securely managed but not owned. With the sovereign license, your organization owns the codebase, infrastructure, and all project data, with a guided migration path from hosted—no vendor lock-in.',
  },
  {
    question: 'Does AI ever replace our team or make approvals?',
    answer:
      'No. AI assists with ISO forms, connection analysis, and bid visuals, but your estimators, detailers, engineers, and field leaders always review and approve. There are no auto-approvals or black-box decisions—licensed professionals keep the keys.',
  },
  {
    question: 'Can we prevent knowledge loss when people leave?',
    answer:
      'Yes. Workflows, markups, approvals, and field decisions are captured and searchable, so context and reasoning stay with your company even as teams rotate. Knowledge is retained as long as work runs through the OS, not just in individual inboxes or spreadsheets.',
  },
  {
    question: 'Can we collaborate across companies and still stay sovereign?',
    answer:
      'Yes. Each organization keeps its own data and can opt into shared workflows with fine-grained access. Sovereignty is preserved even in cross-org projects—your domain, your code, and your data stay under your control.',
  },
  {
    question: 'Can we migrate from hosted to a sovereign stack later?',
    answer:
      'Yes. You can start hosted for speed, then migrate to a sovereign stack—your domain, your code, your data—when you are ready. The migration is a guided process with support, not a one-click toggle, and your workflows and audit trails come with you.',
  },
  {
    question: 'What are the costs? Any hidden fees?',
    answer:
      'Hosted starts with 5 free seats, then a per-seat monthly fee; the sovereign source license is a one-time cost, and managed customization starts from a monthly retainer. There are no hidden fees—compute, storage, and support are clearly itemized so you always know what you are paying for.',
  },
]

export default function FaqSection({ id = 'faq', className }: Props) {
  return (
    <section id={id} className={cn('mx-auto max-w-6xl px-4 sm:px-6', className)}>
      <div className="space-y-6 rounded-3xl border border-border/60 bg-[color:var(--panel)]/85 px-6 py-10 shadow-card sm:px-10 sm:py-12">
        <div className="space-y-3">
          <Badge className="w-fit">FAQ</Badge>
          <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">What teams ask</h2>
          <p className="max-w-3xl text-base text-muted-foreground">
            Clear answers on ownership, AI control, knowledge retention, collaboration, and the path from hosted to
            sovereign.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-2xl border border-border/60 bg-[color:var(--panel)] px-4 py-3 shadow-card"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-2 text-base font-semibold text-[var(--text)] outline-none marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:text-lg">
                {faq.question}
                <span className="text-sm text-muted-foreground transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
