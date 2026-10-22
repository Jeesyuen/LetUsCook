import { useMemo } from 'react'
import { useAppStore, OPEN_PO_STATUSES } from '@/store/useAppStore'
import { computeForecast, type Forecast } from '@/services/forecasting'
import { buildQuotations, scoreQuotations, weightsFor, type ScoredQuotation } from '@/services/scoring'
import { explainRecommendation, type Explanation } from '@/services/explanations'
import { supplierProducts, suppliers as seededSuppliers } from '@/data/mockData'
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
    return products.map((product) => {
      const minimumOrderQty = supplierProducts.find((sp) => sp.productId === product.id && sp.supplierId === product.reorder.preferredSupplierId)?.moq ?? 0
      return { product, forecast: computeForecast(product, coverageDays, incoming(product.id), undefined, minimumOrderQty) }
    })
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

export function useOpenPOFor(productId: string | undefined): PurchaseOrder | undefined {
  const pos = useAppStore((s) => s.purchaseOrders)
  return useMemo(() => pos.find((p) => p.productId === productId && OPEN_PO_STATUSES.includes(p.status)), [pos, productId])
}

export interface Recommendation extends ProductWithForecast {
  ranked: ScoredQuotation[]
  best?: ScoredQuotation
  explanation: Explanation
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
          return {
            product,
            forecast,
            ranked,
            best: ranked[0],
            explanation: explainRecommendation(ranked, 'balanced', product, forecast),
            pendingApproval: approvals.find((a) => a.productId === product.id && a.status === 'Pending' && a.kind === 'purchase'),
            openPO: pos.find((p) => p.productId === product.id && OPEN_PO_STATUSES.includes(p.status)),
          }
        }),
    [ranking, dismissed, approvals, pos, weights],
  )
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
