import { redirect } from 'next/navigation'

export default function LegacyContactRedirect() {
  redirect('/dashboard/settings/people')
}
