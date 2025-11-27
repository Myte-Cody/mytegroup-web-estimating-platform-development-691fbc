'use client'

import { useMemo, useState } from 'react'
import { Copy, Check, Share2, Link as LinkIcon, MessageCircle, Send } from 'lucide-react'

import { cn } from '../lib/utils'
import { buttonVariants } from './ui/button'

type ShareBarProps = {
  url: string
  title: string
  text: string
  className?: string
}

const withUtm = (url: string) => {
  const hasQuery = url.includes('?')
  const separator = hasQuery ? '&' : '?'
  return `${url}${separator}utm_source=share&utm_medium=organic&utm_campaign=landing`
}

const copyWithFallback = async (text: string) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(text)
    return true
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'absolute'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    return true
  } catch {
    return false
  }
}

export default function ShareBar({ url, title, text, className }: ShareBarProps) {
  const [copied, setCopied] = useState(false)
  const shareUrl = useMemo(() => withUtm(url), [url])
  const shareText = `${title} — ${text}`
  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedText = encodeURIComponent(shareText)
  const encodedCombo = encodeURIComponent(`${shareText} ${shareUrl}`)

  const links = [
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
    { label: 'X', href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}` },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { label: 'WhatsApp', href: `https://wa.me/?text=${encodedCombo}` },
    { label: 'Messenger', href: `https://www.messenger.com/t/?link=${encodedUrl}` },
    { label: 'SMS/RCS', href: `sms:?body=${encodedCombo}` },
  ]

  const copyLink = async () => {
    const ok = await copyWithFallback(shareUrl)
    setCopied(ok)
    if (ok) {
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const canWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const shareNative = async () => {
    if (canWebShare) {
      try {
        await navigator.share({ url: shareUrl, title, text: shareText })
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      } catch {
        // fall through to link copy
      }
    }
    copyLink()
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-border/60 bg-[color:var(--panel-strong)] px-4 py-4 shadow-card backdrop-blur',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <Share2 size={18} aria-hidden />
          Share or preview
        </div>
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'md' }),
                'min-h-[44px] min-w-[44px] border border-border/60 bg-white/5 text-xs text-muted-foreground hover:text-[var(--text)]'
              )}
              aria-label={`Share on ${link.label}`}
            >
              <MessageCircle size={14} aria-hidden />
              {link.label}
            </a>
          ))}
          <button
            type="button"
            onClick={copyLink}
            className={cn(
              buttonVariants({ variant: 'secondary', size: 'md' }),
              'min-h-[44px] min-w-[44px] border border-border/70 bg-white/5 text-xs'
            )}
            aria-label="Copy share link"
          >
            {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <a
            href={`mailto:?subject=${encodedText}&body=${encodedCombo}`}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'md' }),
              'min-h-[44px] min-w-[44px] border border-border/60 bg-white/5 text-xs text-muted-foreground hover:text-[var(--text)]'
            )}
            aria-label="Share via email"
          >
            <Send size={14} aria-hidden />
            Email
          </a>
          <button
            type="button"
            onClick={shareNative}
            className={cn(
              buttonVariants({ variant: 'primary', size: 'md' }),
              'min-h-[44px] min-w-[44px] text-xs font-semibold'
            )}
            aria-label="Open native share"
          >
            {canWebShare ? 'Share now' : 'Copy/Share'}
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <LinkIcon size={12} aria-hidden />
        <span className="truncate">{shareUrl}</span>
      </div>
    </div>
  )
}
