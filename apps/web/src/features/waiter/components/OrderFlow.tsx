import React, { useState } from 'react'
import { Button } from '@sas/ui'
import { MenuGrid } from './MenuGrid'
import { OrderSummary } from './OrderSummary'
import { PaymentModal } from './PaymentModal'
import { useCartStore } from '../store/cart.store'
import { useApi, ApiError } from '../hooks/useApi'
import type { ApiOrder, ApiInvoice } from '../types'

interface OrderFlowProps {
  onComplete: () => void
  onCancel: () => void
}

const STEPS = ['Platos', 'Bebidas', 'Resumen'] as const
type StepName = typeof STEPS[number]

function StepIndicator({ current }: { current: StepName }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((step, i) => {
        const isCurrent = step === current
        const isDone = STEPS.indexOf(current) > i
        return (
          <React.Fragment key={step}>
            <div className={[
              'flex items-center gap-1.5 text-sm font-semibold transition-all',
              isCurrent ? 'text-secondary' : isDone ? 'text-[#1A6B3C]' : 'text-muted',
            ].join(' ')}>
              <span className={[
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                isCurrent ? 'bg-secondary text-white' : isDone ? 'bg-[#1A6B3C] text-white' : 'bg-border text-muted',
              ].join(' ')}>
                {isDone ? '✓' : i + 1}
              </span>
              {step}
            </div>
            {i < STEPS.length - 1 && (
              <div className={['flex-1 h-0.5 max-w-8', isDone ? 'bg-[#1A6B3C]' : 'bg-border'].join(' ')} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Pay choice screen ────────────────────────────────────────────────────────

interface PayChoiceProps {
  total: number
  onPayNow: () => void
  onPayLater: () => void
}

function PayChoiceScreen({ total, onPayNow, onPayLater }: PayChoiceProps) {
  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="text-center">
        <p className="text-4xl font-mono font-bold text-primary">S/ {total.toFixed(2)}</p>
        <p className="text-sm text-muted mt-1">Pedido creado con éxito</p>
      </div>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={onPayNow}
          className="w-full flex items-center gap-4 rounded-xl border-2 border-secondary bg-secondary/5 px-5 py-4 text-left hover:bg-secondary/10 active:scale-[0.98] transition-all"
        >
          <span className="text-3xl">💳</span>
          <div>
            <p className="font-semibold text-primary">Pagar ahora</p>
            <p className="text-xs text-muted mt-0.5">Registrar el cobro ahora</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onPayLater}
          className="w-full flex items-center gap-4 rounded-xl border-2 border-border px-5 py-4 text-left hover:border-muted hover:bg-surface active:scale-[0.98] transition-all"
        >
          <span className="text-3xl">🕐</span>
          <div>
            <p className="font-semibold text-primary">Pagar después</p>
            <p className="text-xs text-muted mt-0.5">El pedido ya está en cocina/bar. El cobro queda pendiente.</p>
          </div>
        </button>
      </div>
    </div>
  )
}

// ─── Main flow ────────────────────────────────────────────────────────────────

export function OrderFlow({ onComplete, onCancel }: OrderFlowProps) {
  const { post } = useApi()
  const { items, tableId, type, notes, isAdditional, parentOrderId, tableNumber, clear } = useCartStore()

  const [currentStep, setCurrentStep] = useState<StepName>('Platos')
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null)
  const [orderTotal, setOrderTotal] = useState(0)
  const [showPayChoice, setShowPayChoice] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)

  const totalItems = items.reduce((a, i) => a + i.quantity, 0)

  const handleConfirmOrder = async () => {
    if (items.length === 0) return
    setCreatingOrder(true)
    setOrderError(null)

    try {
      const order = await post<ApiOrder>('/orders', {
        tableId: tableId ?? undefined,
        type,
        notes: notes || undefined,
        parentOrderId: isAdditional ? parentOrderId : undefined,
        items: items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          notes: i.notes || undefined,
        })),
      })

      const subtotal = items.reduce((a, i) => a + i.basePrice * i.quantity, 0)
      const invoice = await post<ApiInvoice>('/invoices', {
        orderId: order.id,
        paymentMethod: 'cash',
        subtotal,
        tax: 0,
        total: subtotal,
      })

      setCreatedOrderId(order.id)
      setCreatedInvoiceId(invoice.id)
      setOrderTotal(Number(invoice.total) || subtotal)
      setShowPayChoice(true)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al crear el pedido'
      setOrderError(msg)
    } finally {
      setCreatingOrder(false)
    }
  }

  // "Pagar ahora" → open payment modal
  const handlePayNow = () => {
    setShowPayChoice(false)
    setShowPayment(true)
  }

  // "Pagar después" → navigate back to board; table shows "Falta pagar" badge
  const handlePayLater = () => {
    clear()
    onComplete()
  }

  // PaymentModal success
  const handlePaymentSuccess = () => {
    clear()
    onComplete()
  }

  // PaymentModal cancel (don't discard the order — it already exists)
  const handlePaymentCancel = () => {
    setShowPayment(false)
    setShowPayChoice(true)
  }

  if (showPayment && createdOrderId && createdInvoiceId) {
    return (
      <PaymentModal
        orderId={createdOrderId}
        invoiceId={createdInvoiceId}
        total={orderTotal}
        onSuccess={handlePaymentSuccess}
        onCancel={handlePaymentCancel}
      />
    )
  }

  if (showPayChoice) {
    return (
      <div className="flex flex-col h-full">
        <StepIndicator current="Resumen" />
        <PayChoiceScreen
          total={orderTotal}
          onPayNow={handlePayNow}
          onPayLater={handlePayLater}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <StepIndicator current={currentStep} />

      <div className="flex-1 overflow-y-auto">
        {currentStep === 'Platos' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-primary">
                {type === 'delivery' ? 'Delivery' : `Mesa ${tableNumber}`}
                {isAdditional && <span className="ml-2 text-sm font-body font-normal text-[#A05A2C]">• Adicional</span>}
              </h2>
              <button onClick={onCancel} className="text-muted hover:text-primary text-sm" aria-label="Cancelar pedido">
                Cancelar
              </button>
            </div>
            <MenuGrid type="food" />
          </div>
        )}

        {currentStep === 'Bebidas' && (
          <div>
            <h2 className="font-display text-xl font-bold text-primary mb-4">Bebidas</h2>
            <MenuGrid type="drink" />
          </div>
        )}

        {currentStep === 'Resumen' && (
          <OrderSummary
            onConfirm={handleConfirmOrder}
            onBack={() => setCurrentStep('Bebidas')}
            loading={creatingOrder}
          />
        )}
      </div>

      {orderError && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">
          {orderError}
        </p>
      )}

      {(currentStep === 'Platos' || currentStep === 'Bebidas') && (
        <div className="pt-4 border-t border-border mt-4 flex items-center gap-3">
          {currentStep === 'Bebidas' && (
            <Button variant="ghost" onClick={() => setCurrentStep('Platos')}>
              ← Platos
            </Button>
          )}
          <div className="flex-1" />
          {totalItems > 0 && (
            <span className="text-sm text-muted font-body">
              {totalItems} ítem{totalItems !== 1 ? 's' : ''}
            </span>
          )}
          {currentStep === 'Platos' ? (
            <Button variant="primary" onClick={() => setCurrentStep('Bebidas')}>
              Bebidas →
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => setCurrentStep('Resumen')}
              disabled={totalItems === 0}
            >
              Resumen →
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
