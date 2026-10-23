// Deterministic inventory forecasting. Pure functions — easy to swap for an ML service later.
//
// Usage trend, safety stock, reorder point, and pack-rounded purchase quantity
// are calculated independently of the UI using the product's configured units.

import type { Product, PurchaseOrder, RiskLevel } from '@/types'
import { addDays, diffDays, formatShortDate, startOfToday } from '@/utils/date'
import { round } from '@/utils/format'

export type StockStatus = 'Healthy' | 'Reorder Soon' | 'Critical' | 'Out of Stock'
export type HistorySource = 'simulated' | 'recorded' | 'baseline' | 'unverified'

const VARIABILITY_SERVICE_FACTOR = 1.65
const RECENT_DEMAND_WEIGHT = 0.3
const HIGH_RISK_WARNING_DAYS = 7
export const EXPOSURE_BUFFER_DAYS = 3
const INFINITE_DAYS = 999

export interface Forecast {
  avgDailyUsage: number
  recentDailyUsage: number | null
  forecastDailyUsage: number
  usageStdDev: number | null
  trendPct: number | null
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
  historySource: HistorySource
  minimumOrderQty: number
  riskReason: string
  recommendationReason: string
  limitation: string | null
  needsReorder: boolean
  incoming: number
  incomingInExposureWindow: number
}

export function averageDailyUsage(p: Product): number {
  const h = Array.isArray(p.usageHistory) ? p.usageHistory.filter((v) => Number.isFinite(v) && v >= 0) : []
  if (h.length === 0) return 0
  return h.reduce((a, b) => a + b, 0) / h.length
}

export function stockStatus(stock: number, safety: number, daysRemaining: number, leadTime: number, reorderPoint: number): StockStatus {
  if (stock <= 0) return 'Out of Stock'
  if (stock <= safety || daysRemaining <= leadTime) return 'Critical'
  if (stock <= reorderPoint || daysRemaining <= leadTime + HIGH_RISK_WARNING_DAYS) return 'Reorder Soon'
  return 'Healthy'
}

export const riskForStatus = (s: StockStatus): RiskLevel => (s === 'Critical' || s === 'Out of Stock' ? 'High' : s === 'Reorder Soon' ? 'Medium' : 'Low')

/** Configured safety stock, raised to cover demand variability over the lead time when it is known. */
export function safetyStockFor(configuredSafety: number, usageStdDev: number | null, leadTimeDays: number): number {
  return usageStdDev === null ? configuredSafety : Math.max(configuredSafety, VARIABILITY_SERVICE_FACTOR * usageStdDev * Math.sqrt(leadTimeDays))
}

interface SupplyEvent {
  day: number
  quantity: number
}

function safeNonNegative(value: number, fallback = 0): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function supplyEvents(orders: PurchaseOrder[], asOf: Date): SupplyEvent[] {
  return orders.flatMap((order) => {
    const quantity = safeNonNegative(order.quantity)
    const arrival = new Date(order.expectedDelivery)
    if (quantity <= 0 || !Number.isFinite(arrival.getTime())) return []
    arrival.setHours(0, 0, 0, 0)
    const day = Math.max(0, diffDays(arrival, asOf))
    return [{ day, quantity }]
  }).sort((a, b) => a.day - b.day)
}

/** Days until projected stock falls to `level`, with open orders added on their arrival day. */
function projectedDaysUntil(level: number, stock: number, usage: number, events: SupplyEvent[]): number {
  if (usage <= 0) return Infinity
  if (stock <= level) return 0
  let remaining = stock
  let elapsed = 0
  for (const event of events) {
    const demand = usage * (event.day - elapsed)
    if (remaining - demand < level) return elapsed + (remaining - level) / usage
    remaining = remaining - demand + event.quantity
    elapsed = event.day
  }
  return elapsed + (remaining - level) / usage
}

/**
 * Calculates a deterministic forecast. A numeric third argument is retained for
 * compatibility with older callers; it represents undated incoming stock at day 0.
 */
