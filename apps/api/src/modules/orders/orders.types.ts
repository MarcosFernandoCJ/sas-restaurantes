import type { OrderStatus, OrderType, ItemStatus } from '@prisma/client'

export interface CreateOrderItemInput {
  menuItemId: string
  quantity: number
  notes?: string
}

export interface CreateOrderServiceInput {
  tableId?: string
  waiterId: string
  type: OrderType
  notes?: string
  items: CreateOrderItemInput[]
  parentOrderId?: string
}

export interface OrderFilters {
  status?: OrderStatus
  type?: OrderType
  waiterId?: string
  tableId?: string
  skip: number
  take: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  pages: number
}

export type { OrderStatus, OrderType, ItemStatus }
