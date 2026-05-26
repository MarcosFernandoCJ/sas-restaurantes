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

  // Chef claims an item — transitions to in_prep and assigns chef
  async claimItem(itemId: string, chefId: string) {
    return prisma.orderItem.update({
      where: { id: itemId },
      data: {
        status: 'in_prep',
        assignedChefId: chefId,
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
      data: { status: 'served' },
      select: { id: true, orderId: true, status: true },
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
