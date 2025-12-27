import { redirect } from 'next/navigation'

export default async function LegacyNewContactRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, any>>
}) {
  const resolved = await searchParams
  const raw = resolved?.personType
  const personType = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : ''
  const qs = personType ? `?personType=${encodeURIComponent(personType)}` : ''
  redirect(`/dashboard/settings/people/persons/new${qs}`)
}
