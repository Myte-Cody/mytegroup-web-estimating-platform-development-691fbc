import { cn } from '../lib/utils'
import { Badge } from './ui/badge'

type Props = {
  id?: string
  className?: string
}

const faqs = [
  {
    question: 'Do we own the code and data?',
    answer: 'With the sovereign license, yes. You control the codebase, infrastructure, and data for your instance.',
  },
  {
    question: 'Does AI replace our team?',
    answer:
      'No. AI is there to assist. Approvals and critical decisions always sit with your experts-engineers, architects, inspectors, and field leaders stay responsible for their work.',
  },
  {
    question: 'Can we prevent knowledge loss when people leave?',
    answer: 'Yes. Workflows and decisions are captured, searchable, and reusable.',
  },
  {
    question: 'Can we collaborate across companies and still stay sovereign?',
    answer:
      'Yes. Each organization keeps its own data, and can opt into shared workflows with fine-grained access.',
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
            Clear answers on ownership, AI control, knowledge retention, and collaboration.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
        {faqs.map((faq) => (
          <details
            key={faq.question}
            className="group rounded-2xl border border-border/60 bg-[color:var(--panel)] px-4 py-3 shadow-card"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-2 text-lg font-semibold text-[var(--text)] outline-none marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent">
              {faq.question}
              <span className="text-sm text-muted-foreground transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-base text-muted-foreground">{faq.answer}</p>
          </details>
        ))}
      </div>
      </div>
    </section>
  )
}
