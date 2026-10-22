// POST /compare-suppliers — endpoint-shaped entry point.
//
// The project has no backend yet, so this runs in the browser. It takes the raw JSON body (as a
// FastAPI route would), validates it, and returns the response body. A future backend can expose
// the same contract and the frontend only needs to swap this call for a fetch.

import type { CompareSuppliersRequest, CompareSuppliersResponse, MatchingPriority, SupplierInput } from './types'
import { compareSuppliers, MatchingValidationError } from './scoring'
import { PRIORITY_WEIGHTS } from './config'

/** Supplier data source: returns supplier data for a product request. */
export type SupplierDataSource = (request: Omit<CompareSuppliersRequest, 'suppliers'>) => Promise<SupplierInput[]>

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function numOrNull(o: Record<string, unknown>, key: string, where: string): number | null {
  const v = o[key]
  if (v === null || v === undefined) return null
  if (typeof v !== 'number') throw new MatchingValidationError(`${where}.${key} must be a number or null.`)
  return v
}

function parseSupplier(v: unknown, i: number): SupplierInput {
  const where = `suppliers[${i}]`
  if (!isObj(v)) throw new MatchingValidationError(`${where} must be an object.`)
  if (typeof v.id !== 'string' || typeof v.name !== 'string') throw new MatchingValidationError(`${where} needs string id and name.`)
  return {
    ...(v as Partial<SupplierInput>),
    id: v.id,
    name: v.name,
    total_price: numOrNull(v, 'total_price', where),
    distance_km: numOrNull(v, 'distance_km', where),
    delivery_days: numOrNull(v, 'delivery_days', where),
    reliability: numOrNull(v, 'reliability', where),
    product_suitability: numOrNull(v, 'product_suitability', where),
    available_quantity: numOrNull(v, 'available_quantity', where),
    minimum_order_quantity: numOrNull(v, 'minimum_order_quantity', where),
  }
}

/** Validates an untrusted request body (e.g. supplier data JSON). Throws MatchingValidationError. */
export function parseCompareRequest(body: unknown): CompareSuppliersRequest {
  if (!isObj(body)) throw new MatchingValidationError('Request body must be a JSON object.')
  if (typeof body.product !== 'string') throw new MatchingValidationError('product must be a string.')
  if (typeof body.required_quantity !== 'number') throw new MatchingValidationError('required_quantity must be a number.')
  if (typeof body.unit !== 'string') throw new MatchingValidationError('unit must be a string.')
  if (body.priority !== undefined && !(typeof body.priority === 'string' && body.priority in PRIORITY_WEIGHTS)) throw new MatchingValidationError('priority must be best_overall, cheapest, nearest or fastest.')
  if (!Array.isArray(body.suppliers)) throw new MatchingValidationError('suppliers must be a list.')
  return {
    product: body.product,
    required_quantity: body.required_quantity,
    unit: body.unit,
    priority: body.priority as MatchingPriority | undefined,
    days_until_stockout: typeof body.days_until_stockout === 'number' ? body.days_until_stockout : null,
    suppliers: body.suppliers.map(parseSupplier),
  }
}

export function compareSuppliersEndpoint(body: unknown): CompareSuppliersResponse {
  return compareSuppliers(parseCompareRequest(body))
}
