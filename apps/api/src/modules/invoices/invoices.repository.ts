import { prisma } from '../../lib/prisma'
import type { PaymentMethod } from '@prisma/client'

const invoiceWithOrderInclude = {
  order: {
    include: {
      items: {
        include: {
          menuItem: { select: { id: true, name: true, prepTimeMinutes: true } },
        },
      },
      table: { select: { id: true, number: true, section: true } },
      waiter: { select: { id: true, name: true, email: true } },
    },
  },
} as const

export const invoicesRepository = {
  async findById(id: string) {
    return prisma.invoice.findUnique({
      where: { id },
      include: invoiceWithOrderInclude,
    })
  },

  async findByOrderId(orderId: string) {
    return prisma.invoice.findUnique({
      where: { orderId },
      include: invoiceWithOrderInclude,
    })
  },

  async create(data: {
    orderId: string
    invoiceNumber: string
    subtotal: number
    tax: number
    total: number
    paymentMethod: PaymentMethod
  }) {
    return prisma.invoice.create({
      data,
      include: invoiceWithOrderInclude,
    })
  },

  // REGLA CRÍTICA: solo puede llamarse si status === 'pending'. Nunca modificar una factura 'paid'.
  async markAsPaid(id: string, paymentReference?: string) {
    return prisma.invoice.update({
      where: { id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        paymentReference,
      },
      include: invoiceWithOrderInclude,
    })
  },
}
