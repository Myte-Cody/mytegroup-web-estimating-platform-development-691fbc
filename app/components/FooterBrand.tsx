'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function resolveTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  const attr = (document.documentElement.dataset.theme as Theme) || undefined
  if (attr === 'light' || attr === 'dark') return attr
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches
  return prefersLight ? 'light' : 'dark'
}

export default function FooterBrand() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    setTheme(resolveTheme())
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as Theme | undefined
      if (detail === 'light' || detail === 'dark') {
        setTheme(detail)
      } else {
        setTheme(resolveTheme())
      }
    }
    window.addEventListener('myte-theme-change', handler)
    return () => window.removeEventListener('myte-theme-change', handler)
  }, [])

  const logoSrc =
    theme === 'light' ? '/LogoFooterForWhiteBG.svg' : '/LogoFooterForBlackBG.png'

  return (
    <div className="global-footer-left">
      <img src={logoSrc} alt="MYTE Group" className="footer-logo" />
      <div className="footer-text">
        <div>Contact Us</div>
        <div>Myte Group, 7501 Av. M B Jodoin, Anjou, QC H1J 2H9</div>
        <div>
          <a href="mailto:info@mytegroup.com">info@mytegroup.com</a>
        </div>
      </div>
    </div>
  )
}
