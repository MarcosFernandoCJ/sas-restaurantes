/**
 * DEV-ONLY routes — never accessible in production.
 * POST /dev/simulate — crea 2 pedidos pagados y los emite a la cocina.
 *
 * Pedido 1: Mesa 5 → Pollo a la Brasa ×2 + Inca Kola ×2
 * Pedido 2: Adicional (misma mesa) → Lomo Saltado ×1 + Chicha Morada ×1
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { invoicesService } from '../invoices/invoices.service'

function generateInvoiceNumber(): string {
  const date = new Date()
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '')
  return `SIM-${yyyymmdd}-${Date.now().toString().slice(-6)}`
}

export async function devRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/dev/simulate', async (request, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.status(404).send({ error: 'Not found' })
    }

    // ── Buscar datos base en la BD ───────────────────────────────────────────
    const waiter = await prisma.user.findFirst({ where: { role: 'waiter' } })
    if (!waiter) return reply.status(500).send({ error: 'No hay meseros en la BD. Ejecuta pnpm db:seed primero.' })

    const table = await prisma.table.findFirst({ where: { number: 5 } })
    if (!table) return reply.status(500).send({ error: 'Mesa 5 no encontrada. Ejecuta pnpm db:seed primero.' })

    const [polloItem, lomoItem, incaKolaItem, chichaItem] = await Promise.all([
      prisma.menuItem.findFirst({ where: { name: { contains: 'Pollo a la Brasa' } } }),
      prisma.menuItem.findFirst({ where: { name: { contains: 'Lomo Saltado' } } }),
      prisma.menuItem.findFirst({ where: { name: { contains: 'Inca Kola' } } }),
      prisma.menuItem.findFirst({ where: { name: { contains: 'Chicha Morada' } } }),
    ])

    if (!polloItem || !lomoItem || !incaKolaItem || !chichaItem) {
      return reply.status(500).send({ error: 'Faltan items del menú. Ejecuta pnpm db:seed primero.' })
    }

    // ── Pedido 1: Mesa 5 — plato + bebida ───────────────────────────────────
    const order1 = await prisma.order.create({
      data: {
        tableId: table.id,
        waiterId: waiter.id,
        type: 'dine_in',
        notes: 'Sin cebolla en el pollo',
        isAdditional: false,
        items: {
          create: [
            { menuItemId: polloItem.id, quantity: 2, unitPrice: Number(polloItem.basePrice), notes: 'Bien doradito' },
            { menuItemId: incaKolaItem.id, quantity: 2, unitPrice: Number(incaKolaItem.basePrice) },
          ],
        },
      },
      include: { items: { include: { menuItem: { select: { name: true } } } } },
    })

    const subtotal1 = 2 * Number(polloItem.basePrice) + 2 * Number(incaKolaItem.basePrice)
    const invoice1 = await prisma.invoice.create({
      data: {
        orderId: order1.id,
        invoiceNumber: generateInvoiceNumber(),
        subtotal: subtotal1,
        tax: 0,
        total: subtotal1,
        paymentMethod: 'cash',
      },
    })

    // payInvoice emite order:created a room:kitchen con el payload correcto
    await invoicesService.payInvoice(invoice1.id, {})

    request.log.info({ msg: '[DEV] Pedido 1 creado y pagado', orderId: order1.id })

    // ── Pedido 2: Adicional de la misma mesa ─────────────────────────────────
    const order2 = await prisma.order.create({
      data: {
        tableId: table.id,
        waiterId: waiter.id,
        type: 'dine_in',
        isAdditional: true,
        parentOrderId: order1.id,
        items: {
          create: [
            { menuItemId: lomoItem.id, quantity: 1, unitPrice: Number(lomoItem.basePrice) },
            { menuItemId: chichaItem.id, quantity: 2, unitPrice: Number(chichaItem.basePrice) },
          ],
        },
      },
      include: { items: { include: { menuItem: { select: { name: true } } } } },
    })

    const subtotal2 = Number(lomoItem.basePrice) + 2 * Number(chichaItem.basePrice)
    const invoice2 = await prisma.invoice.create({
      data: {
        orderId: order2.id,
        invoiceNumber: generateInvoiceNumber(),
        subtotal: subtotal2,
        tax: 0,
        total: subtotal2,
        paymentMethod: 'cash',
      },
    })

    // payInvoice detecta isAdditional=true y emite order:additional a room:kitchen
    await invoicesService.payInvoice(invoice2.id, {})

    request.log.info({ msg: '[DEV] Pedido adicional creado y pagado', orderId: order2.id })

    return reply.status(200).send({
      message: 'Simulación completada. Revisa /kitchen para ver los pedidos.',
      orders: [
        { id: order1.id, orderNumber: order1.orderNumber, type: 'dine_in', mesa: 5, items: (order1.items as Array<{ menuItem: { name: string } }>).map((i) => i.menuItem.name) },
        { id: order2.id, orderNumber: order2.orderNumber, type: 'additional', mesa: 5, items: (order2.items as Array<{ menuItem: { name: string } }>).map((i) => i.menuItem.name) },
      ],
    })
  })
}