// Transparent supplier compatibility scoring.
//
// Each criterion is normalised to 0–100, then combined with weights that sum to 100.
//   Price         100 for the lowest landed cost (quote + delivery); −3 points per 1% above it
//   Delivery      100 for the fastest lead time; −10 points per extra day
//   Reliability   historical on-time-in-full % as-is
//   Quality       quality rating out of 5 × 20
//   Order fit     100 if the quantity meets the MOQ, otherwise quantity / MOQ × 100
//
// The result is a decision-support score, not a probability.

import { supplierProducts, suppliers } from '@/data/mockData'
import { findSupplier } from '@/data/supplierRegistry'
import type { Quotation, ScoringPriority, ScoringWeights, Supplier } from '@/types'
import { addDays, startOfToday } from '@/utils/date'
import { clamp, round } from '@/utils/format'

export const PRICE_PENALTY_PER_PCT = 3
export const DELIVERY_PENALTY_PER_DAY = 10

export const priorityLabels: Record<ScoringPriority, string> = {
  balanced: 'Balanced',
  cost: 'Lowest Cost',
  delivery: 'Fastest Delivery',
  reliability: 'Highest Reliability',
}

export const criterionLabels: Record<keyof ScoringWeights, string> = {
  price: 'Price',
  delivery: 'Delivery',
  reliability: 'Reliability',
  quality: 'Quality',
  compatibility: 'Order fit',
}

export function weightsFor(priority: ScoringPriority, balanced: ScoringWeights): ScoringWeights {
  switch (priority) {
    case 'cost':
      return { price: 60, delivery: 15, reliability: 15, quality: 5, compatibility: 5 }
    case 'delivery':
      return { price: 15, delivery: 60, reliability: 15, quality: 5, compatibility: 5 }
    case 'reliability':
      return { price: 15, delivery: 15, reliability: 55, quality: 10, compatibility: 5 }
    default:
      return balanced
  }
}

export const getSupplier = (id: string): Supplier => findSupplier(id) ?? suppliers[0]

const QUOTE_EXPIRY: Record<string, number> = { 's-beancraft': 7, 's-aroma': 5, 's-nusantara': 10, 's-freshmart': 3, 's-klang': 14, 's-prime': 7 }

/** Builds the (mock) quotations each supplier returned for a product and quantity. */
export function buildQuotations(productId: string, quantity: number, excludeSupplierIds: string[] = []): Quotation[] {
  const today = startOfToday()
  return supplierProducts
    .filter((sp) => sp.productId === productId && !excludeSupplierIds.includes(sp.supplierId))
    .map((sp) => {
      const supplier = getSupplier(sp.supplierId)
      const subtotal = round(sp.unitPrice * quantity, 2)
      return {
        id: `q-${sp.supplierId}-${productId}-${quantity}`,
        supplierId: sp.supplierId,
        productId,
        quantity,
        unitPrice: sp.unitPrice,
        subtotal,
        deliveryFee: sp.deliveryFee,
        total: round(subtotal + sp.deliveryFee, 2),
        leadTimeDays: sp.leadTimeDays,
        moq: sp.moq,
        paymentTerms: supplier.paymentTerms,
        issuedAt: addDays(today, -1).toISOString(),
        expiresAt: addDays(today, QUOTE_EXPIRY[sp.supplierId] ?? 7).toISOString(),
      }
    })
}

export interface CriterionScores {
  price: number
  delivery: number
  reliability: number
  quality: number
  compatibility: number
}

export interface ScoredQuotation {
  quotation: Quotation
  supplier: Supplier
  criteria: CriterionScores
  /** weighted contribution of each criterion to the final score */
  contributions: CriterionScores
  score: number
  rank: number
}

export function scoreQuotations(quotes: Quotation[], weights: ScoringWeights): ScoredQuotation[] {
  if (quotes.length === 0) return []
  const minCost = Math.min(...quotes.map((q) => q.total))
  const minDays = Math.min(...quotes.map((q) => q.leadTimeDays))
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1

  const scored = quotes.map((q) => {
    const supplier = getSupplier(q.supplierId)
    const pctAbove = ((q.total - minCost) / minCost) * 100
    const criteria: CriterionScores = {
      price: round(clamp(100 - pctAbove * PRICE_PENALTY_PER_PCT, 0, 100), 1),
      delivery: round(clamp(100 - (q.leadTimeDays - minDays) * DELIVERY_PENALTY_PER_DAY, 0, 100), 1),
      reliability: supplier.reliability,
      quality: round(supplier.qualityRating * 20, 1),
      compatibility: round(q.quantity >= q.moq ? 100 : (q.quantity / q.moq) * 100, 1),
    }
    const contributions = Object.fromEntries(
      (Object.keys(criteria) as (keyof CriterionScores)[]).map((k) => [k, round((criteria[k] * weights[k]) / totalWeight, 1)]),
    ) as unknown as CriterionScores
    // Whole percentages keep the score consistent everywhere it is displayed
    const score = Math.round((Object.keys(criteria) as (keyof CriterionScores)[]).reduce((sum, k) => sum + (criteria[k] * weights[k]) / totalWeight, 0))
    return { quotation: q, supplier, criteria, contributions, score, rank: 0 }
  })

  scored.sort((a, b) => b.score - a.score || a.quotation.total - b.quotation.total)
  scored.forEach((s, i) => (s.rank = i + 1))
  return scored
}

/** Convenience: score a supplier's quote for a product in the context of all competing quotes. */
export function scoreFor(productId: string, quantity: number, supplierId: string, weights: ScoringWeights): number {
  const ranked = scoreQuotations(buildQuotations(productId, quantity), weights)
  return ranked.find((r) => r.supplier.id === supplierId)?.score ?? 0
}
