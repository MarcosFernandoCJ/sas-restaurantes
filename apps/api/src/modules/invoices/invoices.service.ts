import { invoicesRepository } from './invoices.repository'
import { emitToRoom } from '../../lib/socket'
import type { CreateInvoiceBody, PayInvoiceBody } from './invoices.schema'

function makeError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode })
}

function generateInvoiceNumber(): string {
  const date = new Date()
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '')
  return `INV-${yyyymmdd}-${Date.now().toString().slice(-6)}`
}

export const invoicesService = {
  async createInvoice(data: CreateInvoiceBody) {
    const existing = await invoicesRepository.findByOrderId(data.orderId)
    if (existing) throw makeError('Este pedido ya tiene una factura', 409)

    return invoicesRepository.create({
      ...data,
      invoiceNumber: generateInvoiceNumber(),
    })
  },

  async getInvoiceById(id: string) {
    const invoice = await invoicesRepository.findById(id)
    if (!invoice) throw makeError('Factura no encontrada', 404)
    return invoice
  },

  // Marks invoice as paid and emits the kitchen event.
  // REGLA CRÍTICA: nunca modificar una invoice con status = 'paid'.
  async payInvoice(id: string, body: PayInvoiceBody) {
    const invoice = await invoicesRepository.findById(id)
    if (!invoice) throw makeError('Factura no encontrada', 404)
    if (invoice.status === 'paid') throw makeError('La factura ya fue pagada', 409)
    if (invoice.status === 'voided') throw makeError('La factura está anulada y no puede pagarse', 409)

    const paid = await invoicesRepository.markAsPaid(
      id,
      body.paymentMethod as import('@prisma/client').PaymentMethod | undefined,
      body.paymentReference
    )

    // Notify the waiter so their TableDetail refreshes the invoice status
    const waiterId = paid.order.waiter.id
    const tableId = paid.order.table?.id ?? null
    if (tableId) {
      emitToRoom(`room:waiter:${waiterId}`, 'table:updated', {
        tableId,
        orderId: paid.order.id,
      })
    }

    return paid
  },
}
