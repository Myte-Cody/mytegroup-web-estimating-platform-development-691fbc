'use client'

import { useLanguage } from '../lib/i18n'
import { cn } from '../lib/utils'

type LanguageToggleProps = {
  className?: string
}

export default function LanguageToggle({ className }: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage()
  const next = language === 'en' ? 'fr' : 'en'

  return (
    <button
      type="button"
      className={cn('lang-toggle', className)}
      onClick={() => setLanguage(next)}
      aria-label="Toggle language"
    >
      <span className={cn('lang-toggle-chip', language === 'en' && 'active')}>EN</span>
      <span className={cn('lang-toggle-chip', language === 'fr' && 'active')}>FR</span>
    </button>
  )
}
