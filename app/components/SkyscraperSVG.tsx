'use client'

import clsx from 'clsx'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'

type Props = {
  className?: string
}

type TowerTimings = {
  left: { duration: number; delay: number }
  mid: { duration: number; delay: number }
  right: { duration: number; delay: number }
}

type SecondaryTimings = {
  one: { duration: number; delay: number }
  two: { duration: number; delay: number }
}

const BASE_TIMINGS: TowerTimings = {
  left: { duration: 24, delay: 0.35 },
  mid: { duration: 26, delay: 0.85 },
  right: { duration: 28, delay: 1.3 },
}

const SECONDARY_BASE_TIMINGS: SecondaryTimings = {
  one: { duration: 18, delay: 0.6 },
  two: { duration: 20, delay: 1 },
}

export default function SkyscraperSVG({ className }: Props) {
  const [timings, setTimings] = useState<TowerTimings>(BASE_TIMINGS)
  const [secondaryTimings, setSecondaryTimings] = useState<SecondaryTimings>(SECONDARY_BASE_TIMINGS)

  useEffect(() => {
    const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min

    const randomized: TowerTimings = {
      left: { duration: randomBetween(16, 26), delay: randomBetween(0.25, 1.5) },
      mid: { duration: randomBetween(18, 28), delay: randomBetween(0.45, 1.8) },
      right: { duration: randomBetween(20, 30), delay: randomBetween(0.6, 2.2) },
    }

    const randomizedSecondary: SecondaryTimings = {
      one: { duration: randomBetween(12, 20), delay: randomBetween(0.4, 1.4) },
      two: { duration: randomBetween(14, 22), delay: randomBetween(0.7, 1.8) },
    }

    const finishTimes = Object.values(randomized).map((t) => t.duration + t.delay)
    const longestFinish = Math.max(...finishTimes)
    const scale = longestFinish > 0 ? 30 / longestFinish : 1

    const scaled = Object.fromEntries(
      Object.entries(randomized).map(([key, value]) => [
        key,
        {
          duration: parseFloat((value.duration * scale).toFixed(2)),
          delay: parseFloat((value.delay * scale).toFixed(2)),
        },
      ])
    ) as TowerTimings

    setTimings(scaled)
    setSecondaryTimings(randomizedSecondary)
  }, [])

  const timingVars = {
    '--rise-left-duration': `${timings.left.duration}s`,
    '--rise-left-delay': `${timings.left.delay}s`,
    '--rise-mid-duration': `${timings.mid.duration}s`,
    '--rise-mid-delay': `${timings.mid.delay}s`,
    '--rise-right-duration': `${timings.right.duration}s`,
    '--rise-right-delay': `${timings.right.delay}s`,
    '--rise-sec-one-duration': `${secondaryTimings.one.duration}s`,
    '--rise-sec-one-delay': `${secondaryTimings.one.delay}s`,
    '--rise-sec-two-duration': `${secondaryTimings.two.duration}s`,
    '--rise-sec-two-delay': `${secondaryTimings.two.delay}s`,
  } as CSSProperties

  return (
    <svg
      viewBox="0 0 360 440"
      aria-hidden="true"
      className={clsx('skyscraper-svg', className)}
      role="presentation"
      style={timingVars}
    >
      <style>
        {`
        @keyframes windowPulse {
          0%, 20% { opacity: 0.18; }
          50% { opacity: 0.45; }
          100% { opacity: 0.18; }
        }
        @keyframes riseLeft {
          from { transform: translate(-22px, 72px) scaleY(0.08); opacity: 0; }
          35% { opacity: 0.4; }
          to   { transform: translate(0, 0) scaleY(1); opacity: 1; }
        }
        @keyframes riseMid {
          from { transform: translate(18px, 88px) scaleY(0.08); opacity: 0; }
          35% { opacity: 0.4; }
          to   { transform: translate(0, 0) scaleY(1); opacity: 1; }
        }
        @keyframes riseRight {
          from { transform: translate(20px, 64px) scaleY(0.08); opacity: 0; }
          35% { opacity: 0.4; }
          to   { transform: translate(0, 0) scaleY(1); opacity: 1; }
        }
        @keyframes riseSecondary {
          from { transform: translate(10px, 52px) scaleY(0.1); opacity: 0; }
          30% { opacity: 0.45; }
          to   { transform: translate(0, 0) scaleY(1); opacity: 1; }
        }
        .tower-left { animation: riseLeft var(--rise-left-duration, 24s) cubic-bezier(0.2, 0.8, 0.2, 1) forwards; transform-origin: 18px 378px; animation-delay: var(--rise-left-delay, 0.35s); }
        .tower-mid { animation: riseMid var(--rise-mid-duration, 26s) cubic-bezier(0.2, 0.8, 0.2, 1) forwards; animation-delay: var(--rise-mid-delay, 0.85s); transform-origin: 132px 378px; }
        .tower-right { animation: riseRight var(--rise-right-duration, 28s) cubic-bezier(0.2, 0.8, 0.2, 1) forwards; animation-delay: var(--rise-right-delay, 1.3s); transform-origin: 236px 378px; }
        .tower-sec-one { animation: riseSecondary var(--rise-sec-one-duration, 18s) cubic-bezier(0.2, 0.8, 0.2, 1) forwards; animation-delay: var(--rise-sec-one-delay, 0.6s); transform-origin: 120px 372px; }
        .tower-sec-two { animation: riseSecondary var(--rise-sec-two-duration, 20s) cubic-bezier(0.2, 0.8, 0.2, 1) forwards; animation-delay: var(--rise-sec-two-delay, 1s); transform-origin: 230px 364px; }
        .cables { animation: fadeInCables 6s ease-out forwards; animation-delay: 4s; opacity: 0; }
        @keyframes fadeInCables { from { opacity: 0; } to { opacity: 0.9; } }
        @keyframes drawOutline {
          from { stroke-dasharray: 0 900; stroke-dashoffset: 120; opacity: 0; }
          to   { stroke-dasharray: 900 0; stroke-dashoffset: 0; opacity: 1; }
        }
        .outline-left { animation: drawOutline 8s ease-out forwards; animation-delay: 1.5s; }
        .outline-mid { animation: drawOutline 8.4s ease-out forwards; animation-delay: 2s; }
        .outline-right { animation: drawOutline 8.2s ease-out forwards; animation-delay: 2.4s; }
        .outline-secondary { animation: drawOutline 7.6s ease-out forwards; animation-delay: 1.2s; }
        .glass-fill { opacity: 0.14; }
        .window { animation: windowPulse 6s ease-in-out infinite; }
        .window:nth-child(2n) { animation-duration: 7.5s; }
        .window:nth-child(3n) { animation-duration: 5.5s; animation-delay: 1s; }
        `}
      </style>
      <defs>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="rgba(0,0,0,0.2)" />
        </filter>
        <linearGradient id="steelGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
          <stop offset="50%" stopColor="var(--accent-strong)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="var(--accent-warm)" stopOpacity="0.65" />
        </linearGradient>
        <linearGradient id="glassGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
          <stop offset="35%" stopColor="rgba(255,255,255,0.28)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.12)" />
        </linearGradient>
        <linearGradient id="cableGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--accent-strong)" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="horizonGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
          <stop offset="40%" stopColor="rgba(180,206,255,0.18)" />
          <stop offset="100%" stopColor="rgba(12,34,76,0.08)" />
        </linearGradient>
        <linearGradient id="windowGlow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.92)" />
          <stop offset="100%" stopColor="rgba(178,206,255,0.7)" />
        </linearGradient>
      </defs>

      <rect x="-30" y="0" width="420" height="320" fill="url(#horizonGradient)" opacity="0.5" />

      <g opacity="0.12" fill="url(#steelGradient)">
        <rect x="-4" y="150" width="40" height="186" rx="10" />
        <rect x="46" y="134" width="36" height="208" rx="10" />
        <rect x="102" y="162" width="32" height="176" rx="10" />
        <rect x="156" y="142" width="38" height="198" rx="10" />
        <rect x="212" y="158" width="30" height="178" rx="10" />
        <rect x="260" y="148" width="34" height="188" rx="10" />
        <rect x="308" y="168" width="30" height="168" rx="10" />
      </g>

      <g>
        <rect
          x="82"
          y="114"
          width="72"
          height="262"
          rx="16"
          fill="url(#glassGradient)"
          className="tower-sec-one glass-fill"
        />
        <rect
          x="196"
          y="132"
          width="62"
          height="230"
          rx="15"
          fill="url(#glassGradient)"
          className="tower-sec-two glass-fill"
        />
        <rect
          x="94"
          y="128"
          width="48"
          height="234"
          rx="12"
          stroke="url(#steelGradient)"
          strokeOpacity="0.6"
          strokeWidth="1.4"
          fill="none"
          className="tower-sec-one outline-secondary"
        />
        <rect
          x="208"
          y="146"
          width="40"
          height="204"
          rx="12"
          stroke="url(#steelGradient)"
          strokeOpacity="0.6"
          strokeWidth="1.4"
          fill="none"
          className="tower-sec-two outline-secondary"
        />
      </g>

      <g filter="url(#shadow)">
        <rect x="18" y="78" width="110" height="300" rx="18" fill="url(#glassGradient)" className="tower-left glass-fill" />
        <rect x="132" y="46" width="96" height="332" rx="18" fill="url(#glassGradient)" className="tower-mid glass-fill" />
        <rect x="236" y="104" width="94" height="274" rx="18" fill="url(#glassGradient)" className="tower-right glass-fill" />

        <rect
          x="30"
          y="92"
          width="86"
          height="272"
          rx="14"
          stroke="url(#steelGradient)"
          strokeOpacity="0.65"
          strokeWidth="1.6"
          fill="none"
          className="tower-left outline-left"
        />
        <rect
          x="144"
          y="64"
          width="72"
          height="300"
          rx="14"
          stroke="url(#steelGradient)"
          strokeOpacity="0.65"
          strokeWidth="1.6"
          fill="none"
          className="tower-mid outline-mid"
        />
        <rect
          x="248"
          y="122"
          width="70"
          height="244"
          rx="14"
          stroke="url(#steelGradient)"
          strokeOpacity="0.65"
          strokeWidth="1.6"
          fill="none"
          className="tower-right outline-right"
        />
      </g>

      <g opacity="0.65" stroke="url(#steelGradient)" strokeWidth="1.2">
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const y = 132 + i * 40
          return <line key={`sec-one-${i}`} x1="98" y1={y} x2="136" y2={y} />
        })}
        {[0, 1, 2, 3, 4].map((i) => {
          const y = 148 + i * 38
          return <line key={`sec-two-${i}`} x1="212" y1={y} x2="240" y2={y} />
        })}
      </g>

      <g opacity="0.78" stroke="url(#steelGradient)" strokeWidth="1.2">
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const y = 122 + i * 44
          return <line key={`left-${i}`} x1="36" y1={y} x2="118" y2={y} />
        })}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const y = 90 + i * 44
          return <line key={`mid-${i}`} x1="150" y1={y} x2="216" y2={y} />
        })}
        {[0, 1, 2, 3, 4].map((i) => {
          const y = 150 + i * 40
          return <line key={`right-${i}`} x1="256" y1={y} x2="310" y2={y} />
        })}
      </g>

      <g fill="url(#windowGlow)" opacity="0.65">
        {[...Array(8)].map((_, i) => (
          <rect key={`win-left-${i}`} className="window" x={46} y={120 + i * 32} width="44" height="10" rx="4" />
        ))}
        {[...Array(9)].map((_, i) => (
          <rect key={`win-mid-${i}`} className="window" x={158} y={96 + i * 30} width="46" height="10" rx="4" />
        ))}
        {[...Array(7)].map((_, i) => (
          <rect key={`win-right-${i}`} className="window" x={266} y={148 + i * 28} width="36" height="9" rx="4" />
        ))}
        {[...Array(6)].map((_, i) => (
          <rect key={`win-sec-one-${i}`} className="window" x={106} y={140 + i * 32} width="32" height="9" rx="4" />
        ))}
        {[...Array(5)].map((_, i) => (
          <rect key={`win-sec-two-${i}`} className="window" x={216} y={158 + i * 30} width="30" height="9" rx="4" />
        ))}
      </g>

      <g opacity="0.18" fill="url(#steelGradient)">
        <rect x="70" y="94" width="18" height="70" rx="6" />
        <rect x="186" y="70" width="16" height="80" rx="6" />
        <rect x="274" y="126" width="14" height="60" rx="6" />
      </g>

      <g className="cables" stroke="url(#cableGradient)" strokeWidth="2" strokeLinecap="round" opacity="0.9">
        <path d="M70 60 C 120 40, 180 38, 214 70" />
        <path d="M214 70 C 250 92, 278 120, 290 158" />
        <path d="M110 120 C 150 102, 190 104, 228 136" />
      </g>

      <g fill="url(#steelGradient)" opacity="0.5">
        <circle cx="70" cy="60" r="6" />
        <circle cx="214" cy="70" r="6" />
        <circle cx="110" cy="120" r="5" />
        <circle cx="228" cy="136" r="5" />
        <circle cx="290" cy="158" r="5" />
      </g>

      <rect
        x="24"
        y="374"
        width="276"
        height="10"
        rx="5"
        fill="url(#steelGradient)"
        opacity="0.6"
      />
      <rect
        x="42"
        y="390"
        width="240"
        height="12"
        rx="6"
        fill="url(#glassGradient)"
        stroke="url(#steelGradient)"
        strokeOpacity="0.6"
        strokeWidth="1.4"
      />

      <g fill="url(#steelGradient)" opacity="0.7">
        <circle cx="180" cy="52" r="5" />
        <circle cx="72" cy="88" r="4" />
        <circle cx="290" cy="120" r="4" />
      </g>
    </svg>
  )
}
