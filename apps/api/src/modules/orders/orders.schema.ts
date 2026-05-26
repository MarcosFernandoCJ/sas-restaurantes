import { z } from 'zod'

const orderItemSchema = z.object({
  menuItemId: z.string().uuid({ message: 'menuItemId debe ser un UUID válido' }),
  quantity: z.number().int().positive({ message: 'quantity debe ser un entero positivo' }),
  notes: z.string().optional(),
})

export const createOrderSchema = z.object({
  tableId: z.string().uuid().optional(),
  type: z.enum(['dine_in', 'delivery']).default('dine_in'),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1, { message: 'El pedido debe tener al menos un ítem' }),
  parentOrderId: z.string().uuid().optional(),
})

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'in_prep', 'ready', 'delivered', 'cancelled']),
})

export const addOrderItemsSchema = z.object({
  items: z.array(orderItemSchema).min(1, { message: 'Debe agregar al menos un ítem' }),
})

export const listOrdersQuerySchema = z.object({
  status: z.enum(['pending', 'in_prep', 'ready', 'delivered', 'cancelled']).optional(),
  type: z.enum(['dine_in', 'delivery']).optional(),
  waiterId: z.string().uuid().optional(),
  tableId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const updateOrderItemSchema = z.object({
  notes: z.string().min(1, { message: 'Las notas no pueden estar vacías' }),
})

export type CreateOrderBody = z.infer<typeof createOrderSchema>
export type UpdateOrderStatusBody = z.infer<typeof updateOrderStatusSchema>
export type AddOrderItemsBody = z.infer<typeof addOrderItemsSchema>
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>
export type UpdateOrderItemBody = z.infer<typeof updateOrderItemSchema>
