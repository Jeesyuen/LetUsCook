// Criteria, labels, weights and ranking rules for supplier matching.

import type { Criterion, CriterionWeights, MatchingPriority, SupplierInput } from './types'

export const CRITERIA: Criterion[] = ['price', 'delivery', 'reliability', 'distance', 'product_suitability']

export const criterionLabels: Record<Criterion, string> = {
  price: 'Price',
  delivery: 'Delivery speed',
  reliability: 'Reliability',
  distance: 'Distance',
  product_suitability: 'Product suitability',
}

export const priorityLabels: Record<MatchingPriority, string> = {
  best_overall: 'Best Overall',
  cheapest: 'Cheapest',
  nearest: 'Nearest',
  fastest: 'Fastest',
}

/** Weight configuration per priority (each sums to 100). */
export const PRIORITY_WEIGHTS: Record<MatchingPriority, CriterionWeights> = {
  best_overall: { price: 30, delivery: 25, reliability: 20, distance: 15, product_suitability: 10 },
  cheapest: { price: 60, delivery: 10, reliability: 15, distance: 5, product_suitability: 10 },
  nearest: { price: 10, delivery: 10, reliability: 10, distance: 60, product_suitability: 10 },
  fastest: { price: 10, delivery: 60, reliability: 15, distance: 5, product_suitability: 10 },
}

/**
 * Ranking rule per priority. Best Overall ranks by compatibility score. The single-goal modes rank
 * by their own measure first (so Cheapest always puts the lowest-cost eligible supplier first),
 * then by compatibility score.
 */
export const PRIORITY_RANK_KEY: Record<MatchingPriority, ((s: SupplierInput) => number | null) | null> = {
  best_overall: null,
  cheapest: (s) => s.total_price,
  nearest: (s) => s.distance_km,
  fastest: (s) => s.delivery_days,
}

export const rankingRules: Record<MatchingPriority, string> = {
  best_overall: 'Ranked by compatibility score (balanced weights).',
  cheapest: 'Ranked by lowest total price, then compatibility score.',
  nearest: 'Ranked by shortest distance, then compatibility score.',
  fastest: 'Ranked by shortest delivery time, then compatibility score.',
}
