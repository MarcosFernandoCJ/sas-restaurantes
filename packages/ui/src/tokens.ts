// Fuente de verdad de tokens de diseño — Paleta "Brasas & Carbón"
// Usar siempre estos tokens; nunca hexadecimales directos en componentes.
//
// cssVariables: mapa de nombres de variables CSS a sus valores.
// Usado para inyección programática y como referencia canónica de nombres.

export const cssVariables = {
  '--color-primary': '#1B2B3A',
  '--color-secondary': '#C8410A',
  '--color-accent': '#E8A838',
  '--color-bg': '#FAFAF8',
  '--color-surface': '#F0EDE8',
  '--color-text': '#1C1C1C',
  '--color-muted': '#8C9BAA',
  '--color-border': '#D4CFC9',
  '--color-pending': '#B0C4D8',
  '--color-in-prep': '#2563A8',
  '--color-ready': '#1A6B3C',
  '--color-additional': '#A05A2C',
  '--color-delivery': '#C8410A',
  '--color-warning': '#D4860A',
  '--color-danger': '#B02020',
  '--font-display': '"Playfair Display", Georgia, serif',
  '--font-body': '"DM Sans", system-ui, sans-serif',
  '--font-mono': '"DM Mono", monospace',
} as const

export type CSSVariables = typeof cssVariables

export const tokens = {
  color: {
    // Principales
    primary: '#1B2B3A',
    primaryHover: '#2E4155',
    secondary: '#C8410A',
    secondaryHover: '#A83508',
    accent: '#E8A838',
    accentHover: '#D4860A',

    // Fondos
    bg: '#FAFAF8',
    surface: '#F0EDE8',
    dark: '#0F1A24',

    // Texto
    text: '#1C1C1C',
    muted: '#8C9BAA',
    border: '#D4CFC9',

    // Dark mode (cocina)
    darkSurface: '#162230',
    darkSurfaceHover: '#1E2F3F',
    darkText: '#B0C4D8',
    darkBorder: '#1E2F3F',

    // Estados semánticos
    state: {
      pending: '#B0C4D8',
      inPrep: '#2563A8',
      ready: '#1A6B3C',
      additional: '#A05A2C',
      delivery: '#C8410A',
      warning: '#D4860A',
      danger: '#B02020',
      info: '#4C3B8A',
    },
  },

  font: {
    display: '"Playfair Display", Georgia, serif',
    body: '"DM Sans", system-ui, sans-serif',
    mono: '"DM Mono", monospace',
  },

  spacing: {
    touchMin: '48px', // Tamaño mínimo táctil (WCAG)
  },
} as const

export type Tokens = typeof tokens
