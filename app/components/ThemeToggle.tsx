'use client'

import { useEffect, useState } from 'react'

import { cn } from '../lib/utils'

const THEME_KEY = 'myte-theme'

type Theme = 'light' | 'dark'

type ThemeToggleProps = {
  floating?: boolean
  className?: string
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('myte-theme-change', { detail: theme }))
  }
}

export default function ThemeToggle({ floating = true, className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(THEME_KEY) as Theme | null
    const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches
    const initial: Theme = stored || (prefersLight ? 'light' : 'dark')
    setTheme(initial)
    applyTheme(initial)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, next)
    }
  }

  return (
    <button
      type="button"
      className={cn('theme-toggle', floating && 'theme-toggle-floating', className)}
      onClick={toggle}
      aria-label="Toggle light and dark mode"
    >
      <span className="theme-toggle-inner">{theme === 'dark' ? '?' : ''}</span>
    </button>
  )
}
