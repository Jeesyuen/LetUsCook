// Runtime supplier registry: seeded suppliers plus any added during the demo.
// Pure services (scoring, communication, discovery) read from here so they don't depend on React state.
import type { Supplier, SupplierProduct } from '@/types'
import { supplierProducts as seededProducts, suppliers as seeded } from './mockData'

let custom: Supplier[] = []
let customProducts: SupplierProduct[] = []

export const allSuppliers = (): Supplier[] => [...seeded, ...custom]
export const setCustomSuppliers = (list: Supplier[]) => {
  custom = list
}
export const findSupplier = (id: string): Supplier | undefined => allSuppliers().find((s) => s.id === id)

export const allSupplierProducts = (): SupplierProduct[] => [...seededProducts, ...customProducts]
export const setCustomSupplierProducts = (list: SupplierProduct[]) => {
  customProducts = list
}
export const addCustomSupplierProduct = (sp: SupplierProduct) => {
  customProducts.push(sp)
}
export const findSupplierProductsForProduct = (productId: string): SupplierProduct[] =>
  allSupplierProducts().filter((sp) => sp.productId === productId)

