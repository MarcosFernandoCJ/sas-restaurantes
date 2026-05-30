/**
 * Seed de datos de prueba — SAS Restaurantes
 * 1 admin · 2 meseros · 2 chefs · 8 mesas · 10 menu_items · 15 ingredientes · recetas
 */
import { PrismaClient, UserRole, TableStatus, CategoryType, IngredientStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const SALT_ROUNDS = 12

async function main() {
  console.log('🌱 Iniciando seed...')

  const existingUsers = await prisma.user.count()
  if (existingUsers > 0) {
    console.log('⏭️  Datos ya existen, seed omitido.')
    return
  }

  // ---- Limpieza en orden inverso a las FK ----
  await prisma.notification.deleteMany()
  await prisma.calendarEvent.deleteMany()
  await prisma.purchaseItem.deleteMany()
  await prisma.purchase.deleteMany()
  await prisma.recipe.deleteMany()
  await prisma.dailyMenu.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.order.deleteMany()
  await prisma.waiterSessionTable.deleteMany()
  await prisma.waiterSession.deleteMany()
  await prisma.ingredient.deleteMany()
  await prisma.menuItem.deleteMany()
  await prisma.menuCategory.deleteMany()
  await prisma.table.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.user.deleteMany()

  // ==========================================================================
  // USUARIOS
  // ==========================================================================
  const [adminHash, waiterHash, chefHash] = await Promise.all([
    bcrypt.hash('admin123', SALT_ROUNDS),
    bcrypt.hash('waiter123', SALT_ROUNDS),
    bcrypt.hash('chef123', SALT_ROUNDS),
  ])

  await prisma.user.createMany({
    data: [
      {
        name: 'Admin Principal',
        email: 'admin@sas.local',
        passwordHash: adminHash,
        role: UserRole.admin,
      },
      {
        name: 'Carlos Mendoza',
        email: 'carlos@sas.local',
        passwordHash: waiterHash,
        role: UserRole.waiter,
      },
      {
        name: 'María Quispe',
        email: 'maria@sas.local',
        passwordHash: waiterHash,
        role: UserRole.waiter,
      },
      {
        name: 'Pedro Ramos',
        email: 'pedro@sas.local',
        passwordHash: chefHash,
        role: UserRole.chef,
      },
      {
        name: 'Rosa Flores',
        email: 'rosa@sas.local',
        passwordHash: chefHash,
        role: UserRole.chef,
      },
    ],
  })

  console.log('  ✅ Usuarios creados (1 admin, 2 meseros, 2 chefs)')

  // ==========================================================================
  // MESAS
  // ==========================================================================
  await prisma.table.createMany({
    data: [
      { number: 1, capacity: 4, section: 'salon', status: TableStatus.free },
      { number: 2, capacity: 4, section: 'salon', status: TableStatus.free },
      { number: 3, capacity: 6, section: 'salon', status: TableStatus.free },
      { number: 4, capacity: 6, section: 'salon', status: TableStatus.free },
      { number: 5, capacity: 2, section: 'terraza', status: TableStatus.free },
      { number: 6, capacity: 4, section: 'terraza', status: TableStatus.free },
      { number: 7, capacity: 4, section: 'terraza', status: TableStatus.free },
      { number: 8, capacity: 8, section: 'salon-vip', status: TableStatus.free },
    ],
  })

  console.log('  ✅ 8 mesas creadas')

  // ==========================================================================
  // CATEGORÍAS
  // ==========================================================================
  const catPlatos = await prisma.menuCategory.create({
    data: { name: 'Platos', type: CategoryType.food, sortOrder: 1 },
  })

  const catBebidas = await prisma.menuCategory.create({
    data: { name: 'Bebidas', type: CategoryType.drink, sortOrder: 2 },
  })

  console.log('  ✅ Categorías creadas (Platos, Bebidas)')

  // ==========================================================================
  // MENU ITEMS — 5 platos + 5 bebidas
  // ==========================================================================
  const polloA = await prisma.menuItem.create({
    data: {
      categoryId: catPlatos.id,
      name: 'Pollo a la Brasa (1/4)',
      description: 'Pollo dorado a las brasas con papas fritas y ensalada mixta',
      basePrice: 18.0,
      prepTimeMinutes: 20,
      isFeatured: true,
    },
  })

  const lomoS = await prisma.menuItem.create({
    data: {
      categoryId: catPlatos.id,
      name: 'Lomo Saltado',
      description: 'Lomo de res salteado con tomate, cebolla, soya y papas fritas',
      basePrice: 22.0,
      prepTimeMinutes: 15,
      isFeatured: true,
    },
  })

  const caldoG = await prisma.menuItem.create({
    data: {
      categoryId: catPlatos.id,
      name: 'Caldo de Gallina',
      description: 'Caldo reconfortante con gallina, fideos cabello de ángel y papa',
      basePrice: 14.0,
      prepTimeMinutes: 10,
    },
  })

  const chicharron = await prisma.menuItem.create({
    data: {
      categoryId: catPlatos.id,
      name: 'Chicharrón de Pollo',
      description: 'Trozos de pollo fritos y crujientes con papas doradas',
      basePrice: 20.0,
      prepTimeMinutes: 18,
    },
  })

  // TODO: tipar dispatchArea con DispatchArea enum post-migración
  // Postre pre-elaborado: el mesero lo sirve directamente sin pasar por cocina
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arrozLeche = await (prisma.menuItem as any).create({
    data: {
      categoryId: catPlatos.id,
      name: 'Arroz con Leche',
      description: 'Postre cremoso tradicional peruano con canela',
      basePrice: 8.0,
      prepTimeMinutes: 2,
      requiresPreparation: false,
      dispatchArea: 'waiter',
    },
  })

  // Bebidas directas — el mesero las sirve sin pasar por el bar
  // TODO: tipar dispatchArea con DispatchArea enum una vez que Prisma regenere
  const prismaAny = prisma as unknown as { menuItem: typeof prisma.menuItem }

  const incaKola = await prismaAny.menuItem.create({
    data: {
      categoryId: catBebidas.id,
      name: 'Inca Kola',
      description: 'Gaseosa nacional 500ml',
      basePrice: 5.0,
      prepTimeMinutes: 2,
      requiresPreparation: false,
      dispatchArea: 'waiter',
    },
  })

  const chicha = await prismaAny.menuItem.create({
    data: {
      categoryId: catBebidas.id,
      name: 'Chicha Morada',
      description: 'Bebida tradicional de maíz morado con frutas y canela',
      basePrice: 6.0,
      prepTimeMinutes: 5,
      requiresPreparation: true,
      dispatchArea: 'bar',
    },
  })

  await prismaAny.menuItem.create({
    data: {
      categoryId: catBebidas.id,
      name: 'Agua Mineral',
      description: 'Agua mineral sin gas 500ml',
      basePrice: 3.0,
      prepTimeMinutes: 1,
      requiresPreparation: false,
      dispatchArea: 'waiter',
    },
  })

  await prismaAny.menuItem.create({
    data: {
      categoryId: catBebidas.id,
      name: 'Cerveza Nacional',
      description: 'Cerveza de barril 620ml bien fría',
      basePrice: 9.0,
      prepTimeMinutes: 2,
      requiresPreparation: false,
      dispatchArea: 'waiter',
    },
  })

  const maracuya = await prismaAny.menuItem.create({
    data: {
      categoryId: catBebidas.id,
      name: 'Jugo de Maracuyá',
      description: 'Jugo fresco natural de maracuyá con azúcar',
      basePrice: 7.0,
      prepTimeMinutes: 6,
      requiresPreparation: true,
      dispatchArea: 'bar',
    },
  })

  console.log('  ✅ 10 menu items creados (5 platos + 5 bebidas)')

  // ==========================================================================
  // PROVEEDOR BASE
  // ==========================================================================
  const proveedor = await prisma.supplier.create({
    data: {
      name: 'Distribuidora El Mercado SAC',
      contactName: 'Jorge Huamán',
      phone: '999-123-456',
      email: 'ventas@elmercado.pe',
    },
  })

  // ==========================================================================
  // INGREDIENTES — 15 insumos
  // ==========================================================================
  const [
    ingPollo,
    ingPapas,
    ingArroz,
    ingLomo,
    ingTomate,
    ingCebolla,
    ingPimiento,
    ingSillao,
    ingGallina,
    ingFideo,
    ingLeche,
    ingAzucar,
    ingCanela,
    ingMaiz,
    ingMaracuya,
  ] = await Promise.all([
    prisma.ingredient.create({
      data: {
        name: 'Pollo entero',
        unit: 'kg',
        stockQty: 20,
        minStockQty: 5,
        unitCost: 12.5,
        supplierId: proveedor.id,
        status: IngredientStatus.ok,
      },
    }),
    prisma.ingredient.create({
      data: {
        name: 'Papas amarillas',
        unit: 'kg',
        stockQty: 30,
        minStockQty: 10,
        unitCost: 2.0,
        supplierId: proveedor.id,
        status: IngredientStatus.ok,
      },
    }),
    prisma.ingredient.create({
      data: {
        name: 'Arroz largo',
        unit: 'kg',
        stockQty: 25,
        minStockQty: 8,
        unitCost: 3.5,
        supplierId: proveedor.id,
        status: IngredientStatus.ok,
      },
    }),
    prisma.ingredient.create({
      data: {
        name: 'Lomo de res',
        unit: 'kg',
        stockQty: 8,
        minStockQty: 3,
        unitCost: 35.0,
        supplierId: proveedor.id,
        status: IngredientStatus.ok,
      },
    }),
    prisma.ingredient.create({
      data: {
        name: 'Tomate redondo',
        unit: 'kg',
        stockQty: 5,
        minStockQty: 2,
        unitCost: 3.0,
        supplierId: proveedor.id,
        status: IngredientStatus.ok,
      },
    }),
    prisma.ingredient.create({
      data: {
        name: 'Cebolla roja',
        unit: 'kg',
        stockQty: 8,
        minStockQty: 3,
        unitCost: 2.5,
        supplierId: proveedor.id,
        status: IngredientStatus.ok,
      },
    }),
    prisma.ingredient.create({
      data: {
        name: 'Pimiento rojo',
        unit: 'kg',
        stockQty: 3,
        minStockQty: 1,
        unitCost: 4.0,
        supplierId: proveedor.id,
        status: IngredientStatus.ok,
      },
    }),
    prisma.ingredient.create({
      data: {
        name: 'Sillao (soya)',
        unit: 'lt',
        stockQty: 4,
        minStockQty: 1,
        unitCost: 8.0,
        supplierId: proveedor.id,
        status: IngredientStatus.ok,
      },
    }),
    prisma.ingredient.create({
      data: {
        name: 'Gallina entera',
        unit: 'kg',
        stockQty: 10,
        minStockQty: 4,
        unitCost: 15.0,
        supplierId: proveedor.id,
        status: IngredientStatus.ok,
      },
    }),
    prisma.ingredient.create({
      data: {
        name: 'Fideo cabello de ángel',
        unit: 'kg',
        stockQty: 5,
        minStockQty: 2,
        unitCost: 4.0,
        supplierId: proveedor.id,
        status: IngredientStatus.ok,
      },
    }),
    prisma.ingredient.create({
      data: {
        name: 'Leche evaporada',
        unit: 'lata',
        stockQty: 20,
        minStockQty: 6,
        unitCost: 3.5,
        supplierId: proveedor.id,
        status: IngredientStatus.ok,
      },
    }),
    prisma.ingredient.create({
      data: {
        name: 'Azúcar blanca',
        unit: 'kg',
        stockQty: 10,
        minStockQty: 3,
        unitCost: 2.0,
        supplierId: proveedor.id,
        status: IngredientStatus.ok,
      },
    }),
    prisma.ingredient.create({
      data: {
        name: 'Canela en rama',
        unit: 'g',
        stockQty: 200,
        minStockQty: 50,
        unitCost: 0.05,
        supplierId: proveedor.id,
        status: IngredientStatus.ok,
      },
    }),
    prisma.ingredient.create({
      data: {
        name: 'Maíz morado',
        unit: 'kg',
        stockQty: 3,
        minStockQty: 1,
        unitCost: 6.0,
        supplierId: proveedor.id,
        status: IngredientStatus.ok,
      },
    }),
    prisma.ingredient.create({
      data: {
        name: 'Maracuyá fresco',
        unit: 'kg',
        stockQty: 4,
        minStockQty: 1.5,
        unitCost: 5.0,
        supplierId: proveedor.id,
        status: IngredientStatus.ok,
      },
    }),
  ])

  console.log('  ✅ 15 ingredientes creados')

  // ==========================================================================
  // RECETAS (cantidad por porción)
  // ==========================================================================
  await prisma.recipe.createMany({
    data: [
      // Pollo a la Brasa (1/4): 0.5 kg pollo + 0.3 kg papas
      { menuItemId: polloA.id, ingredientId: ingPollo.id, quantityNeeded: 0.5 },
      { menuItemId: polloA.id, ingredientId: ingPapas.id, quantityNeeded: 0.3 },

      // Lomo Saltado: lomo + arroz + papas + tomate + cebolla + soya
      { menuItemId: lomoS.id, ingredientId: ingLomo.id, quantityNeeded: 0.25 },
      { menuItemId: lomoS.id, ingredientId: ingArroz.id, quantityNeeded: 0.15 },
      { menuItemId: lomoS.id, ingredientId: ingPapas.id, quantityNeeded: 0.2 },
      { menuItemId: lomoS.id, ingredientId: ingTomate.id, quantityNeeded: 0.1 },
      { menuItemId: lomoS.id, ingredientId: ingCebolla.id, quantityNeeded: 0.1 },
      { menuItemId: lomoS.id, ingredientId: ingSillao.id, quantityNeeded: 0.03 },

      // Caldo de Gallina: gallina + fideo + papas
      { menuItemId: caldoG.id, ingredientId: ingGallina.id, quantityNeeded: 0.4 },
      { menuItemId: caldoG.id, ingredientId: ingFideo.id, quantityNeeded: 0.08 },
      { menuItemId: caldoG.id, ingredientId: ingPapas.id, quantityNeeded: 0.15 },

      // Chicharrón de Pollo: pollo + papas
      { menuItemId: chicharron.id, ingredientId: ingPollo.id, quantityNeeded: 0.45 },
      { menuItemId: chicharron.id, ingredientId: ingPapas.id, quantityNeeded: 0.3 },

      // Arroz con Leche: arroz + leche + azúcar + canela
      { menuItemId: arrozLeche.id, ingredientId: ingArroz.id, quantityNeeded: 0.1 },
      { menuItemId: arrozLeche.id, ingredientId: ingLeche.id, quantityNeeded: 0.5 },
      { menuItemId: arrozLeche.id, ingredientId: ingAzucar.id, quantityNeeded: 0.05 },
      { menuItemId: arrozLeche.id, ingredientId: ingCanela.id, quantityNeeded: 2 },

      // Chicha Morada: maíz + azúcar
      { menuItemId: chicha.id, ingredientId: ingMaiz.id, quantityNeeded: 0.15 },
      { menuItemId: chicha.id, ingredientId: ingAzucar.id, quantityNeeded: 0.08 },

      // Jugo de Maracuyá: maracuyá + azúcar
      { menuItemId: maracuya.id, ingredientId: ingMaracuya.id, quantityNeeded: 0.2 },
      { menuItemId: maracuya.id, ingredientId: ingAzucar.id, quantityNeeded: 0.04 },
    ],
  })

  console.log('  ✅ Recetas creadas')

  // ==========================================================================
  // EVENTO DE CALENDARIO
  // ==========================================================================
  await prisma.calendarEvent.create({
    data: {
      name: 'Día de la Madre',
      eventDate: new Date('2026-05-10'),
      expectedExtraCustomers: 80,
      notes: 'Preparar menú especial y refuerzos de personal',
      isHoliday: true,
    },
  })

  console.log('\n🎉 Seed completado exitosamente!')
  console.log('─'.repeat(50))
  console.log('Credenciales de acceso:')
  console.log('  Admin:   admin@sas.local  / admin123')
  console.log('  Mesero:  carlos@sas.local / waiter123')
  console.log('  Mesero:  maria@sas.local  / waiter123')
  console.log('  Chef:    pedro@sas.local  / chef123')
  console.log('  Chef:    rosa@sas.local   / chef123')
  console.log('─'.repeat(50))
}

main()
  .catch((e) => {
    console.error('❌ Seed falló:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
