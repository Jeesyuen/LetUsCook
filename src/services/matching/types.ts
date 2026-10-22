// AI Supplier Matching & Recommendation Engine: input/output contract.
//
// Input is structured supplier data. Field names follow the agreed JSON contract (snake_case).
// Any value that could not be verified must be null —
// the engine never fills in a guess.

export type MatchingPriority = 'best_overall' | 'cheapest' | 'nearest' | 'fastest'

export type Criterion = 'price' | 'delivery' | 'reliability' | 'distance' | 'product_suitability'

export type CriterionWeights = Record<Criterion, number>

export interface SupplierInput {
  /** Preserved end-to-end so downstream procurement can identify the supplier */
  id: string
  name: string
  /** Estimated total purchasing cost in RM for the required quantity (product + delivery + mandatory fees) */
  total_price: number | null
  distance_km: number | null
  delivery_days: number | null
  /** Historical on-time-in-full %, 0–100. null = no history */
  reliability: number | null
  /** How well the listing matches the required product, 0–100. 0 = cannot supply this product */
  product_suitability: number | null

  // Optional context
  unit_price?: number | null
  location?: string | null
  /** Stock available, in the request unit. null/omitted = not confirmed */
  available_quantity?: number | null
  /** Minimum order, in the request unit */
  minimum_order_quantity?: number | null
  /** false = supplier does not deliver to the business location */
  delivers_to_business?: boolean | null
  source?: string
  /** true when the record is mock / sample data rather than live data */
  is_mock?: boolean
  last_updated?: string
}

export interface CompareSuppliersRequest {
  product: string
  required_quantity: number
  unit: string
  priority?: MatchingPriority
  /** Projected stockout in days, from forecasting — used only to word explanations */
  days_until_stockout?: number | null
  suppliers: SupplierInput[]
}

/** eligible = all data present; unverified = can supply but some data is missing; ineligible = cannot fulfil */
export type EligibilityStatus = 'eligible' | 'unverified' | 'ineligible'

export interface CriterionDetail {
  /** Normalised 0–100 score, null when the data is missing */
  score: number | null
  /** Configured weight for the priority (%) */
  weight: number
  /** Weight actually applied after redistributing missing criteria (%) */
  applied_weight: number
  /** Points contributed to the compatibility score */
  points: number
}

export interface SupplierRanking {
  supplier_id: string
  supplier_name: string
  /** 1-based; null for ineligible suppliers */
  rank: number | null
  eligibility: EligibilityStatus
  /** Why a supplier is ineligible */
  issues: string[]
  /** Criteria that could not be scored */
  missing: Criterion[]
  /** 0–100 weighted decision-support score (not a probability); null for ineligible suppliers */
  compatibility_score: number | null
  /** Share of the configured weight backed by data, 0–1 */
  data_coverage: number
  score_breakdown: Record<Criterion, number | null>
  details: Record<Criterion, CriterionDetail>
  explanation: string
  supplier: SupplierInput
}

export interface RecommendationSummary {
  supplier_id: string
  headline: string
  summary: string
  advantages: string[]
  tradeoffs: string[]
  caveats: string[]
  priority_note: string
}

export interface CompareSuppliersResponse {
  product: string
  required_quantity: number
  unit: string
  priority: MatchingPriority
  weights: CriterionWeights
  ranking_rule: string
  recommended_supplier_id: string | null
  recommendation: RecommendationSummary | null
  /** Every supplier: ranked ones first (by rank), then ineligible ones */
  rankings: SupplierRanking[]
  uses_mock_data: boolean
  /** Echo of the forecast input, when provided */
  days_until_stockout: number | null
  /** AI Procurement Advisor output: top-3 suggestions, categories and urgency-aware advice */
  advice: ProcurementAdvice | null
}

export type RecommendationCategory = 'best_overall' | 'best_budget' | 'fastest_delivery' | 'nearest' | 'most_reliable'

/** How urgent the purchase is, judged from the forecast against the suppliers' delivery times */
export type PurchaseUrgency =
  | 'critical' // only the fastest supplier (or none) can deliver before the stockout
  | 'soon' // some suppliers would deliver after the stockout
  | 'healthy' // every supplier can deliver before the stockout
  | 'unknown' // no forecast available

export interface SupplierSuggestion {
  supplier_id: string
  supplier_name: string
  rank: number
  compatibility_score: number
  /** Balanced (Best Overall) compatibility, used for the Best Overall category */
  balanced_score: number
  categories: RecommendationCategory[]
  /** Why this supplier is suggested */
  why: string
  advantages: string[]
  drawbacks: string[]
  /** When the business should pick this supplier */
  choose_when: string
  /** null when the forecast or delivery time is unknown */
  arrives_before_stockout: boolean | null
}

export interface ProcurementAdvice {
  primary_supplier_id: string
  alternative_supplier_ids: string[]
  urgency: PurchaseUrgency
  urgency_note: string
  warnings: string[]
  /** Concise final recommendation, e.g. "We recommend B… A is a strong alternative if…" */
  final_recommendation: string
  /** Primary first, then up to two alternatives */
  suggestions: SupplierSuggestion[]
  /** Category labels for every ranked supplier (a supplier may hold several, or none) */
  categories: Record<string, RecommendationCategory[]>
}
