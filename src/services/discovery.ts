// Track 03A: AI Supplier Discovery, Catalogue Ingestion & Landed Cost Engine
// Developed by Lim Jie Xin
//
// Responsibilities:
// 1. Supplier discovery based on product name, category, or order quantity.
// 2. Catalogue retrieval with stock, MOQ, and location proximity.
// 3. Order fulfillment filtering (MOQ validation and capacity check).
// 4. Landed cost calculation (unit price, freight/shipping, per-unit landed cost, variance vs baseline).
// 5. Multi-vector comparison presets (Cheapest, Nearest, Fastest).

import { allSupplierProducts, allSuppliers, findSupplier } from '@/data/supplierRegistry'
import type {
  ComparisonHighlights,
  DiscoveredSupplierQuote,
  DiscoveryQuery,
  LandedCostBreakdown,
  Product,
  Quotation,
  Supplier,
  SupplierProduct,
} from '@/types'
import { addDays, startOfToday } from '@/utils/date'
import { round } from '@/utils/format'

/** Approximate road distances in km from Bangsar, Kuala Lumpur */
export const CITY_DISTANCES_FROM_BANGSAR: Record<string, number> = {
  'Bangsar': 0,
  'Kuala Lumpur': 6,
  'Petaling Jaya': 12,
  'Subang Jaya': 16,
  'Puchong': 18,
  'Shah Alam': 22,
  'Klang': 36,
  'Seremban': 65,
  'Melaka': 145,
  'Ipoh': 205,
  'Johor Bahru': 330,
  'Penang': 350,
}

/** Resolves distance in km from business headquarters (Bangsar, KL) */
export function getSupplierDistance(supplier: Supplier): number {
  if (typeof supplier.distanceKm === 'number') {
    return supplier.distanceKm
  }
  const match = Object.entries(CITY_DISTANCES_FROM_BANGSAR).find(
    ([city]) => supplier.location.toLowerCase().includes(city.toLowerCase()) || supplier.address.toLowerCase().includes(city.toLowerCase()),
  )
  return match ? match[1] : 25 // default estimate within greater Klang Valley
}

/** Calculates total landed cost including item subtotal, delivery freight, and per-unit landed metrics */
export function calculateLandedCost(
  unitPrice: number,
  quantity: number,
  deliveryFee: number,
  baselineUnitCost?: number,
): LandedCostBreakdown {
  const subtotal = round(unitPrice * quantity, 2)
  const totalLandedCost = round(subtotal + deliveryFee, 2)
  const landedUnitCost = quantity > 0 ? round(totalLandedCost / quantity, 2) : 0

  let costVariance: number | undefined
  let costVariancePct: number | undefined

  if (typeof baselineUnitCost === 'number' && baselineUnitCost > 0) {
    costVariance = round((landedUnitCost - baselineUnitCost) * quantity, 2)
    costVariancePct = round(((landedUnitCost - baselineUnitCost) / baselineUnitCost) * 100, 1)
  }

  return {
    subtotal,
    deliveryFee,
    totalLandedCost,
    landedUnitCost,
    baselineUnitCost,
    costVariance,
    costVariancePct,
  }
}

/** Generates a standard Quotation object enriched with Track 03A landed cost and distance attributes */
export function buildDiscoveredQuotation(
  sp: SupplierProduct,
  quantity: number,
  product?: Product,
): Quotation {
  const supplier = findSupplier(sp.supplierId) ?? allSuppliers()[0]
  const distanceKm = getSupplierDistance(supplier)
  const landedCost = calculateLandedCost(sp.unitPrice, quantity, sp.deliveryFee, product?.unitCost)
  const meetsMoq = quantity >= sp.moq
  const today = startOfToday()

  return {
    id: `q-${sp.supplierId}-${sp.productId}-${quantity}`,
    supplierId: sp.supplierId,
    productId: sp.productId,
    quantity,
    unitPrice: sp.unitPrice,
    subtotal: landedCost.subtotal,
    deliveryFee: sp.deliveryFee,
    total: landedCost.totalLandedCost,
    leadTimeDays: sp.leadTimeDays,
    moq: sp.moq,
    paymentTerms: supplier.paymentTerms,
    issuedAt: addDays(today, -1).toISOString(),
    expiresAt: addDays(today, 7).toISOString(),
    landedCost,
    distanceKm,
    meetsMoq,
    tags: [],
  }
}

/**
 * Discovers matching supplier offerings across the catalogue and filters by fulfillment constraints.
 */