export function computeForecast(
  p: Product,
  coverageDays: number,
  incoming: number | PurchaseOrder[] = 0,
  asOf: Date = startOfToday(),
  minimumOrderQty = 0,
): Forecast {
  const history = Array.isArray(p.usageHistory) ? p.usageHistory.filter((v) => Number.isFinite(v) && v >= 0) : []
  const usage = history.length ? history.reduce((sum, value) => sum + value, 0) / history.length : 0
  const recent = history.length >= 7 ? history.slice(-7).reduce((sum, value) => sum + value, 0) / 7 : null
  const forecastUsage = recent === null ? usage : usage * (1 - RECENT_DEMAND_WEIGHT) + recent * RECENT_DEMAND_WEIGHT
  const variance = history.length >= 7
    ? history.reduce((sum, value) => sum + (value - usage) ** 2, 0) / (history.length - 1)
    : null
  const stdDev = variance === null ? null : Math.sqrt(variance)
  const earlierWeekUsage = history.length >= 14 ? history.slice(-14, -7).reduce((sum, value) => sum + value, 0) / 7 : null
  const source = p.usageHistorySource ?? (history.length === 1 ? 'baseline' : 'unverified')
  const stock = safeNonNegative(p.currentStock)
  const leadTimeDays = safeNonNegative(p.reorder?.leadTimeDays)
  const configuredSafety = safeNonNegative(p.reorder?.safetyStock)
  const coverage = safeNonNegative(coverageDays)
  const multiple = safeNonNegative(p.orderMultiple, 1) || 1
  const minimumQty = safeNonNegative(minimumOrderQty)
  const safetyStock = safetyStockFor(configuredSafety, stdDev, leadTimeDays)
  const reorderPoint = forecastUsage * leadTimeDays + safetyStock
  const today = Number.isFinite(asOf.getTime()) ? new Date(asOf) : startOfToday()
  today.setHours(0, 0, 0, 0)
  const orders = Array.isArray(incoming) ? incoming : []
  const events = supplyEvents(orders, today)
  if (typeof incoming === 'number' && safeNonNegative(incoming) > 0) {
    events.unshift({ day: 0, quantity: safeNonNegative(incoming) })
  }
  const projectedDays = projectedDaysUntil(0, stock, forecastUsage, events)
  const daysRemaining = Number.isFinite(projectedDays) ? projectedDays : INFINITE_DAYS
  const daysUntilReorder = projectedDaysUntil(reorderPoint, stock, forecastUsage, events)
  const horizonDays = leadTimeDays + coverage
  const incomingInHorizon = events.reduce((sum, event) => sum + (event.day <= horizonDays ? event.quantity : 0), 0)
  const incomingInExposureWindow = events.reduce((sum, event) => sum + (event.day <= leadTimeDays + EXPOSURE_BUFFER_DAYS ? event.quantity : 0), 0)
  const target = forecastUsage * horizonDays + safetyStock
  const applyOrderConstraints = (quantity: number) =>
    quantity > 0 ? Math.ceil(Math.max(quantity, minimumQty) / multiple) * multiple : 0
  const calculatedQty = forecastUsage > 0
    ? applyOrderConstraints(Math.max(0, target - stock - incomingInHorizon))
    : 0
  const configuredQty = p.reorder?.reorderQty
  const fixedQty = typeof configuredQty === 'number' && Number.isFinite(configuredQty) && configuredQty > 0 ? configuredQty : null
  const suggestedQty = fixedQty !== null
    ? applyOrderConstraints(Math.max(0, safeNonNegative(fixedQty) - incomingInHorizon))
    : calculatedQty
  const status = stockStatus(stock, safetyStock, daysRemaining, leadTimeDays, reorderPoint)
  const risk = riskForStatus(status)
  const trendPct = earlierWeekUsage !== null && earlierWeekUsage > 0 && recent !== null ? ((recent - earlierWeekUsage) / earlierWeekUsage) * 100 : null
  const limitation = history.length === 0
    ? 'No usage history is available; a stockout date cannot be estimated reliably.'
    : forecastUsage <= 0
      ? 'No positive usage is available, so a stockout date cannot be estimated.'
      : history.length < 7
        ? 'Fewer than 7 valid daily observations; variability and recent trends are unavailable.'
        : null
  const riskReason = status === 'Out of Stock'
    ? 'No usable stock is on hand; replenish immediately.'
    : status === 'Critical'
      ? stock <= safetyStock
        ? `Current stock of ${round(stock, 1)} ${p.unit} is at or below the safety stock of ${round(safetyStock, 1)} ${p.unit}.`
        : events[0] && projectedDays < events[0].day
          ? `Projected stockout in ${round(daysRemaining, 1)} days, before an open order due in ${events[0].day} days and within the ${leadTimeDays}-day supplier lead time.`
          : `Projected stockout in ${round(daysRemaining, 1)} days, within the ${leadTimeDays}-day supplier lead time.`
      : status === 'Reorder Soon'
        ? stock <= reorderPoint
          ? `Current stock is at or below the reorder point of ${round(reorderPoint, 1)} ${p.unit}.`
          : `Projected stockout in ${round(daysRemaining, 1)} days, within ${HIGH_RISK_WARNING_DAYS} days beyond the ${leadTimeDays}-day lead time.`
        : `Projected stock covers supplier lead time and the current safety buffer.`
  const recommendationReason = suggestedQty > 0
    ? fixedQty !== null
      ? `Fixed reorder quantity of ${safeNonNegative(fixedQty)} ${p.unit}, net of ${round(incomingInHorizon, 1)} incoming ${p.unit} due within ${round(horizonDays, 1)} days, rounded to ${multiple} ${p.unit} packs${minimumQty > 0 ? ` with a preferred-supplier minimum of ${minimumQty} ${p.unit}` : ''}.`
      : `Covers ${round(horizonDays, 1)} days of forecast demand plus ${round(safetyStock, 1)} ${p.unit} safety stock, less ${round(stock, 1)} ${p.unit} on hand and ${round(incomingInHorizon, 1)} ${p.unit} incoming by the coverage window; rounded to ${multiple} ${p.unit} packs${minimumQty > 0 ? ` with a preferred-supplier minimum of ${minimumQty} ${p.unit}` : ''}.`
    : forecastUsage <= 0
      ? 'No positive demand is available, so no calculated order quantity is recommended.'
      : `No order is currently suggested: available stock and ${round(incomingInHorizon, 1)} incoming units cover the planned demand and safety buffer.`
  return {
    avgDailyUsage: round(usage, 2),
    recentDailyUsage: recent === null ? null : round(recent, 2),
    forecastDailyUsage: round(forecastUsage, 2),
    usageStdDev: stdDev === null ? null : round(stdDev, 2),
    trendPct: trendPct === null ? null : round(trendPct, 1),
    daysRemaining: Number.isFinite(daysRemaining) ? round(daysRemaining, 1) : INFINITE_DAYS,
    stockoutDate: Number.isFinite(projectedDays) ? addDays(today, Math.floor(projectedDays)) : null,
    reorderPoint: round(reorderPoint, 1),
    reorderDate: addDays(today, Number.isFinite(daysUntilReorder) ? Math.floor(daysUntilReorder) : 365),
    daysUntilReorder: Number.isFinite(daysUntilReorder) ? round(daysUntilReorder, 1) : INFINITE_DAYS,
    suggestedQty,
    calculatedQty,
    status,
    risk,
    coverageMargin: Number.isFinite(daysRemaining) ? daysRemaining - leadTimeDays : INFINITE_DAYS,
    safetyStock,
    leadTimeDays,
    isBaseline: history.length < 7,
    historySource: source,
    minimumOrderQty: minimumQty,
    riskReason,
    recommendationReason,
    limitation,
    needsReorder: (status !== 'Healthy' || stock <= safeNonNegative(p.reorder?.triggerLevel)) && suggestedQty > 0,
    incoming: incomingInHorizon,
    incomingInExposureWindow,
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
    const projected = Math.max(0, p.currentStock - f.forecastDailyUsage * d)
    if (d > 0) withRestock = Math.max(0, withRestock - f.forecastDailyUsage)
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
  const usage = `${round(f.forecastDailyUsage, 1)} ${p.unit}/day`
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
export function grossProfitAtRisk(p: Product, f: Forecast): number {
  const window = f.leadTimeDays + EXPOSURE_BUFFER_DAYS
  const shortfall = Math.max(0, f.forecastDailyUsage * window - p.currentStock - f.incomingInExposureWindow)
  return round(shortfall * p.grossProfitPerUnit, 0)
}
