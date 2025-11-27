export type NavSection = {
  id: string
  label: string
  inHeader: boolean
  inFooter: boolean
}

export const NAV_SECTIONS: NavSection[] = [
  { id: 'hero', label: 'Hero', inHeader: true, inFooter: true },
  { id: 'value', label: 'Value', inHeader: true, inFooter: true },
  { id: 'workflows', label: 'Workflows', inHeader: true, inFooter: true },
  { id: 'how', label: 'How It Works', inHeader: true, inFooter: true },
  { id: 'intelligence', label: 'Intelligence', inHeader: false, inFooter: true },
  { id: 'sovereign', label: 'Sovereignty', inHeader: true, inFooter: true },
  { id: 'pricing', label: 'Pricing', inHeader: true, inFooter: true },
  { id: 'faq', label: 'FAQ', inHeader: true, inFooter: true },
  { id: 'cta', label: 'Book Session', inHeader: false, inFooter: true },
]
