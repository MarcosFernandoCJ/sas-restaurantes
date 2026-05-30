import type { FastifyInstance } from 'fastify'
import { requireRole } from '../../middleware/require-role'
import { prisma } from '../../lib/prisma'
import bcrypt from 'bcryptjs'
import type { IngredientStatus, CategoryType, UserRole, WaiterMode } from '@prisma/client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeIngredientStatus(stockQty: number, minStockQty: number): IngredientStatus {
  if (stockQty <= 0) return 'out'
  if (stockQty <= minStockQty) return 'critical'
  if (stockQty <= minStockQty * 2) return 'low'
  return 'ok'
}

function toNumber(v: unknown): number {
  return typeof v === 'object' && v !== null ? Number(v) : Number(v)
}

function serializeIngredient(i: Record<string, unknown>) {
  return {
    ...i,
    stockQty: toNumber(i.stockQty),
    minStockQty: toNumber(i.minStockQty),
    unitCost: toNumber(i.unitCost),
  }
}

function serializeRecipe(r: Record<string, unknown> & { ingredient?: Record<string, unknown> }) {
  return {
    ...r,
    quantityNeeded: toNumber(r.quantityNeeded),
    ingredient: r.ingredient
      ? {
          ...r.ingredient,
          unitCost: toNumber(r.ingredient.unitCost),
          stockQty: r.ingredient.stockQty !== undefined ? toNumber(r.ingredient.stockQty) : undefined,
          minStockQty: r.ingredient.minStockQty !== undefined ? toNumber(r.ingredient.minStockQty) : undefined,
        }
      : undefined,
  }
}

function serializeMenuItem(item: Record<string, unknown> & { recipes?: unknown[] }) {
  return {
    ...item,
    basePrice: toNumber(item.basePrice),
    recipes: ((item.recipes ?? []) as Record<string, unknown>[]).map(serializeRecipe as any),
  }
}

// System settings helpers
const SETTING_DEFAULTS: Record<string, string> = {
  reminderIntervalMin: '3',
  criticalTimerMin: '15',
  tableMode: 'free',
}

async function getSetting(key: string): Promise<string> {
  const s = await prisma.systemSetting.findUnique({ where: { key } })
  return s?.value ?? SETTING_DEFAULTS[key] ?? ''
}

function todayRange(): { gte: Date; lt: Date } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return { gte: today, lt: tomorrow }
}

