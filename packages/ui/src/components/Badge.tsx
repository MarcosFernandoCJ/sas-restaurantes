import React from 'react'

/**
 * Semantic variant matching OrderStatus / special order types.
 * Maps 1-to-1 with Tailwind state.* tokens in tailwind.config.ts.
 */
export type BadgeVariant =
  | 'pending'
  | 'in_prep'
  | 'ready'
  | 'additional'
  | 'delivery'
  | 'default'

/** Props for the Badge / Tag component */
export interface BadgeProps {
  /** Semantic order-state variant */
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default:    'bg-gray-100   text-gray-700       border-gray-300',
  pending:    'bg-white      text-primary        border-state-pending',
  in_prep:    'bg-state-in-prep  text-white      border-state-in-prep',
  ready:      'bg-state-ready    text-white      border-state-ready',
  additional: 'bg-state-additional text-white   border-state-additional',
  delivery:   'bg-state-delivery  text-white    border-state-delivery',
}

/** Human-readable Spanish label used as aria-label when variant is not default */
const ariaLabelMap: Record<BadgeVariant, string> = {
  default:    '',
  pending:    'Sin empezar',
  in_prep:    'En preparación',
  ready:      'Listo para llevar',
  additional: 'Pedido adicional',
  delivery:   'Delivery',
}

/**
 * Compact semantic tag for order states. Communicates status through both
 * color and text — never color alone (WCAG 1.4.1).
 *
 * @example
 * <Badge variant="in_prep">En preparación</Badge>
 * <Badge variant="ready">Listo</Badge>
 */
export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      role="status"
      aria-label={variant !== 'default' ? ariaLabelMap[variant] : undefined}
      className={[
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  )
}