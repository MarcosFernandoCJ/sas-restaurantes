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

export function OrderFlow({ onComplete, onCancel }: OrderFlowProps) {
  const { post } = useApi()
  const { items, tableId, type, notes, isAdditional, parentOrderId, tableNumber, clear } = useCartStore()

  const [currentStep, setCurrentStep] = useState<StepName>('Platos')
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null)
  const [orderTotal, setOrderTotal] = useState(0)
  const [showPayment, setShowPayment] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)

  const foodCount = items.length
  const totalItems = items.reduce((a, i) => a + i.quantity, 0)

  const handleConfirmOrder = async () => {
    if (items.length === 0) return
    setCreatingOrder(true)
    setOrderError(null)

    try {
      // Step 1: Create order
      const orderPayload = {
        tableId: tableId ?? undefined,
        type,
        notes: notes || undefined,
        parentOrderId: isAdditional ? parentOrderId : undefined,
        items: items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          notes: i.notes || undefined,
        })),
      }
      const order = await post<ApiOrder>('/orders', orderPayload)

      // Step 2: Create invoice (total computed from server prices)
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
      setOrderTotal(subtotal)
      setShowPayment(true)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al crear el pedido'
      setOrderError(msg)
    } finally {
      setCreatingOrder(false)
    }
  }

  if (showPayment && createdOrderId && createdInvoiceId) {
    return (
      <PaymentModal
        orderId={createdOrderId}
        invoiceId={createdInvoiceId}
        total={orderTotal}
        onSuccess={() => {
          clear()
          onComplete()
        }}
        onCancel={() => {
          // Order was created but not paid — stay on payment modal
          // In a real app we'd offer retry or void the invoice
          setShowPayment(false)
          setCurrentStep('Resumen')
        }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator */}
      <StepIndicator current={currentStep} />

      {/* Step content */}
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

      {/* Error */}
      {orderError && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">
          {orderError}
        </p>
      )}

      {/* Bottom nav (only for food/drink steps) */}
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
            <Button
              variant="primary"
              onClick={() => setCurrentStep('Bebidas')}
            >
              Bebidas →
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => setCurrentStep('Resumen')}
              disabled={foodCount === 0 && totalItems === 0}
            >
              Resumen →
            </Button>
          )}
        </div>
      )}
    </div>
  )
}