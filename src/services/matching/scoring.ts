// Supplier compatibility scoring and ranking. Pure functions — no React, no store.
//
// Normalisation (each criterion → 0–100, relative to the best eligible supplier):
//   Price         100 − 3 points per 1% above the lowest total price
//   Delivery      100 × (fastest days + 1) ÷ (days + 1)
//   Distance      100 × (nearest km + 10) ÷ (km + 10)
//   Reliability   on-time-in-full % as reported (already 0–100)
//   Suitability   as supplied (already 0–100)
//
// Compatibility = Σ (criterion score × weight) ÷ Σ weight, over the criteria that have data.
// A missing criterion is never guessed: it is left out, the remaining weights are rescaled, and
// the supplier is flagged "unverified" with its data coverage. This is a weighted decision-support
// score, not a statistical probability.

import type {
  CompareSuppliersRequest,
  CompareSuppliersResponse,
  Criterion,
  CriterionDetail,
  CriterionWeights,
  EligibilityStatus,
  MatchingPriority,
  SupplierInput,
  SupplierRanking,
} from './types'
import { CRITERIA, PRIORITY_RANK_KEY, PRIORITY_WEIGHTS, rankingRules } from './config'
import { explainSupplier, recommendationSummary } from './explain'
import { buildProcurementAdvice } from './advisor'
import { clamp, round } from '@/utils/format'

export const PRICE_PENALTY_PER_PCT = 3
export const DELIVERY_SMOOTHING_DAYS = 1
export const DISTANCE_SMOOTHING_KM = 10

export class MatchingValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MatchingValidationError'
  }
}

const known = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v)

const rawValue: Record<Criterion, (s: SupplierInput) => number | null> = {
  price: (s) => s.total_price,
  delivery: (s) => s.delivery_days,
  reliability: (s) => s.reliability,
  distance: (s) => s.distance_km,
  product_suitability: (s) => s.product_suitability,
}

export function validateRequest(req: CompareSuppliersRequest) {
  if (!known(req.required_quantity) || req.required_quantity <= 0) throw new MatchingValidationError('required_quantity must be a positive number.')
  if (!req.unit?.trim()) throw new MatchingValidationError('unit is required.')
  if (req.priority && !(req.priority in PRIORITY_WEIGHTS)) throw new MatchingValidationError(`Unknown priority "${req.priority}".`)
  if (!Array.isArray(req.suppliers)) throw new MatchingValidationError('suppliers must be a list.')
  const ids = new Set<string>()
  for (const s of req.suppliers) {
    if (!s.id?.trim()) throw new MatchingValidationError('Every supplier needs an id.')
    if (ids.has(s.id)) throw new MatchingValidationError(`Duplicate supplier id "${s.id}".`)
    ids.add(s.id)
  }
}

/** Constraint checks: problems that mean the supplier cannot fulfil the order. */
export function eligibilityIssues(s: SupplierInput, quantity: number, unit: string): string[] {
  const issues: string[] = []
  if (s.total_price !== null && (!Number.isFinite(s.total_price) || s.total_price <= 0)) issues.push('Total price is zero, negative or invalid.')
  if (s.delivery_days !== null && (!Number.isFinite(s.delivery_days) || s.delivery_days < 0)) issues.push('Delivery time is negative or invalid.')
  if (s.distance_km !== null && (!Number.isFinite(s.distance_km) || s.distance_km < 0)) issues.push('Distance is negative or invalid.')
  if (s.reliability !== null && (!Number.isFinite(s.reliability) || s.reliability < 0 || s.reliability > 100)) issues.push('Reliability must be between 0 and 100.')
  if (s.product_suitability !== null && (!Number.isFinite(s.product_suitability) || s.product_suitability < 0 || s.product_suitability > 100))
    issues.push('Product suitability must be between 0 and 100.')
  else if (s.product_suitability === 0) issues.push('Product does not meet the requirements.')
  if (known(s.available_quantity) && s.available_quantity < quantity) issues.push(`Only ${s.available_quantity} ${unit} available; ${quantity} ${unit} required.`)
  if (known(s.minimum_order_quantity) && s.minimum_order_quantity > quantity) issues.push(`Minimum order is ${s.minimum_order_quantity} ${unit}; ${quantity} ${unit} required.`)
  if (s.delivers_to_business === false) issues.push('Does not deliver to the business location.')
  return issues
}

interface Reference {
  price: number | null
  delivery: number | null
  distance: number | null
}

function minOf(list: SupplierInput[], f: (s: SupplierInput) => number | null): number | null {
  const v = list.map(f).filter(known)
  return v.length ? Math.min(...v) : null
}

/** Normalises one criterion to 0–100; null when the supplier has no data for it. */
export function normalise(c: Criterion, s: SupplierInput, ref: Reference): number | null {
  const v = rawValue[c](s)
  if (!known(v)) return null
  switch (c) {
    case 'price':
      return ref.price === null ? null : clamp(100 - ((v - ref.price) / ref.price) * 100 * PRICE_PENALTY_PER_PCT, 0, 100)
    case 'delivery':
      return ref.delivery === null ? null : clamp((100 * (ref.delivery + DELIVERY_SMOOTHING_DAYS)) / (v + DELIVERY_SMOOTHING_DAYS), 0, 100)
    case 'distance':
      return ref.distance === null ? null : clamp((100 * (ref.distance + DISTANCE_SMOOTHING_KM)) / (v + DISTANCE_SMOOTHING_KM), 0, 100)
    default:
      return clamp(v, 0, 100)
  }
}

