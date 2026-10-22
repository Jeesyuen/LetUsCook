import { describe, expect, it } from 'vitest'
import { compareSuppliers, compareSuppliersEndpoint, MatchingValidationError, PRIORITY_WEIGHTS, type CompareSuppliersRequest, type SupplierInput } from '@/services/matching'
import { mockSuppliersFor } from '@/data/sampleSupplierData'

// Example request (test values, not real suppliers)
const example: CompareSuppliersRequest = {
  product: 'Arabica Coffee Beans',
  required_quantity: 100,
  unit: 'kg',
  priority: 'best_overall',
  suppliers: [
    { id: 'SUP001', name: 'Supplier A', total_price: 1800, distance_km: 12, delivery_days: 5, reliability: 90, product_suitability: 100 },
    { id: 'SUP002', name: 'Supplier B', total_price: 1950, distance_km: 4, delivery_days: 2, reliability: 95, product_suitability: 100 },
    { id: 'SUP003', name: 'Supplier C', total_price: 1700, distance_km: 25, delivery_days: 8, reliability: 85, product_suitability: 100 },
  ],
}

const run = (patch: Partial<CompareSuppliersRequest> = {}) => compareSuppliers({ ...example, ...patch })
const ranking = (res: ReturnType<typeof run>, id: string) => res.rankings.find((r) => r.supplier_id === id)!
const order = (res: ReturnType<typeof run>) => res.rankings.filter((r) => r.rank !== null).map((r) => r.supplier_id)
const supplier = (id: string, patch: Partial<SupplierInput> = {}): SupplierInput => ({ ...example.suppliers.find((s) => s.id === id)!, ...patch })

describe('1. weighted score calculation', () => {
  const res = run()

  it('normalises each criterion with the documented formulas', () => {
    const a = ranking(res, 'SUP001').score_breakdown
    expect(a.price).toBe(82.4) // 100 − 3 × 5.88% above RM1,700
    expect(a.delivery).toBe(50) // (2 + 1) / (5 + 1)
    expect(a.distance).toBe(63.6) // (4 + 10) / (12 + 10)
    expect(a.reliability).toBe(90)
    expect(a.product_suitability).toBe(100)
    expect(ranking(res, 'SUP003').score_breakdown.price).toBe(100)
  })

  it('combines criteria with the 30/25/20/15/10 weights', () => {
    expect(res.weights).toEqual({ price: 30, delivery: 25, reliability: 20, distance: 15, product_suitability: 10 })
    expect(ranking(res, 'SUP001').compatibility_score).toBe(74.8)
    expect(ranking(res, 'SUP002').compatibility_score).toBe(85.8)
    expect(ranking(res, 'SUP003').compatibility_score).toBe(71.3)
  })

  it('reports points per criterion that add up to the score', () => {
    const b = ranking(res, 'SUP002')
    const sum = Object.values(b.details).reduce((s, d) => s + d.points, 0)
    expect(sum).toBeCloseTo(b.compatibility_score!, 0)
    expect(b.data_coverage).toBe(1)
  })
})

describe('2. ranking order', () => {
  it('ranks best overall by score and returns every supplier with its id', () => {
    const res = run()
    expect(order(res)).toEqual(['SUP002', 'SUP001', 'SUP003'])
    expect(res.rankings.map((r) => r.rank)).toEqual([1, 2, 3])
    expect(res.recommended_supplier_id).toBe('SUP002')
    expect(res.rankings).toHaveLength(3)
  })
})

