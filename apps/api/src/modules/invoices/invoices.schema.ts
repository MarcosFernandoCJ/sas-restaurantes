import { z } from 'zod'

export const createInvoiceSchema = z.object({
  orderId: z.string().uuid({ message: 'orderId debe ser un UUID válido' }),
  paymentMethod: z.enum(['cash', 'card', 'yape', 'plin', 'other']).default('cash'),
  subtotal: z.number().positive({ message: 'subtotal debe ser mayor a 0' }),
  tax: z.number().min(0).default(0),
  total: z.number().positive({ message: 'total debe ser mayor a 0' }),
})

export const payInvoiceSchema = z.object({
  paymentReference: z.string().optional(),
})

export type CreateInvoiceBody = z.infer<typeof createInvoiceSchema>
export type PayInvoiceBody = z.infer<typeof payInvoiceSchema>
