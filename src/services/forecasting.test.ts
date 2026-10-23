import { describe, expect, it } from 'vitest'
import { buildForecastSeries, computeForecast } from '@/services/forecasting'
import { addDays, startOfToday } from '@/utils/date'
import type { Product, PurchaseOrder } from '@/types'

const AS_OF = new Date(2026, 9, 23)

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'test-product',
    sku: 'TEST-001',
    name: 'Test Product',
    category: 'Coffee',
    unit: 'kg',
    icon: 'coffee',
    description: 'Forecast test fixture',
    currentStock: 28,
    unitCost: 10,
    grossProfitPerUnit: 0,
    usageHistory: Array(14).fill(2),
    usageHistorySource: 'recorded',
    stockHistory: [],
    orderMultiple: 5,
    reorder: {
      triggerLevel: 8,
      reorderQty: null,
      preferredSupplierId: 'supplier-1',
      leadTimeDays: 3,
      safetyStock: 2,
      autoDraft: true,
    },
    supplierIds: ['supplier-1'],
    ...overrides,
  }
}

function makeOrder(expectedDelivery: string, quantity: number): PurchaseOrder {
  return {
    id: 'po-test',
    number: 'PO-TEST',
    supplierId: 'supplier-1',
    productId: 'test-product',
    quantity,
    unitPrice: 10,
    deliveryFee: 0,
    total: quantity * 10,
    status: 'Confirmed',
    createdAt: AS_OF.toISOString(),
    expectedDelivery,
    leadTimeDays: 3,
    paymentTerms: 'Net 30',
    timeline: [],
  }
}

