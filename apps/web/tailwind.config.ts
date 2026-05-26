import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // Scan UI package source so Tailwind includes all class names used in components
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1B2B3A', hover: '#2E4155' },
        secondary: { DEFAULT: '#C8410A', hover: '#A83508' },
        accent: { DEFAULT: '#E8A838', hover: '#D4860A' },
        surface: '#F0EDE8',
        dark: '#0F1A24',
        border: '#D4CFC9',
        muted: '#8C9BAA',
        state: {
          pending: '#B0C4D8',
          'in-prep': '#2563A8',
          ready: '#1A6B3C',
          additional: '#A05A2C',
          delivery: '#C8410A',
          warning: '#D4860A',
          danger: '#B02020',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config