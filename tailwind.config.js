/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Background layers
        'bg-primary':   '#0A0A0B',
        'bg-secondary': '#111113',
        'bg-tertiary':  '#1A1A1D',
        'bg-elevated':  '#222225',

        // Text
        'text-primary':   '#EDEDEF',
        'text-secondary': '#8E8E93',
        'text-tertiary':  '#5A5A5E',

        // Brand
        'vc-primary': '#6C5CE7',
        'vc-accent':  '#A29BFE',

        // Status
        'status-success': '#34D399',
        'status-warning': '#FBBF24',
        'status-danger':  '#F87171',
        'status-info':    '#60A5FA',

        // Chart palette
        'chart-1': '#6C5CE7',
        'chart-2': '#34D399',
        'chart-3': '#FBBF24',
        'chart-4': '#60A5FA',
        'chart-5': '#F87171',

        // Legacy aliases kept so nothing breaks
        gold:           '#6C5CE7',
        'gold-dark':    '#5849C2',
        'vc-text':      '#EDEDEF',
        'vc-muted':     '#8E8E93',
        'vc-border':    '#222225',
        'vc-secondary': '#111113',
        'vc-sidebar':   '#111113',
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Satoshi', 'General Sans', 'Inter', 'sans-serif'],
        mono:  ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        'h1': ['28px', { lineHeight: '1.2', fontWeight: '700' }],
        'h2': ['22px', { lineHeight: '1.3', fontWeight: '600' }],
        'h3': ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        'body': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
        'metric': ['32px', { lineHeight: '1', fontWeight: '700' }],
      },
      spacing: {
        'sidebar': '260px',
        'sidebar-collapsed': '64px',
      },
      borderRadius: {
        'card': '8px',
        'btn':  '6px',
        'badge': '4px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.4)',
        'elevated': '0 8px 24px rgba(0,0,0,0.6)',
        'glow': '0 0 20px rgba(108,92,231,0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'skeleton': 'skeleton 1.5s ease-in-out infinite',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        skeleton: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        slideIn: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
