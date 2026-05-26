import React from 'react'

export type SpinnerSize = 'sm' | 'md' | 'lg'

/** Props for the Spinner loading indicator */
export interface SpinnerProps {
  /** Size preset */
  size?: SpinnerSize
  /** Accessible label announced to screen readers */
  label?: string
  className?: string
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
}

/**
 * Animated circular loading indicator. Uses `currentColor` so it inherits
 * the parent's text color automatically.
 *
 * @example
 * <Spinner size="md" label="Cargando pedidos..." />
 */
export function Spinner({ size = 'md', label = 'Cargando...', className = '' }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={['inline-flex', className].join(' ')}>
      <svg
        className={['animate-spin text-secondary', sizeClasses[size]].join(' ')}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}