export function discoverSuppliers(
  query: DiscoveryQuery,
  allProducts: Product[],
): DiscoveredSupplierQuote[] {
  const { productId, query: searchStr, category, quantity = 1, maxDistanceKm, maxLeadTimeDays, mustMeetMoq = false } = query

  // 1. Identify relevant products matching ID, category, or search keywords
  const matchedProducts = allProducts.filter((p) => {
    if (productId && p.id === productId) return true
    if (category && p.category.toLowerCase() === category.toLowerCase()) return true
    if (searchStr && searchStr.trim().length > 0) {
      const q = searchStr.toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      )
    }
    return !productId && !category && !searchStr
  })

  const matchedProductIds = new Set(matchedProducts.map((p) => p.id))
  const catalogue = allSupplierProducts()

  // 2. Filter supplier catalogue items
  const candidates = catalogue.filter((sp) => {
    if (matchedProductIds.size > 0 && !matchedProductIds.has(sp.productId)) return false
    return true
  })

  // 3. Build candidate quotes with distance and landed cost
  const discovered: DiscoveredSupplierQuote[] = []

  candidates.forEach((sp) => {
    const supplier = findSupplier(sp.supplierId)
    if (!supplier || supplier.status === 'Inactive') return

    const product = allProducts.find((p) => p.id === sp.productId)
    const distanceKm = getSupplierDistance(supplier)
    const meetsMoq = quantity >= sp.moq
    const moqShortfall = Math.max(0, sp.moq - quantity)

    // Apply strict filtering constraints
    if (mustMeetMoq && !meetsMoq) return
    if (typeof maxDistanceKm === 'number' && distanceKm > maxDistanceKm) return
    if (typeof maxLeadTimeDays === 'number' && sp.leadTimeDays > maxLeadTimeDays) return

    const landedCost = calculateLandedCost(sp.unitPrice, quantity, sp.deliveryFee, product?.unitCost)
    const quotation = buildDiscoveredQuotation(sp, quantity, product)

    discovered.push({
      quotation,
      supplier,
      product,
      supplierProduct: sp,
      distanceKm,
      meetsMoq,
      moqShortfall,
      landedCost,
      tags: [],
    })
  })

  // 4. Tag highlights (Cheapest, Nearest, Fastest, Best Value)
  return tagComparisonHighlights(discovered)
}

/**
 * Identifies and assigns highlight tags across discovered quotes:
 * - cheapest: Lowest total landed cost (among candidates that fulfill MOQ, or overall lowest)
 * - nearest: Shortest physical distance in km from Bangsar
 * - fastest: Shortest delivery lead time in days
 * - best-value: Meets MOQ with competitive landed unit cost
 */
export function tagComparisonHighlights(quotes: DiscoveredSupplierQuote[]): DiscoveredSupplierQuote[] {
  if (quotes.length === 0) return quotes

  const fulfillable = quotes.filter((q) => q.meetsMoq)
  const costPool = fulfillable.length > 0 ? fulfillable : quotes

  const minCost = Math.min(...costPool.map((q) => q.landedCost.totalLandedCost))
  const minDistance = Math.min(...quotes.map((q) => q.distanceKm))
  const minLeadTime = Math.min(...quotes.map((q) => q.quotation.leadTimeDays))

  quotes.forEach((q) => {
    const tags: ('cheapest' | 'nearest' | 'fastest' | 'best-value')[] = []
    if (q.landedCost.totalLandedCost === minCost) tags.push('cheapest')
    if (q.distanceKm === minDistance) tags.push('nearest')
    if (q.quotation.leadTimeDays === minLeadTime) tags.push('fastest')
    if (q.meetsMoq && q.landedCost.costVariance !== undefined && q.landedCost.costVariance <= 0) {
      tags.push('best-value')
    }
    q.tags = tags
    q.quotation.tags = tags
  })

  return quotes
}

/** Extracts supplier IDs of each comparison winner */
export function getComparisonHighlights(quotes: DiscoveredSupplierQuote[]): ComparisonHighlights {
  if (quotes.length === 0) return {}

  const fulfillable = quotes.filter((q) => q.meetsMoq)
  const costPool = fulfillable.length > 0 ? fulfillable : quotes

  const cheapest = costPool.reduce((prev, curr) => (curr.landedCost.totalLandedCost < prev.landedCost.totalLandedCost ? curr : prev), costPool[0])
  const nearest = quotes.reduce((prev, curr) => (curr.distanceKm < prev.distanceKm ? curr : prev), quotes[0])
  const fastest = quotes.reduce((prev, curr) => (curr.quotation.leadTimeDays < prev.quotation.leadTimeDays ? curr : prev), quotes[0])
  const highestReliability = quotes.reduce((prev, curr) => (curr.supplier.reliability > prev.supplier.reliability ? curr : prev), quotes[0])

  return {
    cheapestSupplierId: cheapest?.supplier.id,
    nearestSupplierId: nearest?.supplier.id,
    fastestSupplierId: fastest?.supplier.id,
    highestReliabilitySupplierId: highestReliability?.supplier.id,
  }
}

/** Sorts discovered quotes according to the user's chosen multi-vector preset */
export function sortQuotesByPreset(
  quotes: DiscoveredSupplierQuote[],
  preset: 'cheapest' | 'nearest' | 'fastest' | 'balanced',
): DiscoveredSupplierQuote[] {
  const copy = [...quotes]
  switch (preset) {
    case 'cheapest':
      return copy.sort((a, b) => a.landedCost.totalLandedCost - b.landedCost.totalLandedCost)
    case 'nearest':
      return copy.sort((a, b) => a.distanceKm - b.distanceKm || a.landedCost.totalLandedCost - b.landedCost.totalLandedCost)
    case 'fastest':
      return copy.sort((a, b) => a.quotation.leadTimeDays - b.quotation.leadTimeDays || a.landedCost.totalLandedCost - b.landedCost.totalLandedCost)
    case 'balanced':
    default:
      // Fulfillable first, then by landed cost
      return copy.sort((a, b) => {
        if (a.meetsMoq !== b.meetsMoq) return a.meetsMoq ? -1 : 1
        return a.landedCost.totalLandedCost - b.landedCost.totalLandedCost
      })
  }
}
