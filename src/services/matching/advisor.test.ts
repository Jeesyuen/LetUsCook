import { describe, expect, it } from 'vitest'
import { compareSuppliers, type CompareSuppliersRequest, type SupplierInput } from '@/services/matching'

// Example test values (not real suppliers)
const A: SupplierInput = { id: 'SUP001', name: 'Supplier A', total_price: 1800, distance_km: 12, delivery_days: 5, reliability: 90, product_suitability: 100 }
const B: SupplierInput = { id: 'SUP002', name: 'Supplier B', total_price: 1950, distance_km: 4, delivery_days: 2, reliability: 95, product_suitability: 100 }
const C: SupplierInput = { id: 'SUP003', name: 'Supplier C', total_price: 1700, distance_km: 25, delivery_days: 8, reliability: 85, product_suitability: 100 }

const advise = (patch: Partial<CompareSuppliersRequest> = {}) =>
  compareSuppliers({ product: 'Arabica Coffee Beans', required_quantity: 100, unit: 'kg', priority: 'best_overall', suppliers: [A, B, C], ...patch }).advice!

describe('recommendation categories', () => {
  it('labels suppliers from the actual data, allowing several labels per supplier', () => {
    const { categories } = advise()
    expect(categories.SUP002).toEqual(['best_overall', 'fastest_delivery', 'nearest', 'most_reliable'])
    expect(categories.SUP003).toEqual(['best_budget'])
    expect(categories.SUP001).toEqual([]) // never forced to have a distinction
  })

  it('keeps Best Overall on the balanced score even in another priority', () => {
    expect(advise({ priority: 'cheapest' }).categories.SUP002).toContain('best_overall')
  })

  it('shares a label on ties and gives none when everyone is equal', () => {
    const tie = advise({ suppliers: [A, { ...C, delivery_days: 5 }, B] })
    expect(tie.categories.SUP001).not.toContain('fastest_delivery')
    const same = advise({ suppliers: [{ ...A, product_suitability: 100, reliability: 90 }, { ...B, reliability: 90 }] })
    expect(Object.values(same.categories).flat()).not.toContain('most_reliable')
    const both = advise({ suppliers: [A, { ...C, total_price: 1800 }, B] })
    expect(both.categories.SUP001).toContain('best_budget')
    expect(both.categories.SUP003).toContain('best_budget')
  })

  it('never awards Most Reliable or Nearest from missing data', () => {
    const res = advise({ suppliers: [{ ...A, reliability: null, distance_km: null }, B] })
    expect(res.categories.SUP001).not.toContain('most_reliable')
    expect(res.categories.SUP001).not.toContain('nearest')
    // only one supplier has reliability data → no comparison, no label
    expect(res.categories.SUP002).not.toContain('most_reliable')
  })
})

describe('top 3 suggestions', () => {
  it('returns the primary pick and two alternatives in ranking order', () => {
    const a = advise()
    expect(a.primary_supplier_id).toBe('SUP002')
    expect(a.alternative_supplier_ids).toEqual(['SUP001', 'SUP003'])
    expect(a.suggestions.map((s) => s.supplier_id)).toEqual(['SUP002', 'SUP001', 'SUP003'])
    expect(a.suggestions.map((s) => s.compatibility_score)).toEqual([85.8, 74.8, 71.3])
  })

  it('handles a single eligible supplier and no eligible suppliers', () => {
    const one = advise({ suppliers: [A] })
    expect(one.suggestions).toHaveLength(1)
    expect(one.alternative_supplier_ids).toEqual([])
    expect(compareSuppliers({ product: 'x', required_quantity: 100, unit: 'kg', suppliers: [{ ...A, product_suitability: 0 }] }).advice).toBeNull()
  })

  it('explains each supplier with real advantages, drawbacks and when to choose it', () => {
    const [b, a, c] = advise().suggestions
    expect(b.why).toBe('Our top pick: it offers faster delivery and stronger delivery reliability.')
    expect(b.advantages).toContain('Fastest delivery in 2 days, 3 days sooner than Supplier A.')
    expect(b.drawbacks).toContain('RM250.00 (15%) more expensive than Supplier C.')
    expect(a.why).toBe('Alternative: RM150.00 cheaper than Supplier B, with 75% compatibility.')
    expect(a.choose_when).toBe('Choose when reducing costs is more important.')
    expect(c.why).toBe('Best Budget Choice: it offers the lowest total price — RM250.00 cheaper than Supplier B.')
    expect(c.choose_when).toBe('Choose when keeping costs down matters more than delivery speed.')
  })

  it('writes a concise final recommendation like a procurement consultant', () => {
    expect(advise().final_recommendation).toBe(
      'We recommend Supplier B for this purchase because it offers faster delivery and stronger delivery reliability. Supplier A is a strong alternative if reducing costs is more important. Supplier C is a strong alternative if the lowest price matters most.',
    )
  })
})

