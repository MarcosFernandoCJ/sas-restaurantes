-- ============================================================
-- Data migration: set dispatch_area and requires_preparation
-- on existing menu_items based on their category type and name.
--
-- Run AFTER: prisma db push (applies the schema changes)
-- ============================================================

-- Step 1: Drinks that require preparation → bar
-- (jugos, chichas, cafés, cócteles, smoothies)
UPDATE menu_items mi
SET dispatch_area        = 'bar',
    requires_preparation = true
FROM menu_categories mc
WHERE mi.category_id = mc.id
  AND mc.type = 'drink'
  AND mi.prep_time_minutes >= 5;

-- Step 2: Drinks that do NOT require preparation → waiter (direct service)
-- (gaseosas, agua, cervezas embotelladas, bebidas enlatadas)
UPDATE menu_items mi
SET dispatch_area        = 'waiter',
    requires_preparation = false
FROM menu_categories mc
WHERE mi.category_id = mc.id
  AND mc.type = 'drink'
  AND mi.prep_time_minutes < 5;

-- Step 3: Food items marked as direct (postres, snacks pre-elaborados)
-- (items sin necesidad de preparación en cocina)
UPDATE menu_items
SET dispatch_area        = 'waiter',
    requires_preparation = false
WHERE dispatch_area = 'kitchen'
  AND prep_time_minutes <= 2
  AND category_id IN (
    SELECT id FROM menu_categories WHERE type = 'food'
  );

-- Step 4: 'other' category → waiter
UPDATE menu_items mi
SET dispatch_area        = 'waiter',
    requires_preparation = false
FROM menu_categories mc
WHERE mi.category_id = mc.id
  AND mc.type = 'other';

-- Verify: show counts per area after migration
SELECT dispatch_area, requires_preparation, COUNT(*) AS item_count
FROM menu_items
GROUP BY dispatch_area, requires_preparation
ORDER BY dispatch_area, requires_preparation;
