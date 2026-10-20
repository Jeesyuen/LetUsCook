// Deterministic inventory forecasting. Pure functions — easy to swap for an ML service later.
//
//   Average daily usage     = mean(last 14 days of usage)
//   Days remaining          = current stock / average daily usage
//   Reorder point           = average daily usage × lead time + safety stock
//   Suggested order qty     = usage × (lead time + coverage days) + safety stock − current stock,
//                             rounded up to the product's order multiple

import type { Product, PurchaseOrder, RiskLevel } from '@/types'
import { addDays, diffDays, formatShortDate, startOfToday } from '@/utils/date'
import { round } from '@/utils/format'

export type StockStatus = 'Healthy' | 'Reorder Soon' | 'Critical' | 'Out of Stock'

export interface Forecast {
  avgDailyUsage: number
  daysRemaining: number
  stockoutDate: Date | null
  reorderPoint: number
  reorderDate: Date
  daysUntilReorder: number
  suggestedQty: number
  calculatedQty: number
  status: StockStatus
  risk: RiskLevel
  /** Days of cover beyond the supplier lead time — the basis for ranking risk */
  coverageMargin: number
  safetyStock: number
  leadTimeDays: number
  /** true when there's too little history and a flat baseline is used */
  isBaseline: boolean
  needsReorder: boolean
  incoming: number
}

export function averageDailyUsage(p: Product): number {
  const h = p.usageHistory.filter((v) => v >= 0)
  if (h.length === 0) return 0
  return h.reduce((a, b) => a + b, 0) / h.length
}

export function stockStatus(stock: number, safety: number, daysRemaining: number, leadTime: number, reorderPoint: number): StockStatus {
  if (stock <= 0) return 'Out of Stock'
  if (stock <= safety || daysRemaining <= leadTime) return 'Critical'
  if (stock <= reorderPoint) return 'Reorder Soon'
  return 'Healthy'
}

export const riskForStatus = (s: StockStatus): RiskLevel => (s === 'Critical' || s === 'Out of Stock' ? 'High' : s === 'Reorder Soon' ? 'Medium' : 'Low')

/** `incoming` = quantity on open purchase orders, which reduces the suggested order. */
export function computeForecast(p: Product, coverageDays: number, incoming = 0): Forecast {
  const usage = averageDailyUsage(p)
  const { leadTimeDays, safetyStock } = p.reorder
  const today = startOfToday()
  const daysRemaining = usage > 0 ? p.currentStock / usage : Infinity
  const reorderPoint = usage * leadTimeDays + safetyStock
  const daysUntilReorder = usage > 0 ? Math.max(0, (p.currentStock - reorderPoint) / usage) : Infinity
  const target = usage * (leadTimeDays + coverageDays) + safetyStock
  const calculatedQty = Math.max(0, Math.ceil((target - p.currentStock - incoming) / p.orderMultiple) * p.orderMultiple)
  // A fixed reorder quantity from the reorder rule wins, unless open orders already cover it
  const fixed = p.reorder.reorderQty
  const suggestedQty = fixed !== null ? (incoming >= fixed ? 0 : fixed) : calculatedQty
  const status = stockStatus(p.currentStock, safetyStock, daysRemaining, leadTimeDays, reorderPoint)
  return {
    avgDailyUsage: round(usage, 2),
    daysRemaining: Number.isFinite(daysRemaining) ? round(daysRemaining, 1) : 999,
    stockoutDate: Number.isFinite(daysRemaining) ? addDays(today, Math.floor(daysRemaining)) : null,
    reorderPoint: round(reorderPoint, 1),
    reorderDate: addDays(today, Number.isFinite(daysUntilReorder) ? Math.floor(daysUntilReorder) : 365),
    daysUntilReorder: Number.isFinite(daysUntilReorder) ? round(daysUntilReorder, 1) : 999,
    suggestedQty,
    calculatedQty,
    status,
    risk: riskForStatus(status),
    coverageMargin: Number.isFinite(daysRemaining) ? daysRemaining - leadTimeDays : 999,
    safetyStock,
    leadTimeDays,
    isBaseline: p.usageHistory.length < 7,
    needsReorder: (status !== 'Healthy' || p.currentStock <= p.reorder.triggerLevel) && suggestedQty > 0,
    incoming,
  }
}

export interface ForecastPoint {
  day: number
  label: string
  historical?: number
  projected?: number
  withRestock?: number
  safety: number
}

/**
 * Builds a chart series: 14 days of history, today, and `horizon` days of projection.
 * `projected` = depletion if nothing is ordered. `withRestock` = depletion plus the expected
 * replenishment — an open PO's delivery if one exists, otherwise the recommended order placed on the
 * reorder date and arriving after the lead time.
 */
export function buildForecastSeries(p: Product, f: Forecast, openPO?: PurchaseOrder, horizon = 21) {
  const today = startOfToday()
  const points: ForecastPoint[] = []
  p.stockHistory.forEach((level, i) => {
    const day = i - p.stockHistory.length
    points.push({ day, label: formatShortDate(addDays(today, day)), historical: level, safety: f.safetyStock })
  })

  let replenishDay: number
  let replenishQty: number
  if (openPO) {
    replenishDay = Math.max(0, diffDays(new Date(openPO.expectedDelivery), today))
    replenishQty = openPO.quantity
  } else {
    replenishDay = Math.ceil(f.daysUntilReorder) + f.leadTimeDays
    replenishQty = f.suggestedQty
  }

  let withRestock = p.currentStock
  for (let d = 0; d <= horizon; d++) {
    const projected = Math.max(0, p.currentStock - f.avgDailyUsage * d)
    if (d > 0) withRestock = Math.max(0, withRestock - f.avgDailyUsage)
    if (d === replenishDay) withRestock += replenishQty
    points.push({
      day: d,
      label: d === 0 ? 'Today' : formatShortDate(addDays(today, d)),
      historical: d === 0 ? p.currentStock : undefined,
      projected: round(projected, 1),
      withRestock: round(withRestock, 1),
      safety: f.safetyStock,
    })
  }
  return { points, replenishDay, replenishQty, replenishFromPO: !!openPO }
}

/** Short, human-readable explanation of a forecast. Template-based, no LLM. */
export function explainForecast(p: Product, f: Forecast): string {
  const usage = `${round(f.avgDailyUsage, 1)} ${p.unit}/day`
  if (f.status === 'Out of Stock') return `${p.name} is out of stock. At ${usage}, every day without a delivery is lost sales — order now.`
  if (f.status === 'Critical')
    return `At ${usage}, ${p.name.toLowerCase()} will last about ${f.daysRemaining} days — no more than the ${f.leadTimeDays}-day lead time. Order today to avoid dipping below safety stock.`
  if (f.status === 'Reorder Soon')
    return `${p.name} has crossed its reorder point of ${round(f.reorderPoint, 1)} ${p.unit}. With ${f.daysRemaining} days of cover, place an order within the next day or two.`
  return `${p.name} is healthy with ${f.daysRemaining} days of cover. The next order should be placed around ${formatShortDate(f.reorderDate)}.`
}

/**
 * Gross profit at risk: demand that can't be served if an order placed today arrives after the
 * lead time plus a 3-day processing buffer, valued at the product's menu-costing gross profit per unit.
 */
export const EXPOSURE_BUFFER_DAYS = 3
export function grossProfitAtRisk(p: Product, f: Forecast): number {
  const window = f.leadTimeDays + EXPOSURE_BUFFER_DAYS
  const shortfall = Math.max(0, f.avgDailyUsage * window - p.currentStock - f.incoming)
  return round(shortfall * p.grossProfitPerUnit, 0)
}
