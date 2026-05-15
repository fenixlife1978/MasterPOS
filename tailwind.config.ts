import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['DM Sans', 'sans-serif'],
        headline: ['Playfair Display', 'serif'],
        code: ['monospace'],
      },
      colors: {
        background: '#0C0B0A',
        foreground: '#F5F0E8',
        card: {
          DEFAULT: '#161616',
          foreground: '#F5F0E8',
        },
        popover: {
          DEFAULT: '#161616',
          foreground: '#F5F0E8',
        },
        primary: {
          DEFAULT: '#D4A017',
          foreground: '#0C0B0A',
        },
        secondary: {
          DEFAULT: '#1C1C1C',
          foreground: '#C8C0B4',
        },
        muted: {
          DEFAULT: '#6B6560',
          foreground: '#6B6560',
        },
        accent: {
          DEFAULT: '#D4A017',
          foreground: '#0C0B0A',
        },
        destructive: {
          DEFAULT: '#CC4317',
          foreground: '#F5F0E8',
        },
        border: '#2A2520',
        input: '#2A2520',
        ring: '#D4A017',
        chart: {
          '1': '#D4A017',
          '2': '#CC4317',
          '3': '#F5F0E8',
          '4': '#6B6560',
          '5': '#161616',
        },
        sidebar: {
          DEFAULT: '#111111',
          foreground: '#6B6560',
          primary: '#D4A017',
          'primary-foreground': '#0C0B0A',
          accent: '#1C1C1C',
          'accent-foreground': '#D4A017',
          border: '#2A2520',
          ring: '#D4A017',
        },
      },
      borderRadius: {
        lg: '10px',
        md: '8px',
        sm: '4px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'float-ambient': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(25px, -18px) scale(1.05)' },
          '66%': { transform: 'translate(-18px, 25px) scale(.95)' },
        },
        'pulse-scan': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'float-ambient': 'float-ambient 8s ease-in-out infinite',
        'pulse-scan': 'pulse-scan 2s infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