describe('personalised advice from the stock forecast', () => {
  it('reports no forecast honestly', () => {
    const a = advise()
    expect(a.urgency).toBe('unknown')
    expect(a.suggestions.every((s) => s.arrives_before_stockout === null)).toBe(true)
  })

  it('classifies urgency against the suppliers’ delivery times', () => {
    expect(advise({ days_until_stockout: 3 }).urgency).toBe('critical') // only B (2 days) arrives
    expect(advise({ days_until_stockout: 6 }).urgency).toBe('soon') // B and A arrive, C does not
    expect(advise({ days_until_stockout: 30 }).urgency).toBe('healthy')
  })

  it('warns when the cheapest supplier cannot deliver before the stockout', () => {
    const a = advise({ days_until_stockout: 3 })
    expect(a.warnings).toContain('Supplier C has the lowest price (RM1,700.00) but delivers in 8 days — after the projected stockout in 3 days. Choosing it risks running out of stock.')
    expect(a.final_recommendation).toBe(
      'We recommend Supplier B for this purchase because it offers faster delivery and stronger delivery reliability and can deliver before the projected stockout. Supplier C offers the lowest price but may not be suitable for urgent restocking.',
    )
    expect(a.suggestions.find((s) => s.supplier_id === 'SUP003')!.choose_when).toMatch(/^Only if you can cover demand until it arrives in 8 days/)
  })

  it('prioritises a supplier that can deliver in time over the top-ranked one when stock is short', () => {
    const a = advise({ priority: 'cheapest', days_until_stockout: 3 })
    expect(a.suggestions[0].rank).toBe(3) // B ranks third under Cheapest…
    expect(a.primary_supplier_id).toBe('SUP002') // …but is the only one that arrives in time
    expect(a.warnings[0]).toBe('Supplier C ranks first under Cheapest but delivers in 8 days, after the projected stockout — so the advisor recommends Supplier B, which can deliver in time.')
    expect(a.warnings).toHaveLength(1) // no duplicate warning about the same supplier
  })

  it('recommends the lower-cost supplier when stock is healthy and cost is the priority', () => {
    const a = advise({ priority: 'cheapest', days_until_stockout: 30 })
    expect(a.primary_supplier_id).toBe('SUP003')
    expect(a.urgency_note).toMatch(/^Stock is healthy — about 30 days of cover/)
  })

  it('points out the saving from a cheaper supplier when stock is healthy', () => {
    expect(advise({ days_until_stockout: 30 }).urgency_note).toContain('Choosing Supplier C would save RM250.00.')
  })

  it('falls back to the fastest supplier when nobody can deliver in time', () => {
    const a = advise({ days_until_stockout: 1 })
    expect(a.urgency).toBe('critical')
    expect(a.primary_supplier_id).toBe('SUP002')
    expect(a.warnings.join(' ')).toContain('No supplier can deliver within the 1 day before the projected stockout')
  })
})
