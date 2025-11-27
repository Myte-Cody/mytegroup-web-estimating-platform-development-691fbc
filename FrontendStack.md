# Frontend Stack Plan (Next.js PWA)

Use this as the go-to plan for making the frontend polished, fast, and compliant with our UX goals (mobile + desktop + PWA). It outlines what to install, how to theme, and which components to prefer.

## Core stack
- **Next.js (app router)** – keep SSR/ISR; already in place.
- **Tailwind CSS** – utility-first styling with our own tokens for color/radius/shadow/blur.
- **shadcn/ui** – component recipes on Radix primitives (accessible dialogs, sheets, toasts, dropdowns, nav, etc.). We own the source; generate only what we need.
- **Lucide icons** – crisp SVG icon set that pairs with shadcn/ui; customizable via Tailwind classes.
- **Framer Motion** – focused motion (hero reveals, button micro-interactions, section transitions). Use sparingly and purposefully.
- **Next-PWA (or Workbox)** – manifest + service worker for installability/offline and asset caching.

## Install checklist (once)
1) Tailwind: `npx tailwindcss init -p` (if not already) and wire `tailwind.config.js` + globals to use our tokens.
2) shadcn/ui: install CLI, set alias to `@/components/ui`, generate primitives we need (Button, Input, Card, Sheet/Drawer, Dialog, DropdownMenu, Tabs, Toast, Tooltip, Navbar). Add `ThemeProvider` if using dark/light.
3) Lucide: `npm install lucide-react` and wrap icons with Tailwind classes for size/weight.
4) Framer Motion: `npm install framer-motion` and define a small animation token set (fast/medium/slow durations, standard easings).
5) Next-PWA/Workbox: add manifest, service worker, caching strategy (HTML network-first, static assets cache-first, API selective).

## Design system (recommended tokens)
- Colors: primary accent (teal/mint), warm accent (amber), deep background (navy/ink). Keep a neutral slate/stone scale for text and surfaces.
- Radii: sm=8px, md=12px, lg=18px, pill=9999px.
- Shadows/blur: soft drop for cards; optional glass (backdrop blur + low alpha white).
- Typography: keep Space Grotesk/Manrope pairing; define heading and body scales in Tailwind theme for consistency.
- Spacing: set a 4/8-based scale (4, 8, 12, 16, 20, 24, 32, 40).
- Motion: 120–240ms for UI, 400–800ms for hero/section reveals; prefer slight y-translation + opacity.

## Components to prefer (shadcn/ui + Tailwind)
- Shell: Header/Navbar (with CTA), Footer, Hero split (copy + visual), Section cards, Pricing cards, FAQ accordions, Steps/timeline.
- Forms: Input, Textarea, Select/Combobox, Checkbox, Radio, Switch; use Form + Toast for validation states.
- Overlays: Dialog (modals), Sheet/Drawer (mobile-first menus), Tooltip, Toast.
- Navigation: Tabs, Breadcrumbs (if needed), Command palette (for quick actions).
- Feedback: Badge, Alert, Skeleton, Progress, Hover card for richer links.
- Lists: Card grids, Table (for admin), Accordion for FAQs.

## PWA & device capabilities
- Manifest + service worker for installability; favicon + app icons.
- Mic: `navigator.mediaDevices.getUserMedia({ audio: true })`; wrap in a shadcn Dialog/Sheet with a clear consent message and a fallback state when blocked.
- Location: `navigator.geolocation.getCurrentPosition` with graceful degradation and a “why we ask” tooltip; avoid blocking flows if denied.
- Offline: cache static assets; show an offline toast/state when API calls fail; retry queued actions where sensible.

## Beauty tips (keep it intentional)
- Use layered backgrounds (gradients + subtle noise) and glass cards sparingly for hierarchy.
- Keep CTAs high contrast with gentle glow/shadow, not heavy neon.
- Limit fonts to 1–2 families; tighten letter spacing on headlines.
- Use consistent icon sizing (Lucide 18–20px in buttons, 20–24px in cards).
- Motion: animate section reveals on scroll (Framer Motion), but keep durations short; avoid animating layout excessively.
- Responsive: test mobile first (nav drawer, touch targets ≥44px), then desktop grids (auto-fit cards).

## What to do next (actionable)
- Add Tailwind + shadcn/ui + Lucide + Framer Motion (if not already).
- Replace bespoke styles in `app/globals.css` incrementally with Tailwind utilities and shadcn primitives; keep the current aesthetic but move to tokens.
- Create a `components/ui` folder (shadcn) and migrate buttons/inputs/cards, then hero/sections to use those primitives for consistency.
- Add manifest + SW for PWA; ensure icons and offline hints are present.
- Wrap mic/location requests in UX that explains intent and handles denial gracefully.
