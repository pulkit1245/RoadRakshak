/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          dark:    '#0a0e1a',
          darker:  '#060912',
          card:    '#111827',
          surface: '#1a2236',
          border:  '#1e293b',
          accent:  '#3b82f6',
          success: '#10b981',
          danger:  '#ef4444',
          warning: '#f59e0b',
          muted:   '#64748b',
        }
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
        'card-gradient': 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%)',
        'glow-radial': 'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(59,130,246,0.06), transparent 40%)',
      },
      boxShadow: {
        'glass':     '0 8px 32px rgba(0,0,0,0.4)',
        '3d':        '0 1px 2px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.2), 0 12px 24px rgba(0,0,0,0.15)',
        '3d-lg':     '0 2px 4px rgba(0,0,0,0.3), 0 8px 16px rgba(0,0,0,0.25), 0 24px 48px rgba(0,0,0,0.2)',
        '3d-hover':  '0 4px 8px rgba(0,0,0,0.35), 0 12px 24px rgba(0,0,0,0.3), 0 32px 64px rgba(0,0,0,0.25)',
        'inner-3d':  'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.3)',
        'glow-blue': '0 0 20px rgba(59,130,246,0.15), 0 0 40px rgba(59,130,246,0.05)',
        'glow-red':  '0 0 20px rgba(239,68,68,0.15), 0 0 40px rgba(239,68,68,0.05)',
        'glow-green':'0 0 20px rgba(16,185,129,0.15), 0 0 40px rgba(16,185,129,0.05)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-up':      'fadeUp 0.5s ease-out forwards',
        'fade-in':      'fadeIn 0.4s ease-out forwards',
        'slide-down':   'slideDown 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-up':     'slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
        'float':        'float 6s ease-in-out infinite',
        'pulse-glow':   'pulseGlow 2s ease-in-out infinite',
        'spin-slow':    'spin 3s linear infinite',
        'shimmer':      'shimmer 2s ease-in-out infinite',
        'orbit':        'orbit 2s linear infinite',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-12px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%':      { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        orbit: {
          '0%':   { transform: 'rotate(0deg) translateX(32px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(32px) rotate(-360deg)' },
        },
      },
    },
  },
  plugins: [],
}