describe('computeForecast', () => {
  it('calculates stockout, reorder point, and average use for stable demand', () => {
    const forecast = computeForecast(makeProduct(), 7, [], AS_OF)

    expect(forecast.avgDailyUsage).toBe(2)
    expect(forecast.forecastDailyUsage).toBe(2)
    expect(forecast.daysRemaining).toBe(14)
    expect(forecast.stockoutDate?.getDate()).toBe(6)
    expect(forecast.reorderPoint).toBe(8)
    expect(forecast.suggestedQty).toBe(0)
    expect(forecast.risk).toBe('Low')
  })

  it('weights recent demand and raises risk when usage accelerates', () => {
    const forecast = computeForecast(makeProduct({ usageHistory: Array.from({ length: 14 }, (_, i) => i + 1), currentStock: 20 }), 7, [], AS_OF)

    expect(forecast.avgDailyUsage).toBe(7.5)
    expect(forecast.recentDailyUsage).toBe(11)
    expect(forecast.forecastDailyUsage).toBe(8.55)
    expect(forecast.trendPct).toBe(175)
    expect(forecast.risk).toBe('High')
    expect(forecast.riskReason).toContain('within the 3-day supplier lead time')
  })

  it('does not invent depletion dates when demand is zero', () => {
    const forecast = computeForecast(makeProduct({ currentStock: 0, usageHistory: Array(14).fill(0) }), 7, [], AS_OF)

    expect(forecast.avgDailyUsage).toBe(0)
    expect(forecast.daysRemaining).toBe(999)
    expect(forecast.stockoutDate).toBeNull()
    expect(forecast.calculatedQty).toBe(0)
    expect(forecast.suggestedQty).toBe(0)
    expect(forecast.limitation).toContain('No positive usage')
  })

  it('handles missing and insufficient history with the configured safety buffer', () => {
    const empty = computeForecast(makeProduct({ usageHistory: [] }), 7, [], AS_OF)
    const short = computeForecast(makeProduct({ usageHistory: [4, 6] }), 7, [], AS_OF)

    expect(empty.avgDailyUsage).toBe(0)
    expect(empty.stockoutDate).toBeNull()
    expect(empty.safetyStock).toBe(2)
    expect(empty.limitation).toContain('No usage history')
    expect(short.avgDailyUsage).toBe(5)
    expect(short.safetyStock).toBe(2)
    expect(short.isBaseline).toBe(true)
    expect(short.historySource).toBe('recorded')
  })

  it('normalizes invalid usage and negative stock without producing invalid results', () => {
    const forecast = computeForecast(
      makeProduct({ currentStock: -3, usageHistory: [2, Number.NaN, -1, Number.POSITIVE_INFINITY] }),
      7,
      [],
      AS_OF,
    )

    expect(forecast.daysRemaining).toBe(0)
    expect(forecast.stockoutDate?.getTime()).toBe(AS_OF.getTime())
    expect(forecast.status).toBe('Out of Stock')
    expect(forecast.risk).toBe('High')
    expect(Number.isFinite(forecast.reorderPoint)).toBe(true)
    expect(Number.isFinite(forecast.suggestedQty)).toBe(true)
  })

  it('classifies zero on-hand stock as immediately out of stock', () => {
    const forecast = computeForecast(makeProduct({ currentStock: 0 }), 7, [], AS_OF)

    expect(forecast.daysRemaining).toBe(0)
    expect(forecast.stockoutDate?.getTime()).toBe(AS_OF.getTime())
    expect(forecast.status).toBe('Out of Stock')
    expect(forecast.risk).toBe('High')
  })

  it('uses a larger variability buffer for longer lead times', () => {
    const variable = makeProduct({ usageHistory: [1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3], reorder: { ...makeProduct().reorder, safetyStock: 0 } })
    const shortLead = computeForecast({ ...variable, reorder: { ...variable.reorder, leadTimeDays: 1 } }, 7, [], AS_OF)
    const longLead = computeForecast({ ...variable, reorder: { ...variable.reorder, leadTimeDays: 9 } }, 7, [], AS_OF)

    expect(shortLead.usageStdDev).not.toBeNull()
    expect(longLead.safetyStock).toBeGreaterThan(shortLead.safetyStock)
  })

  it('net-calculates an order quantity below the reorder point and rounds to pack size', () => {
    const forecast = computeForecast(makeProduct({ currentStock: 5 }), 7, [], AS_OF)

    expect(forecast.reorderPoint).toBe(8)
    expect(forecast.calculatedQty).toBe(20)
    expect(forecast.suggestedQty).toBe(20)
    expect(forecast.suggestedQty % 5).toBe(0)
    expect(forecast.recommendationReason).toContain('rounded to 5 kg packs')
  })

  it('classifies below-reorder stock as medium risk and stockout on the lead-time boundary as critical', () => {
    const belowReorder = computeForecast(makeProduct({ currentStock: 7.5 }), 7, [], AS_OF)
    const atLeadTimeBoundary = computeForecast(makeProduct({ currentStock: 6 }), 7, [], AS_OF)

    expect(belowReorder.status).toBe('Reorder Soon')
    expect(belowReorder.risk).toBe('Medium')
    expect(belowReorder.riskReason).toContain('at or below the reorder point')
    expect(atLeadTimeBoundary.daysRemaining).toBe(3)
    expect(atLeadTimeBoundary.status).toBe('Critical')
  })

  it('classifies stock at or below safety stock as critical even with long cover', () => {
    const slowMover = makeProduct({ currentStock: 4, usageHistory: Array(14).fill(0.2), reorder: { ...makeProduct().reorder, safetyStock: 5 } })
    const forecast = computeForecast(slowMover, 7, [], AS_OF)

    expect(forecast.daysRemaining).toBe(20)
    expect(forecast.status).toBe('Critical')
    expect(forecast.riskReason).toContain('at or below the safety stock')
  })

  it('accounts for dated open orders once and identifies an order arriving after depletion', () => {
    const lateOrder = makeOrder(new Date(2026, 9, 26).toISOString(), 20)
    const forecast = computeForecast(makeProduct({ currentStock: 10, usageHistory: Array(14).fill(5) }), 7, [lateOrder], AS_OF)

    expect(forecast.daysRemaining).toBe(2)
    expect(forecast.status).toBe('Critical')
    expect(forecast.riskReason).toContain('before an open order due in 3 days')
    expect(forecast.incoming).toBe(20)
  })

  it('projects stockout after a timely order arrives instead of subtracting it twice', () => {
    const timelyOrder = makeOrder(new Date(2026, 9, 24).toISOString(), 20)
    const forecast = computeForecast(makeProduct({ currentStock: 10, usageHistory: Array(14).fill(5) }), 7, [timelyOrder], AS_OF)

    expect(forecast.daysRemaining).toBe(6)
    expect(forecast.incoming).toBe(20)
  })

  it('pushes the reorder date back when an open order arrives before the reorder point', () => {
    const order = makeOrder(new Date(2026, 9, 26).toISOString(), 20)
    const withoutOrder = computeForecast(makeProduct(), 7, [], AS_OF)
    const withOrder = computeForecast(makeProduct(), 7, [order], AS_OF)

    expect(withoutOrder.daysUntilReorder).toBe(10)
    expect(withOrder.daysUntilReorder).toBe(20)
    expect(withOrder.reorderDate.getDate()).toBe(12)
  })

  it('reduces a fixed reorder quantity by eligible incoming stock and respects lead time', () => {
    const order = makeOrder(new Date(2026, 9, 25).toISOString(), 4)
    const product = makeProduct({
      currentStock: 5,
      reorder: { ...makeProduct().reorder, leadTimeDays: 8, reorderQty: 12 },
    })
    const forecast = computeForecast(product, 7, [order], AS_OF)

    expect(forecast.suggestedQty).toBe(10)
    expect(forecast.leadTimeDays).toBe(8)
    expect(forecast.recommendationReason).toContain('Fixed reorder quantity')
  })

  it('applies the preferred supplier minimum only when an order is needed', () => {
    const product = makeProduct({ currentStock: 5 })
    const needed = computeForecast(product, 2, [], AS_OF, 12)
    const covered = computeForecast(makeProduct(), 7, [], AS_OF, 12)

    expect(needed.suggestedQty).toBe(15)
    expect(needed.minimumOrderQty).toBe(12)
    expect(covered.suggestedQty).toBe(0)
  })

  it('ignores invalid purchase-order dates and falls back safely from an invalid forecast date', () => {
    const forecast = computeForecast(makeProduct(), 7, [makeOrder('not-a-date', 100)], new Date(Number.NaN))

    expect(forecast.daysRemaining).toBe(14)
    expect(forecast.incoming).toBe(0)
    expect(Number.isFinite(forecast.stockoutDate?.getTime())).toBe(true)
  })
})

describe('buildForecastSeries', () => {
  it('adds every open order to the restock line, not just the first', () => {
    const product = makeProduct({ currentStock: 20 })
    const forecast = computeForecast(product, 7)
    const today = startOfToday()
    const orders = [makeOrder(addDays(today, 2).toISOString(), 10), makeOrder(addDays(today, 5).toISOString(), 15)]
    const { points, replenishDay, replenishQty, replenishFromPO } = buildForecastSeries(product, forecast, orders)
    const day = (d: number) => points.find((point) => point.day === d)

    expect(replenishFromPO).toBe(true)
    expect(replenishDay).toBe(2)
    expect(replenishQty).toBe(10)
    expect(day(2)?.withRestock).toBe(26)
    expect(day(5)?.withRestock).toBe(35)
  })
})
