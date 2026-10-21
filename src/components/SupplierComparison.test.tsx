import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { compareSuppliers, type CompareSuppliersRequest, type MatchingPriority } from '@/services/matching'
import { CriteriaBreakdown, IneligibleSuppliers, ProcurementAdvisorPanel, RecommendedComparison, SupplierRankingTable } from './SupplierComparison'

const request: CompareSuppliersRequest = {
  product: 'Arabica Coffee Beans',
  required_quantity: 100,
  unit: 'kg',
  suppliers: [
    { id: 'SUP001', name: 'Supplier A', total_price: 1800, distance_km: 12, delivery_days: 5, reliability: 90, product_suitability: 100 },
    { id: 'SUP002', name: 'Supplier B', total_price: 1950, distance_km: 4, delivery_days: 2, reliability: 95, product_suitability: 100 },
    { id: 'SUP003', name: 'Supplier C', total_price: 1700, distance_km: 25, delivery_days: 8, reliability: null, product_suitability: 100 },
    { id: 'SUP004', name: 'Supplier D', total_price: 1500, distance_km: 5, delivery_days: 1, reliability: 99, product_suitability: 0 },
  ],
}
const result = (priority: MatchingPriority = 'best_overall', days_until_stockout: number | null = null) => compareSuppliers({ ...request, priority, days_until_stockout })
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')
const panel = (res: ReturnType<typeof result>, selectedId: string | null = null) =>
  text(renderToStaticMarkup(<ProcurementAdvisorPanel result={res} selectedId={selectedId} onSelect={() => {}} onCompare={() => {}} />))

describe('10. frontend shows the calculated results', () => {
  it('lists ranked suppliers in order with their calculated compatibility', () => {
    const res = result()
    const html = text(renderToStaticMarkup(<SupplierRankingTable result={res} selectedId={null} onSelect={() => {}} />))
    const ranked = res.rankings.filter((x) => x.rank !== null)
    for (const r of ranked) expect(html).toContain(`${Math.round(r.compatibility_score!)}%`)
    const order = ranked.map((r) => html.indexOf(r.supplier_name))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(html).not.toContain('Supplier D') // ineligible: not in the ranking table
    expect(html).toContain('Not available') // missing reliability is shown, not invented
    expect(html).toContain('Best Budget Choice')
  })

  it('shows the AI Procurement Advisor with the primary pick, two alternatives and their scores', () => {
    const res = result()
    const html = panel(res)
    expect(html).toContain('AI Procurement Advisor')
    expect(html).toContain(res.advice!.final_recommendation)
    expect(res.advice!.suggestions).toHaveLength(3)
    for (const s of res.advice!.suggestions) {
      expect(html).toContain(s.supplier_name)
      expect(html).toContain(s.why)
      expect(html).toContain(s.choose_when)
    }
    expect(html.match(/Select Supplier/g)).toHaveLength(3)
    expect(html).toContain('Recommended · Rank #1')
    expect(html).toContain('Alternative · Rank #2')
  })

  it('updates the advice when the priority changes', () => {
    expect(panel(result('best_overall'))).toContain('We recommend Supplier B')
    expect(panel(result('cheapest'))).toContain('We recommend Supplier C')
  })

  it('shows urgency and the cheapest-supplier warning from the forecast', () => {
    const html = panel(result('cheapest', 3))
    expect(html).toContain('Urgent purchase')
    expect(html).toContain('We recommend Supplier B')
    expect(html).toContain('After stockout')
  })

  it('marks the selected supplier', () => {
    const html = panel(result(), 'SUP001')
    expect(html.match(/Selected/g)).toHaveLength(1)
    expect(html.match(/Select Supplier/g)).toHaveLength(2)
  })

  it('compares the recommended suppliers side by side', () => {
    const html = text(renderToStaticMarkup(<RecommendedComparison result={result()} />))
    for (const label of ['Compatibility', 'Total price', 'Delivery', 'Distance', 'Reliability', 'When to choose']) expect(html).toContain(label)
    expect(html).toContain('RM1,950.00')
  })

  it('shows the five criterion scores behind the compatibility score', () => {
    const b = result().rankings.find((r) => r.supplier_id === 'SUP002')!
    const html = text(renderToStaticMarkup(<CriteriaBreakdown ranking={b} />))
    for (const label of ['Price', 'Delivery speed', 'Reliability', 'Distance', 'Product suitability']) expect(html).toContain(label)
    expect(html).toContain(`${b.details.price.score} /100`)
    expect(html).toContain(`${b.compatibility_score}%`)
  })

  it('lists ineligible suppliers with the reason', () => {
    const html = text(renderToStaticMarkup(<IneligibleSuppliers result={result()} />))
    expect(html).toContain('Supplier D')
    expect(html).toContain('Product does not meet the requirements.')
  })
})
