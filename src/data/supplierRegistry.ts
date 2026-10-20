// Runtime supplier registry: seeded suppliers plus any added during the demo.
// Pure services (scoring, communication) read from here so they don't depend on React state.
import type { Supplier } from '@/types'
import { suppliers as seeded } from './mockData'

let custom: Supplier[] = []

export const allSuppliers = (): Supplier[] => [...seeded, ...custom]
export const setCustomSuppliers = (list: Supplier[]) => {
  custom = list
}
export const findSupplier = (id: string): Supplier | undefined => allSuppliers().find((s) => s.id === id)
