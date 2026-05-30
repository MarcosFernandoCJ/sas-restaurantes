import { prisma } from '../../lib/prisma'

const itemWithContextInclude = {
  order: {
    include: {
      waiter: { select: { id: true, name: true } },
      table: { select: { id: true, number: true } },
    },
  },
  menuItem: { select: { id: true, name: true } },
  assignedChef: { select: { id: true, name: true } },
} as const

export const orderItemsRepository = {
  async findById(id: string) {
    return prisma.orderItem.findUnique({
      where: { id },
      include: itemWithContextInclude,
    })
  },

  // Chef claims an item — transitions to in_prep and optionally assigns chef.
  // chefId is null when called from the unauthenticated kitchen display.
  async claimItem(itemId: string, chefId: string | null) {
    return prisma.orderItem.update({
      where: { id: itemId },
      data: {
        status: 'in_prep',
        ...(chefId ? { assignedChefId: chefId } : {}),
        prepStartedAt: new Date(),
      },
      include: itemWithContextInclude,
    })
  },

  // Chef marks item as ready for pickup
  async markItemReady(itemId: string) {
    return prisma.orderItem.update({
      where: { id: itemId },
      data: {
        status: 'ready',
        prepFinishedAt: new Date(),
      },
      include: itemWithContextInclude,
    })
  },

  // Waiter confirms item was delivered to the table
  async markItemServed(itemId: string) {
    return prisma.orderItem.update({
      where: { id: itemId },
      data: { status: 'served', deliveredAt: new Date() },
      select: { id: true, orderId: true, status: true },
    })
  },

  // Records when the waiter was notified the item is ready for pickup
  async setNotifiedAt(itemId: string) {
    return prisma.orderItem.update({
      where: { id: itemId },
      data: { notifiedAt: new Date() },
      select: { id: true },
    })
  },

  // Waiter updates item notes while item is in_prep
  async updateNotes(itemId: string, notes: string) {
    return prisma.orderItem.update({
      where: { id: itemId },
      data: { notes },
      select: { id: true, orderId: true, notes: true, status: true },
    })
  },
}
