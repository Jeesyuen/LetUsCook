import { useEffect, useMemo, useState } from 'react'
import { compareSuppliersEndpoint, type CompareSuppliersResponse, type MatchingPriority, type SupplierDataSource, type SupplierInput } from '@/services/matching'
import { mockSupplierSource } from '@/data/sampleSupplierData'
import type { Product } from '@/types'

// Supplier data source: swap the sample source for the live supplier data client.
const supplierSourceFor = (product: Product): SupplierDataSource => mockSupplierSource(product.id)

interface Options {
  product: Product | undefined
  quantity: number
  priority: MatchingPriority
  daysUntilStockout: number | null
  /** Supplier ids to leave out, e.g. one that just declined a PO */
  exclude?: string[]
}

/** Fetches supplier data for the request, then scores and ranks it for the chosen priority. */
export function useSupplierMatching({ product, quantity, priority, daysUntilStockout, exclude = [] }: Options) {
  const fetchKey = product ? `${product.id}:${quantity}` : ''
  const [data, setData] = useState<{ key: string; suppliers: SupplierInput[]; error: string | null }>({ key: '', suppliers: [], error: null })

  useEffect(() => {
    if (!product) return
    let cancelled = false
    supplierSourceFor(product)({ product: product.name, required_quantity: quantity, unit: product.unit })
      .then((suppliers) => !cancelled && setData({ key: fetchKey, suppliers, error: null }))
      .catch((e: unknown) => !cancelled && setData({ key: fetchKey, suppliers: [], error: e instanceof Error ? e.message : 'Supplier data could not be loaded.' }))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey])

  const loading = !!product && data.key !== fetchKey
  const excludeKey = exclude.join(',')

  // Scoring is local and instant, so priority changes update the results immediately
  const outcome = useMemo<{ result: CompareSuppliersResponse | null; error: string | null }>(() => {
    if (!product || loading) return { result: null, error: null }
    if (data.error) return { result: null, error: data.error }
    try {
      const skip = excludeKey ? excludeKey.split(',') : []
      const body = {
        product: product.name,
        required_quantity: quantity,
        unit: product.unit,
        priority,
        days_until_stockout: daysUntilStockout,
        suppliers: data.suppliers.filter((s) => !skip.includes(s.id)),
      }
      return { result: compareSuppliersEndpoint(body), error: null }
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : 'Supplier matching failed.' }
    }
  }, [product, quantity, loading, data, priority, daysUntilStockout, excludeKey])

  return { ...outcome, loading }
}