function getReportRange(period: string): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(now)

  if (period === 'week') {
    const day = start.getDay()
    const diff = day === 0 ? -6 : 1 - day // Monday-based
    start.setDate(start.getDate() + diff)
  } else if (period === 'month') {
    start.setDate(1)
  } else if (period === 'year') {
    start.setMonth(0, 1)
  }
  start.setHours(0, 0, 0, 0)

  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  const adminOnly = requireRole(['admin'])
  const adminOrWaiter = requireRole(['admin', 'waiter'])

  // ── Ingredients ────────────────────────────────────────────────────────────

  fastify.get('/admin/ingredients', { preHandler: adminOnly }, async (_req, reply) => {
    const rows = await prisma.ingredient.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })
    return reply.send(rows.map(serializeIngredient as any))
  })

  fastify.post('/admin/ingredients', { preHandler: adminOnly }, async (request, reply) => {
    const body = request.body as {
      name: string
      unit: string
      stockQty: number
      minStockQty: number
      unitCost: number
      supplierId?: string | null
    }
    const status = computeIngredientStatus(body.stockQty, body.minStockQty)
    const row = await prisma.ingredient.create({
      data: {
        name: body.name.trim(),
        unit: body.unit,
        stockQty: body.stockQty,
        minStockQty: body.minStockQty,
        unitCost: body.unitCost,
        supplierId: body.supplierId ?? null,
        status,
      },
    })
    return reply.status(201).send(serializeIngredient(row as any))
  })

  fastify.patch('/admin/ingredients/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Partial<{
      name: string
      unit: string
      stockQty: number
      minStockQty: number
      unitCost: number
      isActive: boolean
      supplierId: string | null
    }>

    let status: IngredientStatus | undefined
    if (body.stockQty !== undefined || body.minStockQty !== undefined) {
      const cur = await prisma.ingredient.findUniqueOrThrow({ where: { id } })
      const sq = body.stockQty ?? Number(cur.stockQty)
      const mq = body.minStockQty ?? Number(cur.minStockQty)
      status = computeIngredientStatus(sq, mq)
    }

    const row = await prisma.ingredient.update({
      where: { id },
      data: { ...body, ...(status ? { status } : {}) },
    })
    return reply.send(serializeIngredient(row as any))
  })

  // ── Menu Categories ────────────────────────────────────────────────────────

  fastify.get('/admin/menu-categories', { preHandler: adminOrWaiter }, async (_req, reply) => {
    const rows = await prisma.menuCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    return reply.send(rows)
  })

  fastify.post('/admin/menu-categories', { preHandler: adminOnly }, async (request, reply) => {
    const body = request.body as { name: string; type: CategoryType; sortOrder?: number }
    const row = await prisma.menuCategory.create({
      data: { name: body.name.trim(), type: body.type, sortOrder: body.sortOrder ?? 0 },
    })
    return reply.status(201).send(row)
  })

  fastify.patch('/admin/menu-categories/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Partial<{ name: string; type: CategoryType; sortOrder: number; isActive: boolean }>
    const row = await prisma.menuCategory.update({ where: { id }, data: body })
    return reply.send(row)
  })

  // ── Menu Items ─────────────────────────────────────────────────────────────

  fastify.get('/admin/menu-items', { preHandler: adminOrWaiter }, async (_req, reply) => {
    const rows = await prisma.menuItem.findMany({
      where: { isActive: true },
      include: {
        category: { select: { id: true, name: true, type: true, sortOrder: true } },
        recipes: {
          include: {
            ingredient: { select: { id: true, name: true, unit: true, unitCost: true } },
          },
        },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { isFeatured: 'desc' }, { name: 'asc' }],
    })
    return reply.send(rows.map(serializeMenuItem as any))
  })

  fastify.post('/admin/menu-items', { preHandler: adminOnly }, async (request, reply) => {
    const body = request.body as {
      name: string
      categoryId: string
      description?: string | null
      basePrice: number
      prepTimeMinutes: number
      isFeatured?: boolean
      isAvailable?: boolean
      imageUrl?: string | null
      isDirectIngredient?: boolean
      recipes?: { ingredientId: string; quantityNeeded: number; notes?: string | null }[]
    }

    const recipeLines = (body.isDirectIngredient ? [] : (body.recipes ?? []))
      .filter((r) => r.ingredientId)

    const row = await prisma.menuItem.create({
      data: {
        name: body.name.trim(),
        categoryId: body.categoryId,
        description: body.description ?? null,
        basePrice: body.basePrice,
        prepTimeMinutes: body.prepTimeMinutes,
        isFeatured: body.isFeatured ?? false,
        isAvailable: body.isAvailable ?? true,
        imageUrl: body.imageUrl ?? null,
        isDirectIngredient: body.isDirectIngredient ?? false,
        recipes: {
          create: recipeLines.map((r) => ({
            ingredientId: r.ingredientId,
            quantityNeeded: r.quantityNeeded,
            notes: r.notes ?? null,
          })),
        },
      },
      include: {
        category: { select: { id: true, name: true, type: true, sortOrder: true } },
        recipes: {
          include: { ingredient: { select: { id: true, name: true, unit: true, unitCost: true } } },
        },
      },
    })
    return reply.status(201).send(serializeMenuItem(row as any))
  })

  fastify.patch('/admin/menu-items/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      name?: string
      categoryId?: string
      description?: string | null
      basePrice?: number
      prepTimeMinutes?: number
      isFeatured?: boolean
      isAvailable?: boolean
      isActive?: boolean
      imageUrl?: string | null
      isDirectIngredient?: boolean
      recipes?: { ingredientId: string; quantityNeeded: number; notes?: string | null }[]
    }

    const { recipes, ...rest } = body

    if (recipes !== undefined) {
      await prisma.recipe.deleteMany({ where: { menuItemId: id } })
    }

    const recipeLines = recipes !== undefined && !rest.isDirectIngredient
      ? recipes.filter((r) => r.ingredientId)
      : undefined

    const row = await prisma.menuItem.update({
      where: { id },
      data: {
        ...rest,
        ...(recipeLines !== undefined
          ? {
              recipes: {
                create: recipeLines.map((r) => ({
                  ingredientId: r.ingredientId,
                  quantityNeeded: r.quantityNeeded,
                  notes: r.notes ?? null,
                })),
              },
            }
          : {}),
      },
      include: {
        category: { select: { id: true, name: true, type: true, sortOrder: true } },
        recipes: {
          include: { ingredient: { select: { id: true, name: true, unit: true, unitCost: true } } },
        },
      },
    })
    return reply.send(serializeMenuItem(row as any))
  })

  // ── Daily Menu ─────────────────────────────────────────────────────────────

  fastify.get('/admin/daily-menu/today', { preHandler: adminOrWaiter }, async (_req, reply) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const rows = await prisma.dailyMenu.findMany({
      where: { date: today },
      include: {
        menuItem: {
          include: {
            category: { select: { id: true, name: true, type: true } },
            recipes: {
              include: {
                ingredient: {
                  select: {
                    id: true, name: true, unit: true,
                    stockQty: true, minStockQty: true, unitCost: true, status: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ menuItem: { category: { sortOrder: 'asc' } } }, { menuItem: { name: 'asc' } }],
    })

    return reply.send(
      rows.map((r) => ({
        ...r,
        overridePrice: r.overridePrice !== null ? toNumber(r.overridePrice) : null,
        menuItem: serializeMenuItem({
          ...(r.menuItem as any),
          basePrice: toNumber((r.menuItem as any).basePrice),
          recipes: (r.menuItem.recipes ?? []).map(serializeRecipe as any),
        }),
      }))
    )
  })

  fastify.post('/admin/daily-menu', { preHandler: adminOnly }, async (request, reply) => {
    const body = request.body as { menuItemId: string; overridePrice?: number | null }
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const row = await prisma.dailyMenu.upsert({
      where: { date_menuItemId: { date: today, menuItemId: body.menuItemId } },
      create: { date: today, menuItemId: body.menuItemId, overridePrice: body.overridePrice ?? null },
      update: { overridePrice: body.overridePrice ?? null },
      include: {
        menuItem: {
          include: {
            category: { select: { id: true, name: true, type: true } },
            recipes: {
              include: {
                ingredient: {
                  select: {
                    id: true, name: true, unit: true,
                    stockQty: true, minStockQty: true, unitCost: true, status: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    return reply.status(201).send({
      ...row,
      overridePrice: row.overridePrice !== null ? toNumber(row.overridePrice) : null,
      menuItem: serializeMenuItem({
        ...(row.menuItem as any),
        basePrice: toNumber((row.menuItem as any).basePrice),
        recipes: (row.menuItem.recipes ?? []).map(serializeRecipe as any),
      }),
    })
  })

  fastify.delete('/admin/daily-menu/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.dailyMenu.delete({ where: { id } })
    return reply.status(204).send()
  })

  fastify.post('/admin/daily-menu/confirm', { preHandler: adminOnly }, async (request, reply) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    await prisma.dailyMenu.updateMany({
      where: { date: today, confirmedAt: null },
      data: { confirmedById: request.user.sub, confirmedAt: new Date() },
    })
    return reply.send({ ok: true })
  })

  // ── Users ──────────────────────────────────────────────────────────────────

  fastify.get('/admin/users', { preHandler: adminOnly }, async (_req, reply) => {
    const rows = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, mustChangePassword: true, createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    })
    return reply.send(rows)
  })

  fastify.post('/admin/users', { preHandler: adminOnly }, async (request, reply) => {
    const body = request.body as {
      name: string; email: string; password: string; role: UserRole
    }
    const passwordHash = await bcrypt.hash(body.password, 12)
    const row = await prisma.user.create({
      data: {
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        passwordHash,
        role: body.role,
        mustChangePassword: true,
      },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, mustChangePassword: true, createdAt: true,
      },
    })
    return reply.status(201).send(row)
  })

  fastify.patch('/admin/users/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Partial<{
      name: string; email: string; role: UserRole; isActive: boolean
    }>
    const row = await prisma.user.update({
      where: { id },
      data: body,
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, mustChangePassword: true, createdAt: true,
      },
    })
    return reply.send(row)
  })

  // ── Tables ─────────────────────────────────────────────────────────────────

  fastify.get('/admin/tables', { preHandler: adminOnly }, async (_req, reply) => {
    const rows = await prisma.table.findMany({ orderBy: { number: 'asc' } })
    return reply.send(rows)
  })

  fastify.post('/admin/tables', { preHandler: adminOnly }, async (request, reply) => {
    const body = request.body as { number: number; capacity: number; section: string }
    const row = await prisma.table.create({ data: body })
    return reply.status(201).send(row)
  })

  fastify.patch('/admin/tables/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      number?: number; capacity?: number; section?: string; isActive?: boolean
    }

    if (body.isActive === false) {
      // Table has no isActive column — just delete it if no active orders reference it
      try {
        await prisma.table.delete({ where: { id } })
      } catch {
        // FK constraint — table has history, ignore soft-delete request
      }
      return reply.status(204).send()
    }

    const { isActive: _ia, ...rest } = body
    const row = await prisma.table.update({ where: { id }, data: rest })
    return reply.send(row)
  })

  // ── System Params ──────────────────────────────────────────────────────────

  fastify.get('/admin/system-params', { preHandler: adminOnly }, async (_req, reply) => {
    const [reminder, critical, tableMode] = await Promise.all([
      getSetting('reminderIntervalMin'),
      getSetting('criticalTimerMin'),
      getSetting('tableMode'),
    ])
    return reply.send({
      reminderIntervalMin: parseInt(reminder, 10) || 3,
      criticalTimerMin: parseInt(critical, 10) || 15,
      tableMode: tableMode || 'free',
    })
  })

  fastify.patch('/admin/system-params', { preHandler: adminOnly }, async (request, reply) => {
    const body = request.body as {
      reminderIntervalMin?: number; criticalTimerMin?: number; tableMode?: string
    }

    const ups: Promise<unknown>[] = []
    if (body.reminderIntervalMin !== undefined) {
      ups.push(
        prisma.systemSetting.upsert({
          where: { key: 'reminderIntervalMin' },
          create: { key: 'reminderIntervalMin', value: String(body.reminderIntervalMin) },
          update: { value: String(body.reminderIntervalMin) },
        })
      )
    }
    if (body.criticalTimerMin !== undefined) {
      ups.push(
        prisma.systemSetting.upsert({
          where: { key: 'criticalTimerMin' },
          create: { key: 'criticalTimerMin', value: String(body.criticalTimerMin) },
          update: { value: String(body.criticalTimerMin) },
        })
      )
    }
    if (body.tableMode !== undefined) {
      ups.push(
        prisma.systemSetting.upsert({
          where: { key: 'tableMode' },
          create: { key: 'tableMode', value: body.tableMode },
          update: { value: body.tableMode },
        })
      )
    }
    await Promise.all(ups)

    const [reminder, critical, tableMode] = await Promise.all([
      getSetting('reminderIntervalMin'),
      getSetting('criticalTimerMin'),
      getSetting('tableMode'),
    ])
    return reply.send({
      reminderIntervalMin: parseInt(reminder, 10) || 3,
      criticalTimerMin: parseInt(critical, 10) || 15,
      tableMode: tableMode || 'free',
    })
  })

  // ── Suppliers ──────────────────────────────────────────────────────────────

  fastify.get('/admin/suppliers', { preHandler: adminOnly }, async (_req, reply) => {
    const rows = await prisma.supplier.findMany({ orderBy: { name: 'asc' } })
    return reply.send(rows)
  })

  fastify.post('/admin/suppliers', { preHandler: adminOnly }, async (request, reply) => {
    const body = request.body as {
      name: string
      contactName?: string | null
      phone?: string | null
      email?: string | null
      address?: string | null
      notes?: string | null
    }
    const row = await prisma.supplier.create({ data: { ...body, name: body.name.trim() } })
    return reply.status(201).send(row)
  })

  fastify.patch('/admin/suppliers/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Partial<{
      name: string; contactName: string | null; phone: string | null
      email: string | null; address: string | null; notes: string | null
    }>
    const row = await prisma.supplier.update({ where: { id }, data: body })
    return reply.send(row)
  })

  // ── Purchases ──────────────────────────────────────────────────────────────

  fastify.get('/admin/purchases', { preHandler: adminOnly }, async (_req, reply) => {
    const rows = await prisma.purchase.findMany({
      include: {
        supplier: true,
        items: {
          include: { ingredient: { select: { id: true, name: true, unit: true } } },
        },
      },
      orderBy: { purchasedAt: 'desc' },
    })
    return reply.send(
      rows.map((p) => ({
        ...p,
        totalCost: toNumber(p.totalCost),
        items: p.items.map((item) => ({
          ...item,
          quantity: toNumber(item.quantity),
          unitCost: toNumber(item.unitCost),
          subtotal: toNumber(item.subtotal),
        })),
      }))
    )
  })

  fastify.post('/admin/purchases', { preHandler: adminOnly }, async (request, reply) => {
    const body = request.body as {
      supplierId?: string | null
      purchasedAt?: string
      items: { ingredientId: string; quantity: number; unitCost: number }[]
    }

    if (!body.items?.length) {
      return reply.status(400).send({ error: 'Debe incluir al menos un ingrediente' })
    }

    const totalCost = body.items.reduce((s, i) => s + i.quantity * i.unitCost, 0)

    const purchase = await prisma.$transaction(async (tx) => {
      const p = await tx.purchase.create({
        data: {
          supplierId: body.supplierId ?? null,
          registeredById: request.user.sub,
          purchasedAt: body.purchasedAt ? new Date(body.purchasedAt) : new Date(),
          totalCost,
          items: {
            create: body.items.map((i) => ({
              ingredientId: i.ingredientId,
              quantity: i.quantity,
              unitCost: i.unitCost,
              subtotal: i.quantity * i.unitCost,
            })),
          },
        },
        include: {
          supplier: true,
          items: { include: { ingredient: { select: { id: true, name: true, unit: true } } } },
        },
      })

      // Update stock + recalculate status for each ingredient
      for (const item of body.items) {
        const cur = await tx.ingredient.findUniqueOrThrow({ where: { id: item.ingredientId } })
        const newStock = Number(cur.stockQty) + item.quantity
        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: {
            stockQty: newStock,
            unitCost: item.unitCost,
            status: computeIngredientStatus(newStock, Number(cur.minStockQty)),
          },
        })
      }

      return p
    })

    return reply.status(201).send({
      ...purchase,
      totalCost: toNumber(purchase.totalCost),
      items: purchase.items.map((item) => ({
        ...item,
        quantity: toNumber(item.quantity),
        unitCost: toNumber(item.unitCost),
        subtotal: toNumber(item.subtotal),
      })),
    })
  })

  // ── Table Assignments ──────────────────────────────────────────────────────
  // Admin assigns tables to waiters (used when tableMode = 'assigned').
  // Uses WaiterSession + WaiterSessionTable as storage.

  fastify.get('/admin/table-assignments', { preHandler: adminOnly }, async (_req, reply) => {
    const { gte, lt } = todayRange()
    const sessions = await prisma.waiterSession.findMany({
      where: { startedAt: { gte, lt }, endedAt: null, mode: 'assigned' },
      include: {
        waiter: { select: { id: true, name: true } },
        tables: { include: { table: { select: { id: true, number: true, section: true } } } },
      },
    })
    return reply.send(
      sessions.map((s) => ({
        sessionId: s.id,
        waiterId: s.waiterId,
        waiterName: s.waiter.name,
        tables: s.tables.map((t) => t.table),
      }))
    )
  })

  fastify.post('/admin/table-assignments', { preHandler: adminOnly }, async (request, reply) => {
    const body = request.body as { waiterId: string; tableIds: string[] }
    const { gte, lt } = todayRange()

    // Find or create today's assigned session for this waiter
    let session = await prisma.waiterSession.findFirst({
      where: { waiterId: body.waiterId, startedAt: { gte, lt }, endedAt: null },
    })

    if (!session) {
      session = await prisma.waiterSession.create({
        data: { waiterId: body.waiterId, mode: 'assigned' as WaiterMode },
      })
    } else if (session.mode !== 'assigned') {
      await prisma.waiterSession.update({
        where: { id: session.id },
        data: { mode: 'assigned' },
      })
    }

    // Replace assignments
    await prisma.waiterSessionTable.deleteMany({ where: { sessionId: session.id } })
    if (body.tableIds.length > 0) {
      await prisma.waiterSessionTable.createMany({
        data: body.tableIds.map((tableId) => ({ sessionId: session!.id, tableId })),
      })
    }

    const updated = await prisma.waiterSession.findUniqueOrThrow({
      where: { id: session.id },
      include: {
        waiter: { select: { id: true, name: true } },
        tables: { include: { table: { select: { id: true, number: true, section: true } } } },
      },
    })

    return reply.send({
      sessionId: updated.id,
      waiterId: updated.waiterId,
      waiterName: updated.waiter.name,
      tables: updated.tables.map((t) => t.table),
    })
  })

  fastify.delete('/admin/table-assignments/:waiterId', { preHandler: adminOnly }, async (request, reply) => {
    const { waiterId } = request.params as { waiterId: string }
    const { gte, lt } = todayRange()

    const session = await prisma.waiterSession.findFirst({
      where: { waiterId, startedAt: { gte, lt }, endedAt: null },
    })
    if (session) {
      await prisma.waiterSessionTable.deleteMany({ where: { sessionId: session.id } })
    }
    return reply.status(204).send()
  })

  // ── Reports ────────────────────────────────────────────────────────────────────

  fastify.get('/admin/reports', { preHandler: adminOnly }, async (request, reply) => {
    const { period = 'today' } = request.query as { period?: string }
    const { start, end } = getReportRange(period)

    const invoices = await prisma.invoice.findMany({
      where: { status: 'paid', paidAt: { gte: start, lte: end } },
      include: {
        order: {
          include: {
            items: {
              include: {
                menuItem: {
                  select: {
                    id: true,
                    name: true,
                    recipes: {
                      select: {
                        quantityNeeded: true,
                        ingredient: { select: { unitCost: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    let ingresos = 0
    let costos = 0
    const paymentMap: Record<string, { total: number; count: number }> = {}
    const itemMap: Record<string, { name: string; quantitySold: number; totalRevenue: number }> = {}
    const hourlyMap: Record<number, { orders: number; revenue: number }> = {}

    for (const inv of invoices) {
      const total = toNumber(inv.total)
      ingresos += total

      const method = inv.paymentMethod as string
      if (!paymentMap[method]) paymentMap[method] = { total: 0, count: 0 }
      paymentMap[method].total += total
      paymentMap[method].count++

      if (inv.paidAt) {
        const hour = new Date(inv.paidAt).getHours()
        if (!hourlyMap[hour]) hourlyMap[hour] = { orders: 0, revenue: 0 }
        hourlyMap[hour].orders++
        hourlyMap[hour].revenue += total
      }

      for (const item of inv.order.items) {
        const mid = item.menuItemId
        const itemRevenue = toNumber(item.unitPrice) * item.quantity
        const itemCostPerUnit = item.menuItem.recipes.reduce(
          (sum, r) => sum + toNumber(r.quantityNeeded) * toNumber(r.ingredient.unitCost),
          0
        )
        costos += itemCostPerUnit * item.quantity

        if (!itemMap[mid]) itemMap[mid] = { name: item.menuItem.name, quantitySold: 0, totalRevenue: 0 }
        itemMap[mid].quantitySold += item.quantity
        itemMap[mid].totalRevenue += itemRevenue
      }
    }

    const ganancias = ingresos - costos
    const margen = ingresos > 0 ? (ganancias / ingresos) * 100 : 0

    const prepItems = await prisma.orderItem.findMany({
      where: {
        prepStartedAt: { not: null },
        prepFinishedAt: { not: null },
        order: { invoice: { status: 'paid', paidAt: { gte: start, lte: end } } },
      },
      select: { prepStartedAt: true, prepFinishedAt: true },
    })

    const validPreps = prepItems
      .map((i) => (i.prepFinishedAt!.getTime() - i.prepStartedAt!.getTime()) / 1000)
      .filter((t) => t > 0 && t < 7200)

    const avgPrepSecs =
      validPreps.length > 0
        ? Math.round(validPreps.reduce((s, t) => s + t, 0) / validPreps.length)
        : 0

    return reply.send({
      kpi: {
        ingresos,
        costos,
        ganancias,
        margen,
        ordersCount: invoices.length,
      },
      paymentMethods: Object.entries(paymentMap).map(([method, v]) => ({ method, ...v })),
      topDishes: Object.entries(itemMap)
        .map(([menuItemId, v]) => ({ menuItemId, ...v }))
        .sort((a, b) => b.quantitySold - a.quantitySold)
        .slice(0, 10),
      hourlyBreakdown: Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        orders: hourlyMap[h]?.orders ?? 0,
        revenue: hourlyMap[h]?.revenue ?? 0,
      })).filter((d) => d.orders > 0),
      operational: {
        avgPrepSecs,
        avgPrepMin: avgPrepSecs > 0 ? Math.round(avgPrepSecs / 60) : 0,
      },
    })
  })

  // ── Sales / History ────────────────────────────────────────────────────────────

  fastify.get('/admin/sales', { preHandler: adminOnly }, async (request, reply) => {
    const query = request.query as { page?: string; limit?: string }
    const page = Math.max(1, parseInt(query.page ?? '1', 10))
    const limit = Math.min(100, parseInt(query.limit ?? '50', 10))
    const skip = (page - 1) * limit

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          table: { select: { id: true, number: true, section: true } },
          waiter: { select: { id: true, name: true } },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              paymentMethod: true,
              total: true,
              paidAt: true,
            },
          },
          _count: { select: { items: true } },
        },
      }),
      prisma.order.count(),
    ])

    return reply.send({
      data: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        table: o.table,
        waiter: o.waiter,
        type: o.type,
        status: o.status,
        isAdditional: o.isAdditional,
        createdAt: o.createdAt,
        itemCount: o._count.items,
        invoice: o.invoice
          ? { ...o.invoice, total: toNumber(o.invoice.total) }
          : null,
      })),
      total,
      page,
      limit,
    })
  })
}
