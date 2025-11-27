const { fontFamily } = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1280px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border-hsl))',
        input: 'hsl(var(--input-hsl))',
        ring: 'hsl(var(--ring-hsl))',
        background: 'hsl(var(--background-hsl))',
        foreground: 'hsl(var(--foreground-hsl))',
        panel: 'hsl(var(--panel-hsl))',
        'panel-strong': 'hsl(var(--panel-strong-hsl))',
        card: 'hsl(var(--card-hsl))',
        'card-foreground': 'hsl(var(--card-foreground-hsl))',
        popover: 'hsl(var(--popover-hsl))',
        'popover-foreground': 'hsl(var(--popover-foreground-hsl))',
        primary: 'hsl(var(--primary-hsl))',
        'primary-foreground': 'hsl(var(--primary-foreground-hsl))',
        secondary: 'hsl(var(--secondary-hsl))',
        'secondary-foreground': 'hsl(var(--secondary-foreground-hsl))',
        muted: 'hsl(var(--muted-hsl))',
        'muted-foreground': 'hsl(var(--muted-foreground-hsl))',
        accent: 'hsl(var(--accent-hsl))',
        'accent-foreground': 'hsl(var(--accent-foreground-hsl))',
        destructive: 'hsl(var(--destructive-hsl))',
        'destructive-foreground': 'hsl(var(--destructive-foreground-hsl))',
        ink: 'var(--bg)',
        'ink-strong': 'var(--bg-alt)',
        panel: 'var(--panel)',
        'panel-strong': 'var(--panel-strong)',
        'panel-border': 'var(--panel-border)',
        text: 'var(--text)',
        'muted-text': 'var(--muted)',
        accent: 'var(--accent)',
        'accent-strong': 'var(--accent-strong)',
        'accent-warm': 'var(--accent-warm)',
        success: 'var(--success)',
        danger: 'var(--danger)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Manrope', ...fontFamily.sans],
      },
      boxShadow: {
        glow: '0 18px 60px rgba(37, 99, 235, 0.35)',
        lift: '0 14px 38px rgba(12, 22, 45, 0.45)',
        mesh: '0 24px 90px rgba(4, 10, 26, 0.8)',
        card: '0 18px 65px rgba(7, 12, 26, 0.55)',
      },
      backgroundImage: {
        'grid-slate':
          'radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.12) 1px, transparent 0)',
        mesh: 'radial-gradient(circle at 0% 0%, rgba(37, 99, 235, 0.25), transparent 40%), radial-gradient(circle at 100% 0%, rgba(56, 189, 248, 0.2), transparent 40%), radial-gradient(circle at 50% 100%, rgba(248, 196, 101, 0.08), transparent 45%), linear-gradient(145deg, var(--bg) 0%, var(--bg-alt) 35%, var(--bg) 100%)',
      },
      transitionTimingFunction: {
        decel: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
