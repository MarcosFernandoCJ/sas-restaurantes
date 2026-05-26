import { prisma } from '../../lib/prisma'
import type { OrderStatus, OrderType, Prisma } from '@prisma/client'

const orderInclude = {
  items: {
    include: {
      menuItem: {
        select: { id: true, name: true, prepTimeMinutes: true },
      },
    },
  },
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      subtotal: true,
      tax: true,
      total: true,
      status: true,
      paymentMethod: true,
      paidAt: true,
    },
  },
  table: { select: { id: true, number: true, section: true } },
  waiter: { select: { id: true, name: true, email: true } },
}

export const ordersRepository = {
  async findMenuItemById(menuItemId: string) {
    return prisma.menuItem.findUnique({
      where: { id: menuItemId },
      select: { id: true, basePrice: true, isAvailable: true, name: true },
    })
  },

  async create(data: {
    tableId?: string
    waiterId: string
    type: OrderType
    notes?: string
    isAdditional: boolean
    parentOrderId?: string
    items: { menuItemId: string; quantity: number; notes?: string; unitPrice: number }[]
  }) {
    return prisma.order.create({
      data: {
        tableId: data.tableId,
        waiterId: data.waiterId,
        type: data.type,
        notes: data.notes,
        isAdditional: data.isAdditional,
        parentOrderId: data.parentOrderId,
        items: {
          create: data.items.map(item => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            notes: item.notes,
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: orderInclude,
    })
  },

  async findMany(filters: {
    status?: OrderStatus
    type?: OrderType
    waiterId?: string
    tableId?: string
    skip: number
    take: number
  }) {
    const where: Prisma.OrderWhereInput = {}
    if (filters.status) where.status = filters.status
    if (filters.type) where.type = filters.type
    if (filters.waiterId) where.waiterId = filters.waiterId
    if (filters.tableId) where.tableId = filters.tableId

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.order.count({ where }),
    ])

    return { orders, total }
  },

  async findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    })
  },

  async updateStatus(id: string, status: OrderStatus) {
    return prisma.order.update({
      where: { id },
      data: { status },
      include: orderInclude,
    })
  },

  async addItems(
    orderId: string,
    items: { menuItemId: string; quantity: number; notes?: string; unitPrice: number }[]
  ) {
    return prisma.orderItem.createMany({
      data: items.map(item => ({
        orderId,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes,
        unitPrice: item.unitPrice,
      })),
    })
  },

  async getAllItemStatuses(orderId: string) {
    return prisma.orderItem.findMany({
      where: { orderId },
      select: { status: true },
    })
  },
}
