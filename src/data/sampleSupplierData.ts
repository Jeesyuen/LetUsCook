// Sample supplier data in the `SupplierInput` format, used until live supplier data is connected.
// Nothing here is live: directory suppliers reuse the demo catalogue pricing (same supplier ids as the
// rest of the app), and the two "ext-" suppliers are fictional examples of incomplete and unsuitable
// listings. Replace `mockSupplierSource` with the live data source — the scoring engine does not change.

import type { SupplierDataSource, SupplierInput } from '@/services/matching'
import { findSupplier } from './supplierRegistry'
import { supplierProducts } from './mockData'
import { isoAt } from '@/utils/date'
import { round } from '@/utils/format'

// Approximate road distance from Brew & Co. Café, Bangsar
const DISTANCE_KM: Record<string, number> = {
  's-beancraft': 24,
  's-aroma': 13,
  's-nusantara': 205,
  's-freshmart': 18,
  's-klang': 35,
  's-prime': 330,
}

// Stock reported by the supplier, in the product unit; omitted = not confirmed
const STOCK: Record<string, number> = {
  's-beancraft:p-coffee': 400,
  's-aroma:p-coffee': 250,
  's-nusantara:p-coffee': 1200,
  's-freshmart:p-milk': 2000,
  's-prime:p-milk': 1500,
  's-klang:p-cups': 50000,
}

function directorySuppliers(productId: string, quantity: number): SupplierInput[] {
  return supplierProducts
    .filter((sp) => sp.productId === productId)
    .flatMap((sp) => {
      const s = findSupplier(sp.supplierId)
      if (!s) return []
      return [
        {
          id: s.id,
          name: s.name,
          total_price: round(sp.unitPrice * quantity + sp.deliveryFee, 2),
          unit_price: sp.unitPrice,
          distance_km: DISTANCE_KM[s.id] ?? null,
          delivery_days: sp.leadTimeDays,
          reliability: s.isNew || !s.completedOrders ? null : s.reliability,
          product_suitability: 100,
          location: `${s.location}, ${s.state}`,
          available_quantity: STOCK[`${s.id}:${productId}`] ?? null,
          minimum_order_quantity: sp.moq,
          delivers_to_business: s.status === 'Active' ? true : null,
          source: 'Demo supplier catalogue (sample data)',
          is_mock: true,
          last_updated: isoAt(-1, 8, 30),
        },
      ]
    })
}

// Fictional listings for coffee beans that exercise the missing-data and unsuitable cases
function externalSuppliers(productId: string, quantity: number): SupplierInput[] {
  if (productId !== 'p-coffee') return []
  return [
    {
      id: 'ext-hulu-roasters',
      name: 'Hulu Selangor Roasters',
      total_price: round(18.4 * quantity, 2),
      unit_price: 18.4,
      distance_km: null,
      delivery_days: 4,
      reliability: null,
      product_suitability: 90,
      location: 'Rawang, Selangor',
      available_quantity: null,
      minimum_order_quantity: 10,
      delivers_to_business: null,
      source: 'Sample marketplace listing',
      is_mock: true,
      last_updated: isoAt(-3, 14, 0),
    },
    {
      id: 'ext-tanjung-kopi',
      name: 'Tanjung Karang Kopi',
      total_price: round(12 * quantity + 40, 2),
      unit_price: 12,
      distance_km: 70,
      delivery_days: 3,
      reliability: null,
      product_suitability: 0,
      location: 'Tanjung Karang, Selangor',
      available_quantity: 800,
      minimum_order_quantity: 25,
      delivers_to_business: true,
      source: 'Sample supplier website — Robusta only',
      is_mock: true,
      last_updated: isoAt(-5, 9, 0),
    },
  ]
}

/** Synchronous mock lookup by catalogue product id. */
export function mockSuppliersFor(productId: string, quantity: number): SupplierInput[] {
  return [...directorySuppliers(productId, quantity), ...externalSuppliers(productId, quantity)]
}

/** Sample data source for a catalogue product. */
export const mockSupplierSource =
  (productId: string): SupplierDataSource =>
  async (request) =>
    mockSuppliersFor(productId, request.required_quantity)
