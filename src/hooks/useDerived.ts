import { useMemo } from 'react'
import { useAppStore, OPEN_PO_STATUSES } from '@/store/useAppStore'
import { computeForecast, type Forecast } from '@/services/forecasting'
import { buildQuotations, scoreQuotations, weightsFor, type ScoredQuotation } from '@/services/scoring'
import { explainRecommendation, type Explanation } from '@/services/explanations'
import { compareSuppliers, type RecommendationCategory, type SupplierSuggestion } from '@/services/matching'
import { mockSuppliersFor } from '@/data/sampleSupplierData'
import { suppliers as seededSuppliers } from '@/data/mockData'
import { preferredSupplierMoq } from '@/data/supplierRegistry'
import type { ApprovalRequest, Product, PurchaseOrder } from '@/types'

export interface ProductWithForecast {
  product: Product
  forecast: Forecast
}

export function useForecasts(): ProductWithForecast[] {
  const products = useAppStore((s) => s.products)
  const pos = useAppStore((s) => s.purchaseOrders)
  const coverageDays = useAppStore((s) => s.settings.coverageDays)
  return useMemo(() => {
    const incoming = (id: string) => pos.filter((p) => p.productId === id && OPEN_PO_STATUSES.includes(p.status))
    return products.map((product) => ({
      product,
      forecast: computeForecast(product, coverageDays, incoming(product.id), undefined, preferredSupplierMoq(product)),
    }))
  }, [products, pos, coverageDays])
}

export function useProductForecast(productId: string | undefined): ProductWithForecast | undefined {
  const all = useForecasts()
  return useMemo(() => all.find((x) => x.product.id === productId), [all, productId])
}

/** Products sorted most-at-risk first (smallest margin of cover beyond lead time). */
export function useRiskRanking(): ProductWithForecast[] {
  const all = useForecasts()
  return useMemo(() => [...all].sort((a, b) => a.forecast.coverageMargin - b.forecast.coverageMargin), [all])
}

export function useOpenPOsFor(productId: string | undefined): PurchaseOrder[] {
  const pos = useAppStore((s) => s.purchaseOrders)
  return useMemo(() => pos.filter((p) => p.productId === productId && OPEN_PO_STATUSES.includes(p.status)), [pos, productId])
}

export interface Recommendation extends ProductWithForecast {
  ranked: ScoredQuotation[]
  best?: ScoredQuotation
  explanation: Explanation
  /** AI Procurement Advisor alternatives, best first */
  alternatives: { supplierId: string; name: string; score: number; categories: RecommendationCategory[] }[]
  /** Category labels earned by the card's supplier */
  categories: RecommendationCategory[]
  pendingApproval?: ApprovalRequest
  openPO?: PurchaseOrder
}

export function useRecommendations(): Recommendation[] {
  const ranking = useRiskRanking()
  const dismissed = useAppStore((s) => s.dismissedRecs)
  const approvals = useAppStore((s) => s.approvals)
  const pos = useAppStore((s) => s.purchaseOrders)
  const weights = useAppStore((s) => s.settings.balancedWeights)
  return useMemo(
    () =>
      ranking
        .filter(({ product, forecast }) => forecast.needsReorder && !dismissed.includes(product.id))
        .map(({ product, forecast }) => {
          const ranked = scoreQuotations(buildQuotations(product.id, forecast.suggestedQty), weights)
          const matched = matchRecommendation(product, forecast, ranked)
          return {
            product,
            forecast,
            ranked,
            best: matched?.best ?? ranked[0],
            explanation: matched?.explanation ?? explainRecommendation(ranked, 'balanced', product, forecast),
            alternatives: matched?.alternatives ?? [],
            categories: matched?.categories ?? [],
            pendingApproval: approvals.find((a) => a.productId === product.id && a.status === 'Pending' && a.kind === 'purchase'),
            openPO: pos.find((p) => p.productId === product.id && OPEN_PO_STATUSES.includes(p.status)),
          }
        }),
    [ranking, dismissed, approvals, pos, weights],
  )
}

const toCardExplanation = (s: SupplierSuggestion, summary: string): Explanation => ({
  headline: s.supplier_name,
  summary,
  points: [...s.advantages.map((text) => ({ tone: 'positive' as const, text })), ...s.drawbacks.map((text) => ({ tone: 'tradeoff' as const, text }))],
})

/**
 * Picks the card's supplier with the AI Procurement Advisor (Best Overall + stock forecast)
 * so it agrees with the Supplier Comparison page. The card keeps its quotation shape for the approval
 * workflow, so the pick is the advisor's first suggestion that has a quotation on file.
 * Uses the sample supplier data synchronously; switch to the live source once it is available.
 */
function matchRecommendation(product: Product, forecast: Forecast, ranked: ScoredQuotation[]) {
  if (!(forecast.suggestedQty > 0)) return null
  const result = compareSuppliers({
    product: product.name,
    required_quantity: forecast.suggestedQty,
    unit: product.unit,
    priority: 'best_overall',
    days_until_stockout: Number.isFinite(forecast.daysRemaining) ? forecast.daysRemaining : null,
    suppliers: mockSuppliersFor(product.id, forecast.suggestedQty),
  })
  const advice = result.advice
  if (!advice) return null
  const quoted = (id: string) => ranked.some((q) => q.supplier.id === id)
  const pick = advice.suggestions.find((s) => quoted(s.supplier_id))
  const legacy = pick && ranked.find((q) => q.supplier.id === pick.supplier_id)
  if (!pick || !legacy) return null
  const isPrimary = pick.supplier_id === advice.primary_supplier_id
  return {
    best: { ...legacy, score: Math.round(pick.compatibility_score), rank: pick.rank },
    explanation: toCardExplanation(pick, isPrimary ? advice.final_recommendation : pick.why),
    categories: pick.categories,
    alternatives: advice.suggestions
      .filter((s) => s.supplier_id !== pick.supplier_id)
      .map((s) => ({ supplierId: s.supplier_id, name: s.supplier_name, score: Math.round(s.compatibility_score), categories: s.categories })),
  }
}

export function useScoredQuotes(productId: string, quantity: number, priority: Parameters<typeof weightsFor>[0], exclude: string[] = []) {
  const balanced = useAppStore((s) => s.settings.balancedWeights)
  const excludeKey = exclude.join(',')
  return useMemo(() => {
    const weights = weightsFor(priority, balanced)
    return { weights, ranked: scoreQuotations(buildQuotations(productId, quantity, excludeKey ? excludeKey.split(',') : []), weights) }
  }, [productId, quantity, priority, balanced, excludeKey])
}

export function useSuppliers() {
  const custom = useAppStore((s) => s.customSuppliers)
  return useMemo(() => [...seededSuppliers, ...custom], [custom])
}
