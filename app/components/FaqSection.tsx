import { cn } from '../lib/utils'
import { Badge } from './ui/badge'

type Props = {
  id?: string
  className?: string
}

const faqs = [
  {
    question: 'Who owns our code and data-hosted vs sovereign?',
    answer:
      'Hosted means MYTE runs the infrastructure so you can move fast. Sovereign means you run it on your own domain and infrastructure. Either way, we keep a clean migration path-no “start over” story.',
  },
  {
    question: 'Does AI ever replace our team or make approvals?',
    answer:
      'No. AI drafts and organizes. Humans approve. There are no auto-approvals and no black-box decisions.',
  },
  {
    question: 'Can we prevent knowledge loss when people leave?',
    answer:
      'Yes. Decisions and handoffs are captured and searchable, so context stays with your company even as teams rotate.',
  },
  {
    question: 'Can we collaborate across companies and still stay sovereign?',
    answer:
      'Yes. Each organization keeps its own data and can opt into shared workflows with fine-grained access. You control what’s shared and what’s not.',
  },
  {
    question: 'Can we migrate from hosted to a sovereign stack later?',
    answer:
      'Yes. You can start hosted for speed, then migrate to your own domain and infrastructure when you’re ready. We’ll guide the move and bring your trail with you.',
  },
  {
    question: 'What are the costs? Any hidden fees?',
    answer:
      'Hosted starts with 5 free seats, then per-seat pricing. Sovereign is a one-time license. Managed customization is a retainer. No hidden fees-compute is itemized so you can see what you’re paying for.',
  },
]

export default function FaqSection({ id = 'faq', className }: Props) {
  return (
    <section id={id} className={cn('mx-auto max-w-6xl px-4 sm:px-6', className)}>
      <div className="space-y-6 rounded-3xl border border-border/60 bg-[color:var(--panel)]/85 px-6 py-10 shadow-card sm:px-10 sm:py-12">
        <div className="space-y-3">
          <Badge className="w-fit">FAQ</Badge>
          <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">Straight answers</h2>
          <p className="max-w-3xl text-base text-muted-foreground">
            Ownership, AI, migration, collaboration, and pricing-without the fluff.
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
