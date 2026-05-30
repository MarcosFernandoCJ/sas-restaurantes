import { useState } from 'react'
import { Button } from '@sas/ui'
import type { PaymentMethod } from '../types'
import { useApi, ApiError } from '../hooks/useApi'
import { useCartStore } from '../store/cart.store'

interface PaymentModalProps {
  orderId: string
  invoiceId: string
  total: number
  onSuccess: () => void
  onCancel: () => void
}

type Step = 'select' | 'processing' | 'success' | 'error'

const PAYMENT_OPTIONS: { method: PaymentMethod; label: string; icon: string; desc: string; hasReference: boolean }[] = [
  { method: 'cash',  label: 'Efectivo',        icon: '💵', desc: 'El cliente paga en efectivo al mesero', hasReference: false },
  { method: 'card',  label: 'POS / Tarjeta',   icon: '💳', desc: 'Tarjeta débito o crédito vía terminal POS', hasReference: true },
  { method: 'yape',  label: 'QR Yape',          icon: '📱', desc: 'Pago por QR Yape', hasReference: true },
  { method: 'plin',  label: 'QR Plin',          icon: '📲', desc: 'Pago por QR Plin', hasReference: true },
]

export function PaymentModal({ orderId: _orderId, invoiceId, total, onSuccess, onCancel }: PaymentModalProps) {
  const { post } = useApi()
  const clear = useCartStore((s) => s.clear)

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [step, setStep] = useState<Step>('select')
  const [errorMsg, setErrorMsg] = useState('')

  const selectedOption = PAYMENT_OPTIONS.find((o) => o.method === selectedMethod)!

  const handlePay = async () => {
    setStep('processing')
    setErrorMsg('')

    try {
      await post(`/invoices/${invoiceId}/pay`, {
        paymentMethod: selectedMethod,
        paymentReference: reference.trim() || undefined,
      })
      clear()
      setStep('success')
      setTimeout(onSuccess, 1200)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al registrar el pago'
      setErrorMsg(msg)
      setStep('error')
    }
  }

  if (step === 'success') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-xs w-full shadow-xl">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="font-display text-2xl font-bold text-[#1A6B3C]">¡Pago confirmado!</h2>
          <p className="text-muted mt-2 font-body">El pago quedó registrado.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" role="dialog" aria-modal>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-primary px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Registrar cobro</h2>
            <p className="font-mono text-white/80 text-lg font-bold">S/ {total.toFixed(2)}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-white/70 hover:text-white text-2xl leading-none"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Payment method selection */}
          <fieldset>
            <legend className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
              Método de cobro
            </legend>
            <div className="space-y-2">
              {PAYMENT_OPTIONS.map(({ method, label, icon, desc }) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => { setSelectedMethod(method); setReference('') }}
                  className={[
                    'w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all',
                    selectedMethod === method
                      ? 'border-secondary bg-secondary/5'
                      : 'border-border hover:border-secondary/50',
                  ].join(' ')}
                >
                  <span className="text-2xl">{icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-primary font-body text-sm">{label}</p>
                    <p className="text-xs text-muted">{desc}</p>
                  </div>
                  {selectedMethod === method && (
                    <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-white text-xs shrink-0">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Optional reference for card/QR payments */}
          {selectedOption.hasReference && (
            <div>
              <label htmlFor="pay-reference" className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
                Referencia / Código (opcional)
              </label>
              <input
                id="pay-reference"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="N° operación o últimos 4 dígitos"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-secondary/40"
              />
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="ghost" onClick={onCancel} disabled={step === 'processing'}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={handlePay}
              loading={step === 'processing'}
              className="flex-1"
            >
              {step === 'processing' ? 'Registrando…' : `Confirmar cobro · S/ ${total.toFixed(2)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
