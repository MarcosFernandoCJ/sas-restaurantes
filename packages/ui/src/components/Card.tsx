import React from 'react'

/** Props for the Card container component */
export interface CardProps {
  /** Optional header bar — receives border-bottom automatically */
  header?: React.ReactNode
  /** Optional footer bar — receives border-top automatically */
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * Surface card container with consistent padding, brand border, and shadow.
 * Composes with `header` and `footer` slots for structured layouts.
 *
 * @example
 * <Card header="Pedido #42" footer={<Badge variant="ready">Listo</Badge>}>
 *   <p>Pollo a la brasa × 2</p>
 * </Card>
 */
export function Card({ header, footer, children, className = '' }: CardProps) {
  return (
    <div
      className={[
        'bg-surface rounded-xl border border-border shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {header != null && (
        <div className="px-4 py-3 border-b border-border font-body font-medium text-primary">
          {header}
        </div>
      )}

      <div className="p-4">{children}</div>

      {footer != null && (
        <div className="px-4 py-3 border-t border-border font-body text-sm text-muted">
          {footer}
        </div>
      )}
    </div>
  )
}