describe('3–6. priority modes', () => {
  it('Cheapest selects the lowest-cost eligible supplier', () => {
    const res = run({ priority: 'cheapest' })
    expect(res.recommended_supplier_id).toBe('SUP003')
    expect(order(res)).toEqual(['SUP003', 'SUP001', 'SUP002'])
    expect(res.weights).toEqual(PRIORITY_WEIGHTS.cheapest)
  })

  it('Cheapest skips a cheaper supplier that cannot fulfil the order', () => {
    const res = run({ priority: 'cheapest', suppliers: [...example.suppliers, { ...supplier('SUP003'), id: 'X', name: 'Out of stock', total_price: 900, available_quantity: 20 }] })
    expect(res.recommended_supplier_id).toBe('SUP003')
    expect(ranking(res, 'X').rank).toBeNull()
  })

  it('Nearest selects the closest eligible supplier', () => {
    expect(run({ priority: 'nearest', suppliers: [supplier('SUP001'), supplier('SUP002', { distance_km: 40 }), supplier('SUP003')] }).recommended_supplier_id).toBe('SUP001')
  })

  it('Fastest selects the fastest eligible supplier', () => {
    expect(run({ priority: 'fastest', suppliers: [supplier('SUP001', { delivery_days: 1 }), supplier('SUP002'), supplier('SUP003')] }).recommended_supplier_id).toBe('SUP001')
  })

  it('Best Overall applies the balanced weights rather than a single criterion', () => {
    const res = run()
    expect(res.weights).toEqual(PRIORITY_WEIGHTS.best_overall)
    // Not the cheapest (SUP003), not decided by price alone
    expect(res.recommended_supplier_id).toBe('SUP002')
  })

  it('recalculates scores when the priority changes', () => {
    const overall = ranking(run(), 'SUP003').compatibility_score!
    const cheapest = ranking(run({ priority: 'cheapest' }), 'SUP003').compatibility_score!
    expect(cheapest).toBe(88.1)
    expect(cheapest).toBeGreaterThan(overall)
  })
})

describe('7. ranking follows the data', () => {
  it('changes the recommendation when supplier information changes', () => {
    const res = run({ suppliers: [supplier('SUP001', { total_price: 1650, delivery_days: 1, distance_km: 3 }), supplier('SUP002'), supplier('SUP003')] })
    expect(res.recommended_supplier_id).toBe('SUP001')
  })
})

describe('8. missing data', () => {
  it('leaves missing reliability out, rescales the weights and flags the supplier', () => {
    const res = run({ suppliers: [supplier('SUP001', { reliability: null }), supplier('SUP002')] })
    const a = ranking(res, 'SUP001')
    expect(a.eligibility).toBe('unverified')
    expect(a.missing).toEqual(['reliability'])
    expect(a.score_breakdown.reliability).toBeNull()
    expect(a.details.reliability.points).toBe(0)
    expect(a.data_coverage).toBe(0.8)
    expect(a.details.price.applied_weight).toBe(37.5) // 30 ÷ 80
    expect(a.rank).not.toBeNull()
  })

  it('handles missing distance without inventing a value', () => {
    const res = run({ suppliers: [supplier('SUP001', { distance_km: null }), supplier('SUP002')], priority: 'nearest' })
    expect(ranking(res, 'SUP001').score_breakdown.distance).toBeNull()
    // Unknown distance is never treated as "nearest"
    expect(res.recommended_supplier_id).toBe('SUP002')
  })

  it('handles an empty or fully ineligible supplier list', () => {
    expect(run({ suppliers: [] }).recommended_supplier_id).toBeNull()
    const res = run({ suppliers: [supplier('SUP001', { product_suitability: 0 }), supplier('SUP002', { delivers_to_business: false })] })
    expect(res.recommended_supplier_id).toBeNull()
    expect(res.recommendation).toBeNull()
    expect(res.rankings.every((r) => r.rank === null && r.eligibility === 'ineligible')).toBe(true)
    expect(res.rankings[0].explanation).toMatch(/^Not eligible:/)
  })
})

describe('validation and eligibility', () => {
  it.each([0, -5, Number.NaN])('rejects required_quantity %s', (q) => {
    expect(() => run({ required_quantity: q })).toThrow(MatchingValidationError)
  })

  it('rejects duplicate supplier ids and malformed JSON', () => {
    expect(() => run({ suppliers: [supplier('SUP001'), supplier('SUP001')] })).toThrow(MatchingValidationError)
    expect(() => compareSuppliersEndpoint({ ...example, suppliers: [{ id: 'x', name: 'X', total_price: '100' }] })).toThrow(/total_price must be a number/)
    expect(() => compareSuppliersEndpoint({ ...example, priority: 'random' })).toThrow(MatchingValidationError)
  })

  it.each([
    ['negative price', { total_price: -1 }],
    ['unsuitable product', { product_suitability: 0 }],
    ['not enough stock', { available_quantity: 50 }],
    ['MOQ above the order', { minimum_order_quantity: 500 }],
    ['no delivery coverage', { delivers_to_business: false }],
    ['reliability out of range', { reliability: 120 }],
  ] as const)('excludes a supplier with %s', (_label, patch) => {
    const res = run({ suppliers: [supplier('SUP001', patch), supplier('SUP002')] })
    const a = ranking(res, 'SUP001')
    expect(a.rank).toBeNull()
    expect(a.eligibility).toBe('ineligible')
    expect(a.compatibility_score).toBeNull()
    expect(a.issues.length).toBeGreaterThan(0)
    expect(res.recommended_supplier_id).toBe('SUP002')
  })
})

