import { useCallback } from 'react'
import { Card, Spinner, Badge, Button } from '@sas/ui'
import type { BadgeVariant } from '@sas/ui'
import type { DailyMenuItem, CriticalIngredient, IngredientStatus } from '../types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function aggregateIngredients(dailyMenu: DailyMenuItem[]): CriticalIngredient[] {
  const map = new Map<string, CriticalIngredient>()

  for (const entry of dailyMenu) {
    for (const recipe of entry.menuItem.recipes) {
      const { ingredient, quantityNeeded } = recipe
      const existing = map.get(ingredient.id)

      if (existing) {
        existing.neededToday += quantityNeeded
        existing.toBuy = Math.max(0, existing.neededToday - existing.stockQty)
      } else {
        map.set(ingredient.id, {
          id: ingredient.id,
          name: ingredient.name,
          unit: ingredient.unit,
          stockQty: ingredient.stockQty,
          neededToday: quantityNeeded,
          toBuy: Math.max(0, quantityNeeded - ingredient.stockQty),
          unitCost: ingredient.unitCost,
          status: ingredient.status,
        })
      }
    }
  }

  const PRIORITY: Record<IngredientStatus, number> = { out: 0, critical: 1, low: 2, ok: 3 }
  return Array.from(map.values()).sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status])
}

const STATUS_CONFIG: Record<IngredientStatus, { variant: BadgeVariant; label: string; rowBg: string }> = {
  out:      { variant: 'delivery',   label: 'Agotado',  rowBg: 'bg-red-50' },
  critical: { variant: 'additional', label: 'Crítico',  rowBg: 'bg-orange-50' },
  low:      { variant: 'pending',    label: 'Bajo',     rowBg: 'bg-yellow-50/70' },
  ok:       { variant: 'ready',      label: 'OK',       rowBg: '' },
}

// ─── PDF generator (print window) ───────────────────────────────────────────

