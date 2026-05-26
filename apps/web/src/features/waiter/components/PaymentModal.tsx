import React, { useState, useEffect, useCallback } from 'react'
import { Button, Spinner } from '@sas/ui'
import type { PaymentMethod } from '../types'
import { useApi, ApiError } from '../hooks/useApi'
import { useCartStore } from '../store/cart.store'

// Culqi SDK types
declare global {
  interface Window {
    Culqi?: {
      publicKey: string
      settings: (opts: { title: string; currency: string; description: string; amount: number }) => void
      open: () => void
      close: () => void
      token?: { id: string }
    }
    culqi?: () => void
  }
}

interface PaymentModalProps {
  orderId: string
  invoiceId: string
  total: number
  onSuccess: () => void
  onCancel: () => void
}

type Step = 'select' | 'processing' | 'success' | 'error'

const PAYMENT_OPTIONS: { method: PaymentMethod; label: string; icon: string; desc: string }[] = [
  { method: 'cash', label: 'Efectivo', icon: '💵', desc: 'El cliente paga al mesero' },
  { method: 'card', label: 'Tarjeta', icon: '💳', desc: 'Visa / Mastercard vía Culqi' },
  { method: 'yape', label: 'Yape', icon: '📱', desc: 'QR Yape / Plin' },
]

export function PaymentModal({ orderId, invoiceId, total, onSuccess, onCancel }: PaymentModalProps) {
  const { post } = useApi()
  const clear = useCartStore((s) => s.clear)

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash')
  const [step, setStep] = useState<Step>('select')
  const [errorMsg, setErrorMsg] = useState('')

  // Register the Culqi callback so it fires after tokenization
  const handleCulqiToken = useCallback(async () => {
    const token = window.Culqi?.token?.id
    if (!token) {
      setErrorMsg('No se pudo obtener el token de Culqi')
      setStep('error')
      return
    }

    try {
      await post(`/invoices/${invoiceId}/pay`, { paymentReference: token })
      clear()
      setStep('success')
      setTimeout(onSuccess, 1500)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al procesar el pago'
      setErrorMsg(msg)
      setStep('error')
    }
  }, [invoiceId, post, clear, onSuccess])

  useEffect(() => {
    window.culqi = handleCulqiToken
    return () => { delete window.culqi }
  }, [handleCulqiToken])

  const handlePay = async () => {
    setStep('processing')
    setErrorMsg('')

    if (selectedMethod === 'cash') {
      try {
        await post(`/invoices/${invoiceId}/pay`, {})
        clear()
        setStep('success')
        setTimeout(onSuccess, 1500)
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Error al registrar el pago'
        setErrorMsg(msg)
        setStep('error')
      }
      return
    }

    if (selectedMethod === 'card') {
      const culqi = window.Culqi
      if (!culqi) {
        setErrorMsg('El SDK de Culqi no está cargado. Verifica la conexión a internet.')
        setStep('error')
        return
      }
      culqi.publicKey = import.meta.env.VITE_CULQI_PUBLIC_KEY ?? 'pk_test_placeholder'
      culqi.settings({
        title: 'SAS Restaurantes',
        currency: 'PEN',
        description: `Pedido #${orderId.slice(-6).toUpperCase()}`,
        amount: Math.round(total * 100),
      })
      culqi.open()
      setStep('select') // UI stays open while Culqi popup is shown
      return
    }

    if (selectedMethod === 'yape') {
      // For MVP: show mock QR, confirm manually
      setStep('select')
    }
  }

  if (step === 'success') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-xs w-full shadow-xl">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="font-display text-2xl font-bold text-[#1A6B3C]">¡Pago confirmado!</h2>
          <p className="text-muted mt-2 font-body">El pedido fue enviado a cocina.</p>
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
            <h2 className="font-display text-xl font-bold text-white">Procesar pago</h2>
            <p className="font-mono text-white/80 text-lg font-bold">S/ {total.toFixed(2)}</p>
          </div>
          <button onClick={onCancel} className="text-white/70 hover:text-white text-2xl" aria-label="Cerrar">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Payment method selection */}
          <div className="space-y-2">
            {PAYMENT_OPTIONS.map(({ method, label, icon, desc }) => (
              <button
                key={method}
                type="button"
                onClick={() => setSelectedMethod(method)}
                className={[
                  'w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all',
                  selectedMethod === method
                    ? 'border-secondary bg-secondary/5'
                    : 'border-border hover:border-secondary/50',
                ].join(' ')}
              >
                <span className="text-2xl">{icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-primary font-body">{label}</p>
                  <p className="text-xs text-muted">{desc}</p>
                </div>
                {selectedMethod === method && (
                  <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-white text-xs">✓</span>
                )}
              </button>
            ))}
          </div>

          {/* Yape QR mock */}
          {selectedMethod === 'yape' && (
            <div className="text-center py-3 border border-border rounded-xl bg-surface">
              <div className="w-32 h-32 mx-auto bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                QR Yape / Plin
              </div>
              <p className="text-xs text-muted mt-2">Muestra este QR al cliente</p>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <div className="flex gap-3">
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
              {step === 'processing' ? 'Procesando...' : `Confirmar ${selectedMethod === 'cash' ? 'efectivo' : selectedMethod === 'card' ? 'tarjeta' : 'Yape'}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}