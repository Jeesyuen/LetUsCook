import { describe, expect, it } from 'vitest'
import { seedProductsAndMovements } from '@/data/mockData'
import { setCustomSupplierProducts } from '@/data/supplierRegistry'
import { discoverSuppliers } from './discovery'
import { buildQuotations } from './scoring'
import type { SupplierProduct } from '@/types'

const { products } = seedProductsAndMovements()

describe('Track 03A: discovery & scoring bug fixes', () => {
  describe('Bug 1: discoverSuppliers query filtering', () => {
    it('returns empty array when search query matches no products', () => {
      const results = discoverSuppliers({ query: 'nonexistent_xyz_random_term_12345' }, products)
      expect(results).toHaveLength(0)
    })

    it('returns empty array when category filter matches no products', () => {
      const results = discoverSuppliers({ category: 'NonExistentCategory' }, products)
      expect(results).toHaveLength(0)
    })

    it('returns matching supplier quotes when valid search query is provided', () => {
      const results = discoverSuppliers({ query: 'Coffee' }, products)
      expect(results.length).toBeGreaterThan(0)
      for (const quote of results) {
        expect(quote.product?.name.toLowerCase()).toContain('coffee')
      }
    })

    it('requires every filter to match when category and search query are combined', () => {
      const results = discoverSuppliers({ category: 'Dairy', query: 'oat' }, products)
      expect(results.length).toBeGreaterThan(0)
      for (const quote of results) {
        expect(quote.product?.id).toBe('p-oat')
      }
    })

    it('returns all suppliers when no search query or filter is provided', () => {
      const results = discoverSuppliers({}, products)
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('Bug 2: buildQuotations cheapest tag & MOQ eligibility', () => {
    it('does not tag a supplier as cheapest if the supplier MOQ is higher than requested quantity', () => {
      // Setup isolated test supplier products for a test product
      const testProductId = 'prod-test-moq'
      const testSpList: SupplierProduct[] = [
        {
          supplierId: 's-prime', // unitPrice 10, del 0, total = 100 for qty 10. BUT moq is 50!
          productId: testProductId,
          unitPrice: 10,
          deliveryFee: 0,
          leadTimeDays: 2,
          moq: 50,
        },
        {
          supplierId: 's-freshmart', // unitPrice 12, del 0, total = 120 for qty 10. moq is 5! Meets MOQ!
          productId: testProductId,
          unitPrice: 12,
          deliveryFee: 0,
          leadTimeDays: 3,
          moq: 5,
        },
      ]

      setCustomSupplierProducts(testSpList)

      const quotes = buildQuotations(testProductId, 10)
      expect(quotes).toHaveLength(2)

      const primeQuote = quotes.find((q) => q.supplierId === 's-prime')
      const freshQuote = quotes.find((q) => q.supplierId === 's-freshmart')

      expect(primeQuote?.meetsMoq).toBe(false)
      expect(freshQuote?.meetsMoq).toBe(true)

      // Prime cannot actually accept the order, so freshmart (fulfillable lowest landed cost) must be tagged cheapest
      expect(primeQuote?.tags).not.toContain('cheapest')
      expect(freshQuote?.tags).toContain('cheapest')

      // Clean up custom supplier products
      setCustomSupplierProducts([])
    })

    it('reliably awards cheapest tag even with floating-point decimal prices', () => {
      const testProductId = 'prod-test-float'
      const testSpList: SupplierProduct[] = [
        {
          supplierId: 's-prime',
          productId: testProductId,
          unitPrice: 10.3333,
          deliveryFee: 5.1111,
          leadTimeDays: 2,
          moq: 1,
        },
        {
          supplierId: 's-freshmart',
          productId: testProductId,
          unitPrice: 15.5,
          deliveryFee: 10,
          leadTimeDays: 3,
          moq: 1,
        },
      ]

      setCustomSupplierProducts(testSpList)

      const quotes = buildQuotations(testProductId, 3)
      const primeQuote = quotes.find((q) => q.supplierId === 's-prime')
      const freshQuote = quotes.find((q) => q.supplierId === 's-freshmart')

      expect(primeQuote?.tags).toContain('cheapest')
      expect(freshQuote?.tags).not.toContain('cheapest')

      setCustomSupplierProducts([])
    })
  })
})