describe('tie-breaking', () => {
  it('orders identical suppliers by name regardless of input order', () => {
    const x = { ...supplier('SUP001'), id: 'X', name: 'Beta' }
    const y = { ...supplier('SUP001'), id: 'Y', name: 'Alpha' }
    expect(order(run({ suppliers: [x, y] }))).toEqual(['Y', 'X'])
    expect(order(run({ suppliers: [y, x] }))).toEqual(['Y', 'X'])
  })
})

describe('9. explanations reflect the scores', () => {
  it('explains the recommended supplier with its real advantages and trade-offs', () => {
    const rec = run().recommendation!
    expect(rec.supplier_id).toBe('SUP002')
    expect(rec.headline).toBe('Supplier B — 86% compatibility')
    expect(rec.summary).toBe(
      'Supplier B is recommended because it offers faster delivery and stronger delivery reliability. Although its price is higher than Supplier C (RM250.00 more), its overall balance of price, speed and reliability scores highest.',
    )
    expect(rec.advantages).toContain('Fastest delivery in 2 days, 3 days sooner than Supplier A.')
    expect(rec.advantages).toContain('Closest to your business at 4 km.')
    expect(rec.tradeoffs).toContain('RM250.00 (15%) more expensive than Supplier C.')
  })

  it('never claims an advantage the supplier does not have', () => {
    const rec = run({ priority: 'cheapest' }).recommendation!
    expect(rec.supplier_id).toBe('SUP003')
    expect(rec.advantages.join(' ')).toContain('Lowest total price at RM1,700.00')
    expect(rec.advantages.join(' ')).not.toMatch(/Fastest|Closest|Most reliable/)
    expect(rec.summary).toMatch(/the Cheapest priority puts total cost first/)
  })

  it('mentions urgent restocking only when delivery beats the stockout', () => {
    expect(run({ days_until_stockout: 3 }).recommendation!.summary).toMatch(/more suitable for urgent restocking/)
    expect(run({ days_until_stockout: 3 }).recommendation!.advantages.join(' ')).toMatch(/Arrives before the projected stockout in 3 days; Supplier A and Supplier C would not/)
  })

  it('gives every supplier an explanation consistent with its rank', () => {
    const res = run()
    expect(ranking(res, 'SUP001').explanation).toMatch(/^Ranked #2 with 75% compatibility\./)
    expect(ranking(res, 'SUP003').explanation).toMatch(/^Ranked #3 with 71% compatibility\. Lowest total price at RM1,700.00/)
  })

  it('flags missing data in the caveats', () => {
    const res = run({ suppliers: [supplier('SUP002', { reliability: null }), supplier('SUP001')] })
    expect(res.recommendation!.caveats).toContain('Reliability not available — not scored; the other weights were rescaled.')
  })
})

describe('sample supplier data', () => {
  it('produces the contract with preserved supplier ids and mock labelling', () => {
    const suppliers = mockSuppliersFor('p-coffee', 100)
    expect(suppliers.map((s) => s.id)).toEqual(expect.arrayContaining(['s-beancraft', 's-aroma', 's-nusantara']))
    const res = compareSuppliers({ product: 'Arabica Coffee Beans', required_quantity: 100, unit: 'kg', suppliers })
    expect(res.uses_mock_data).toBe(true)
    expect(res.rankings.map((r) => r.eligibility)).toEqual(expect.arrayContaining(['eligible', 'unverified', 'ineligible']))
  })
})
