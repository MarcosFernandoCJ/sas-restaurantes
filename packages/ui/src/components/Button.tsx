import React from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

/** Props for the Button component */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: ButtonVariant
  /** Size preset — all sizes meet the 48px minimum touch target */
  size?: ButtonSize
  /** Shows a spinner inline and disables the button */
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary hover:bg-primary-hover text-white border-transparent' +
    ' focus-visible:ring-primary',
  secondary:
    'bg-secondary hover:bg-secondary-hover text-white border-transparent' +
    ' focus-visible:ring-secondary',
  ghost:
    'bg-transparent hover:bg-surface text-primary border-primary' +
    ' focus-visible:ring-primary',
  danger:
    'bg-transparent hover:bg-red-50 text-state-danger border-state-danger' +
    ' focus-visible:ring-state-danger',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm  min-h-[48px] min-w-[48px]',
  md: 'px-4 py-2.5 text-base min-h-[48px] min-w-[48px]',
  lg: 'px-6 py-3   text-lg  min-h-[48px] min-w-[48px]',
}

/**
 * Primary interaction element. All variants meet the WCAG 2.1 48px touch target.
 *
 * @example
 * <Button variant="primary" onClick={handleSubmit}>Confirmar pedido</Button>
 * <Button variant="danger" loading={isCancelling}>Cancelar</Button>
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-md border font-body font-medium',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4 shrink-0"
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
      )}
      {children}
    </button>
  )
}