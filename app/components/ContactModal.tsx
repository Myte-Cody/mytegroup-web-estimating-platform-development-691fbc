'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, MailCheck, ShieldQuestion, X } from 'lucide-react'

import { apiFetch, ApiError } from '../lib/api'
import { cn } from '../lib/utils'
import { buttonVariants } from './ui/button'

const CONTACT_ENDPOINT = '/marketing/contact-inquiries'
const VERIFY_ENDPOINT = '/marketing/contact-inquiries/verify-email'
const VERIFY_CONFIRM_ENDPOINT = '/marketing/contact-inquiries/verify-email/confirm'

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.ca',
  'outlook.com',
  'outlook.fr',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'mailinator.com',
  '10minutemail.com',
  'tempmail.com',
])

type Props = {
  open: boolean
  onClose: () => void
}

type VerificationState = 'idle' | 'sent' | 'verified'

const normalizeEmail = (value: string) => value.trim().toLowerCase()
const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const emailDomain = (value: string) => {
  const normalized = normalizeEmail(value)
  return normalized.includes('@') ? normalized.split('@').pop() || '' : ''
}

export default function ContactModal({ open, onClose }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationStatus, setVerificationStatus] = useState<VerificationState>('idle')
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [joinWaitlist, setJoinWaitlist] = useState(false)
  const [waitlistRole, setWaitlistRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email])
  const domain = useMemo(() => emailDomain(email), [email])
  const isPersonal = useMemo(() => domain !== '' && PERSONAL_EMAIL_DOMAINS.has(domain), [domain])
  const emailIsValid = useMemo(() => emailRegex.test(normalizedEmail), [normalizedEmail])
  const requiresVerification = emailIsValid && isPersonal
  const emailVerified = !requiresVerification || verificationStatus === 'verified'

  const nameError =
    name.trim().length === 0
      ? null
      : name.trim().length < 2 || name.trim().length > 120
      ? 'Name must be between 2 and 120 characters.'
      : null
  const messageLength = message.trim().length
  const messageError =
    messageLength === 0
      ? null
      : messageLength < 10 || messageLength > 4000
      ? 'Message must be between 10 and 4000 characters.'
      : null
  const emailError = normalizedEmail === '' ? null : !emailIsValid ? 'Enter a valid email address.' : null

  const canSubmit =
    !loading &&
    !submitted &&
    emailIsValid &&
    emailVerified &&
    name.trim().length >= 2 &&
    name.trim().length <= 120 &&
    messageLength >= 10 &&
    messageLength <= 4000

  useEffect(() => {
    if (!open) return
    // Reset verification state when email changes
    setVerificationError(null)
    setVerificationMessage(null)
    setVerificationCode('')
    if (!emailIsValid) {
      setVerificationStatus('idle')
      setJoinWaitlist(false)
      return
    }
    if (requiresVerification) {
      setVerificationStatus('idle')
      setJoinWaitlist(false)
    } else {
      setVerificationStatus('verified')
    }
  }, [normalizedEmail, emailIsValid, requiresVerification, open])

  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAndReset()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const closeAndReset = () => {
    setName('')
    setEmail('')
    setMessage('')
    setVerificationCode('')
    setVerificationStatus('idle')
    setVerificationError(null)
    setVerificationMessage(null)
    setJoinWaitlist(false)
    setWaitlistRole('')
    setLoading(false)
    setVerifyLoading(false)
    setSubmitted(false)
    setSubmitError(null)
    onClose()
  }

  const handleSendCode = async () => {
    if (!emailIsValid) {
      setVerificationError('Enter a valid email address before verifying.')
      return
    }
    if (!requiresVerification) {
      setVerificationStatus('verified')
      setVerificationMessage('Company email recognized. Verification not required.')
      return
    }
    setVerifyLoading(true)
    setVerificationError(null)
    try {
      const result = await apiFetch<{ status: string }>(VERIFY_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), email: normalizedEmail }),
      })
      if (result.status === 'verified') {
        setVerificationStatus('verified')
        setVerificationMessage('Company email verified automatically.')
      } else {
        setVerificationStatus('sent')
        setVerificationMessage(`We've emailed a 6-digit code to ${normalizedEmail}. Enter it below to verify.`)
      }
    } catch (err: any) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to send a verification code right now. Please try again.'
      setVerificationError(message)
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleConfirmCode = async () => {
    if (!verificationCode || verificationCode.trim().length !== 6) {
      setVerificationError('Enter the 6-digit code we sent you.')
      return
    }
    setVerifyLoading(true)
    setVerificationError(null)
    try {
      await apiFetch(VERIFY_CONFIRM_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail, code: verificationCode.trim() }),
      })
      setVerificationStatus('verified')
      setVerificationMessage('Email verified.')
    } catch (err: any) {
      const message =
        err instanceof ApiError ? err.message : 'That code is invalid or expired. Request a new one and try again.'
      setVerificationError(message)
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setSubmitError(null)
    try {
      await apiFetch(CONTACT_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: normalizedEmail,
          message: message.trim(),
          source: 'footer-contact',
          joinWaitlist: joinWaitlist && !isPersonal,
          waitlistRole: joinWaitlist && !isPersonal ? waitlistRole.trim() || undefined : undefined,
        }),
      })
      setSubmitted(true)
    } catch (err: any) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Unable to send your message right now. Please try again in a moment.'
      setSubmitError(message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="contact-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
      onClick={closeAndReset}
    >
      <div className="contact-modal" onClick={(e) => e.stopPropagation()}>
        <div className="contact-modal__header">
          <div className="space-y-1">
            <p className="eyebrow">Contact</p>
            <h3 id="contact-modal-title" className="text-2xl font-semibold text-[color:var(--text)]">
              Contact MYTE
            </h3>
            <p className="text-sm text-muted-foreground">
              You&apos;re contacting a human, not a bot. Company emails are preferred. Messages are logged so we can
              follow up and keep an audit trail.
            </p>
          </div>
          <button
            type="button"
            className="contact-modal__close"
            aria-label="Close contact modal"
            onClick={closeAndReset}
          >
            <X size={16} />
          </button>
        </div>

        {submitted ? (
          <div className="contact-success">
            <div className="contact-success__icon">
              <CheckCircle2 size={30} />
            </div>
            <div className="space-y-2 text-center">
              <h4 className="text-xl font-semibold text-[color:var(--text)]">Your message was sent.</h4>
              <p className="text-muted-foreground">
                We&apos;ll reply to you at {normalizedEmail || 'your email'} and your inquiry has been logged.
              </p>
            </div>
            <div className="flex justify-center">
              <button type="button" className={buttonVariants({ variant: 'primary', size: 'sm' })} onClick={closeAndReset}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="contact-form">
            <div className="contact-grid">
              <label className="contact-label">
                <span className="contact-label__text">Name</span>
                <input
                  type="text"
                  name="name"
                  value={name}
                  autoComplete="name"
                  onChange={(e) => setName(e.target.value)}
                  className="contact-input"
                  placeholder="Avery Structural"
                />
                {nameError && <div className="contact-error">{nameError}</div>}
              </label>

              <label className="contact-label">
                <span className="contact-label__text">Work email</span>
                <input
                  type="email"
                  name="email"
                  value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  className="contact-input"
                  placeholder="you@company.com"
                />
                <div className="contact-helper">Company email preferred (no Gmail/Outlook/Yahoo/iCloud, etc.).</div>
                {emailError && <div className="contact-error">{emailError}</div>}
              </label>
            </div>

            <label className="contact-label">
              <span className="contact-label__text">Message</span>
              <textarea
                name="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="contact-textarea"
                placeholder="Share what you need: scope, deadlines, or the workflows you want to tame."
                rows={4}
              />
              {messageError && <div className="contact-error">{messageError}</div>}
            </label>

            <div className="contact-verification">
              <div className="flex items-center gap-2">
                <ShieldQuestion size={16} className="text-[color:var(--accent)]" />
                <span className="text-sm font-semibold text-[color:var(--text)]">Email verification</span>
              </div>
              <div className="space-y-3">
                {verificationStatus === 'verified' ? (
                  <div className="contact-chip success">
                    <MailCheck size={16} />
                    <span>Email verified</span>
                    {!requiresVerification && <span className="muted">Company email auto-verified</span>}
                  </div>
                ) : (
                  <div className="contact-chip warning">
                    <span>Email not verified yet.</span>
                    <button
                      type="button"
                      className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'contact-inline-button')}
                      onClick={handleSendCode}
                      disabled={verifyLoading || !emailIsValid}
                    >
                      {verifyLoading ? 'Sending...' : 'Send code'}
                    </button>
                  </div>
                )}

                {verificationStatus === 'sent' && (
                  <div className="contact-code">
                    <label className="contact-label">
                      <span className="contact-label__text">Verification code</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                        className="contact-input"
                        placeholder="6-digit code"
                      />
                    </label>
                    <button
                      type="button"
                      className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'contact-inline-button')}
                      onClick={handleConfirmCode}
                      disabled={verifyLoading}
                    >
                      {verifyLoading ? <Loader2 size={16} className="animate-spin" /> : 'Verify code'}
                    </button>
                  </div>
                )}

                {verificationMessage && <div className="contact-helper">{verificationMessage}</div>}
                {verificationError && <div className="contact-error">{verificationError}</div>}
              </div>
            </div>

            {!requiresVerification && emailIsValid && (
              <div className="contact-optin">
                <label className="contact-checkbox">
                  <input
                    type="checkbox"
                    checked={joinWaitlist}
                    onChange={(e) => setJoinWaitlist(e.target.checked)}
                  />
                  <div>
                    <div className="font-semibold text-[color:var(--text)]">Also join the waitlist</div>
                    <div className="contact-helper">
                      Company email detected. We can add you to the waitlist with the same email.
                    </div>
                  </div>
                </label>
                {joinWaitlist && (
                  <label className="contact-label">
                    <span className="contact-label__text">Role / trade (optional)</span>
                    <input
                      type="text"
                      name="waitlistRole"
                      value={waitlistRole}
                      onChange={(e) => setWaitlistRole(e.target.value)}
                      className="contact-input"
                      placeholder="Estimator, PM, fabricator..."
                    />
                  </label>
                )}
              </div>
            )}

            {submitError && <div className="contact-error">{submitError}</div>}

            <div className="contact-actions">
              <button
                type="button"
                className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'contact-submit')}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Send message'}
              </button>
              <button
                type="button"
                className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'contact-cancel')}
                onClick={closeAndReset}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