function scoreSupplier(s: SupplierInput, weights: CriterionWeights, ref: Reference) {
  const scores = Object.fromEntries(CRITERIA.map((c) => [c, normalise(c, s, ref)])) as Record<Criterion, number | null>
  const available = CRITERIA.filter((c) => scores[c] !== null && weights[c] > 0)
  const availableWeight = available.reduce((sum, c) => sum + weights[c], 0)
  const totalWeight = CRITERIA.reduce((sum, c) => sum + weights[c], 0)
  const details = Object.fromEntries(
    CRITERIA.map((c) => {
      const applied = scores[c] !== null && availableWeight > 0 ? (weights[c] / availableWeight) * 100 : 0
      const d: CriterionDetail = { score: scores[c] === null ? null : round(scores[c]!, 1), weight: weights[c], applied_weight: round(applied, 1), points: round(((scores[c] ?? 0) * applied) / 100, 1) }
      return [c, d]
    }),
  ) as Record<Criterion, CriterionDetail>
  const compatibility = availableWeight > 0 ? round(available.reduce((sum, c) => sum + (scores[c]! * weights[c]) / availableWeight, 0), 1) : 0
  return {
    details,
    score_breakdown: Object.fromEntries(CRITERIA.map((c) => [c, details[c].score])) as Record<Criterion, number | null>,
    missing: CRITERIA.filter((c) => scores[c] === null),
    compatibility,
    data_coverage: totalWeight > 0 ? round(availableWeight / totalWeight, 2) : 0,
  }
}

/** Deterministic order: priority measure (if any), score, coverage, price, delivery, name, id. */
function compareRanked(priority: MatchingPriority) {
  const key = PRIORITY_RANK_KEY[priority]
  const asc = (a: number | null | undefined, b: number | null | undefined) => (known(a) ? a : Infinity) - (known(b) ? b : Infinity)
  return (a: SupplierRanking, b: SupplierRanking) =>
    (key ? asc(key(a.supplier), key(b.supplier)) : 0) ||
    (b.compatibility_score ?? 0) - (a.compatibility_score ?? 0) ||
    b.data_coverage - a.data_coverage ||
    asc(a.supplier.total_price, b.supplier.total_price) ||
    asc(a.supplier.delivery_days, b.supplier.delivery_days) ||
    a.supplier_name.localeCompare(b.supplier_name) ||
    a.supplier_id.localeCompare(b.supplier_id)
}

/** Scores and ranks suppliers for one priority (no advisor output). */
export function rankSuppliers(req: CompareSuppliersRequest): CompareSuppliersResponse {
  validateRequest(req)
  const priority = req.priority ?? 'best_overall'
  const weights = PRIORITY_WEIGHTS[priority]

  const checked = req.suppliers.map((s) => ({ s, issues: eligibilityIssues(s, req.required_quantity, req.unit) }))
  const eligible = checked.filter((x) => x.issues.length === 0).map((x) => x.s)
  // Reference points come from eligible suppliers only, so an excluded supplier can't distort the scale
  const ref: Reference = { price: minOf(eligible, rawValue.price), delivery: minOf(eligible, rawValue.delivery), distance: minOf(eligible, rawValue.distance) }

  const ranked: SupplierRanking[] = eligible.map((s) => {
    const sc = scoreSupplier(s, weights, ref)
    const status: EligibilityStatus = sc.missing.length ? 'unverified' : 'eligible'
    return { supplier_id: s.id, supplier_name: s.name, rank: null, eligibility: status, issues: [], ...sc, compatibility_score: sc.compatibility, explanation: '', supplier: s }
  })
  ranked.sort(compareRanked(priority))
  ranked.forEach((r, i) => (r.rank = i + 1))

  const excluded: SupplierRanking[] = checked
    .filter((x) => x.issues.length > 0)
    .map(({ s, issues }) => {
      const sc = scoreSupplier(s, weights, ref)
      return { supplier_id: s.id, supplier_name: s.name, rank: null, eligibility: 'ineligible' as const, issues, ...sc, compatibility_score: null, explanation: '', supplier: s }
    })
    .sort((a, b) => a.supplier_name.localeCompare(b.supplier_name))

  const response: CompareSuppliersResponse = {
    product: req.product,
    required_quantity: req.required_quantity,
    unit: req.unit,
    priority,
    weights,
    ranking_rule: rankingRules[priority],
    recommended_supplier_id: ranked[0]?.supplier_id ?? null,
    recommendation: null,
    rankings: [...ranked, ...excluded],
    uses_mock_data: req.suppliers.some((s) => s.is_mock),
    days_until_stockout: req.days_until_stockout ?? null,
    advice: null,
  }
  for (const r of response.rankings) r.explanation = explainSupplier(response, r, req.days_until_stockout ?? null)
  response.recommendation = ranked[0] ? recommendationSummary(response, ranked[0], req.days_until_stockout ?? null) : null
  return response
}

/** Core of POST /compare-suppliers: ranking for the chosen priority plus the AI Procurement Advisor. */
export function compareSuppliers(req: CompareSuppliersRequest): CompareSuppliersResponse {
  const response = rankSuppliers(req)
  // "Best Overall" labels always use the balanced weights, whatever priority is selected
  const balanced = response.priority === 'best_overall' ? response : rankSuppliers({ ...req, priority: 'best_overall' })
  response.advice = buildProcurementAdvice(response, balanced)
  return response
}
