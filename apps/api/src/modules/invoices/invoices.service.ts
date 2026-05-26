import { invoicesRepository } from './invoices.repository'
import { emitToRoom } from '../../lib/socket'
import type { CreateInvoiceBody, PayInvoiceBody } from './invoices.schema'

function makeError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode })
}

type PaidInvoiceOrder = NonNullable<Awaited<ReturnType<typeof invoicesRepository.findById>>>['order']

type OrderItemForKitchen = {
  id: string
  quantity: number
  notes: string | null
  status: string
  menuItem: { name: string }
}

// Maps the Prisma order to the flat payload the kitchen socket hook expects.
// Shape must match OrderCreatedPayload in apps/web/src/features/kitchen/types.ts
function toKitchenPayload(order: PaidInvoiceOrder) {
  const items = order.items as OrderItemForKitchen[]
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    type: order.type as 'dine_in' | 'delivery',
    tableNumber: order.table?.number ?? undefined,
    isAdditional: order.isAdditional,
    parentOrderId: order.parentOrderId ?? undefined,
    notes: order.notes ?? undefined,
    createdAt: order.createdAt.toISOString(),
    items: items.map((item) => ({
      id: item.id,
      menuItemName: item.menuItem.name,
      quantity: item.quantity,
      notes: item.notes ?? undefined,
      status: item.status as 'pending' | 'in_prep' | 'ready' | 'served',
    })),
  }
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

    const paid = await invoicesRepository.markAsPaid(id, body.paymentReference)

    // Notify kitchen
    const event = paid.order.isAdditional ? 'order:additional' : 'order:created'
    emitToRoom('room:kitchen', event, toKitchenPayload(paid.order))

    // Notify the waiter so their TableDetail refreshes in real-time
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