function buildPrintWindow(urgentItems: CriticalIngredient[]) {
  const today = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const totalCost = urgentItems.reduce((acc, i) => acc + i.toBuy * i.unitCost, 0)

  const rows = urgentItems
    .map((i) => {
      const color =
        i.status === 'out' ? '#C8410A' : i.status === 'critical' ? '#A05A2C' : '#D4860A'
      return `<tr>
        <td>${i.name}</td>
        <td class="num">${i.neededToday.toFixed(3)} ${i.unit}</td>
        <td class="num">${i.stockQty.toFixed(3)} ${i.unit}</td>
        <td class="num bold">${i.toBuy.toFixed(3)} ${i.unit}</td>
        <td class="num">S/ ${i.unitCost.toFixed(4)}</td>
        <td class="num" style="color:${color};font-weight:600">${i.status.toUpperCase()}</td>
      </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Lista de Compras — SAS Restaurantes</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;padding:28px;color:#1C1C1C;font-size:13px}
    h1{font-size:20px;color:#1B2B3A;margin-bottom:4px}
    .sub{font-size:11px;color:#8C9BAA;margin-bottom:20px}
    table{width:100%;border-collapse:collapse}
    th{background:#1B2B3A;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
    td{padding:7px 10px;border-bottom:1px solid #E5E5E5}
    tr:nth-child(even) td{background:#FAFAF8}
    .num{text-align:right;font-family:monospace}
    .bold{font-weight:700}
    .total{margin-top:16px;text-align:right;font-size:14px;font-weight:700;color:#1B2B3A}
    @media print{body{padding:15px}}
  </style>
</head>
<body>
  <h1>🛒 Lista de Compras Urgente</h1>
  <p class="sub">SAS Restaurantes · ${today}</p>
  <table>
    <thead>
      <tr>
        <th>Insumo</th>
        <th style="text-align:right">Necesario hoy</th>
        <th style="text-align:right">Stock actual</th>
        <th style="text-align:right">A comprar</th>
        <th style="text-align:right">Costo unit.</th>
        <th style="text-align:right">Estado</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="total">Costo estimado de reposición: S/ ${totalCost.toFixed(2)}</p>
</body>
</html>`
}

// ─── Component ───────────────────────────────────────────────────────────────

interface CriticalIngredientsSectionProps {
  dailyMenuItems: DailyMenuItem[]
  dailyMenuLoading: boolean
}

export function CriticalIngredientsSection({
  dailyMenuItems,
  dailyMenuLoading,
}: CriticalIngredientsSectionProps) {
  const ingredients = aggregateIngredients(dailyMenuItems)
  const urgentItems = ingredients.filter((i) => i.status !== 'ok')
  const totalUrgentCost = urgentItems.reduce((acc, i) => acc + i.toBuy * i.unitCost, 0)

  const handlePrint = useCallback(() => {
    if (urgentItems.length === 0) return
    const html = buildPrintWindow(urgentItems)
    const win = window.open('', '_blank', 'width=920,height=660')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    // Small delay so the browser renders the document before printing
    setTimeout(() => win.print(), 300)
  }, [urgentItems])

  return (
    <Card
      header={
        <div className="flex items-center justify-between">
          <span className="font-semibold text-primary">🛒 Insumos Críticos del Día</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrint}
            disabled={urgentItems.length === 0}
            aria-label="Descargar lista de compras en PDF"
          >
            ↓ Lista de compras
          </Button>
        </div>
      }
    >
      {dailyMenuLoading && (
        <div className="flex justify-center py-10">
          <Spinner size="md" label="Calculando insumos necesarios..." />
        </div>
      )}

      {!dailyMenuLoading && dailyMenuItems.length === 0 && (
        <p className="text-sm text-muted text-center py-8">
          Confirma el menú del día para ver el análisis de insumos.
        </p>
      )}

      {!dailyMenuLoading && dailyMenuItems.length > 0 && ingredients.length === 0 && (
        <p className="text-sm text-muted text-center py-8">
          Los platos del menú no tienen recetas registradas.
        </p>
      )}

      {!dailyMenuLoading && ingredients.length > 0 && (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm min-w-[540px]">
            <thead>
              <tr className="border-b border-border">
                {['Insumo', 'Necesario hoy', 'Stock actual', 'A comprar', 'Estado'].map(
                  (col, i) => (
                    <th
                      key={col}
                      scope="col"
                      className={[
                        'py-2 text-xs font-semibold uppercase tracking-wide text-muted',
                        i === 0 ? 'text-left pr-3' : i === 4 ? 'text-center pl-3' : 'text-right px-3',
                      ].join(' ')}
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing) => {
                const cfg = STATUS_CONFIG[ing.status]
                return (
                  <tr
                    key={ing.id}
                    className={['border-b border-border/50 transition-colors', cfg.rowBg].join(
                      ' '
                    )}
                  >
                    <td className="py-2.5 pr-3 font-medium text-primary whitespace-nowrap">
                      {ing.name}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-muted tabular-nums whitespace-nowrap">
                      {ing.neededToday.toFixed(3)}&nbsp;{ing.unit}
                    </td>

                    <td
                      className={[
                        'py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap',
                        ing.stockQty < ing.neededToday
                          ? 'text-state-danger font-semibold'
                          : 'text-muted',
                      ].join(' ')}
                    >
                      {ing.stockQty.toFixed(3)}&nbsp;{ing.unit}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-bold text-primary tabular-nums whitespace-nowrap">
                      {ing.toBuy > 0 ? `${ing.toBuy.toFixed(3)} ${ing.unit}` : '—'}
                    </td>

                    <td className="py-2.5 pl-3 text-center">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {urgentItems.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted">
                {urgentItems.length} insumo{urgentItems.length !== 1 ? 's' : ''} requieren
                reposición urgente
              </p>
              <p className="font-mono text-sm font-bold text-primary tabular-nums">
                Costo estimado: S/ {totalUrgentCost.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
