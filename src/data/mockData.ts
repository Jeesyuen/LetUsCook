// Centralised, internally consistent demo data for Brew & Co. Café.
// Everything time-based is generated relative to "today" when the demo is (re)seeded.

import type {
  ActivityLog,
  AppNotification,
  AppSettings,
  ApprovalRequest,
  Business,
  InventoryMovement,
  Product,
  PurchaseOrder,
  Supplier,
  SupplierMessage,
  SupplierProduct,
  User,
} from '@/types'
import { isoAt, minutesAgo } from '@/utils/date'

export const business: Business = {
  id: 'biz-brewco',
  name: 'Brew & Co. Café',
  registrationNo: '202301045678 (1512345-K)',
  industry: 'Food & Beverage — Café',
  address: '12, Jalan Telawi 3, Bangsar Baru',
  city: 'Kuala Lumpur',
  state: 'W.P. Kuala Lumpur',
  phone: '+60 3-2201 8890',
  email: 'hello@brewandco.my',
  currency: 'MYR',
}

export const currentUser: User = {
  id: 'u-alex',
  name: 'Alex Tan',
  role: 'Manager',
  email: 'alex@brewandco.my',
  initials: 'AT',
}

export const staffUser = 'Nurul Aisyah'
export const SYSTEM_USER = 'SupplyWise AI'

export const suppliers: Supplier[] = [
  {
    id: 's-beancraft',
    name: 'BeanCraft Wholesale',
    initials: 'BC',
    brandColor: '#3154DF',
    category: 'Coffee',
    location: 'Shah Alam',
    state: 'Selangor',
    contactName: 'Daniel Lim',
    phone: '+60 3-5510 2234',
    email: 'orders@beancraft.example.my',
    whatsapp: '+60 12-334 8812',
    reliability: 97,
    qualityRating: 4.7,
    avgDeliveryDays: 2,
    status: 'Active',
    preferred: true,
    website: 'beancraft.example.my',
    address: 'Lot 7, Jalan Pelabur 23/1, Seksyen 23, 40300 Shah Alam',
    onTimeRate: 98,
    completedOrders: 214,
    paymentTerms: 'Net 30',
    since: 2021,
    about: 'Specialty coffee importer and roaster supplying cafés across the Klang Valley with single-origin and blended beans.',
    distanceKm: 22,
  },
  {
    id: 's-aroma',
    name: 'Aroma Supply Co.',
    initials: 'AS',
    brandColor: '#9B5CFF',
    category: 'Coffee & Syrups',
    location: 'Petaling Jaya',
    state: 'Selangor',
    contactName: 'Priya Raman',
    phone: '+60 3-7955 6120',
    email: 'sales@aromasupply.example.my',
    whatsapp: '+60 16-221 4507',
    reliability: 92,
    qualityRating: 4.4,
    avgDeliveryDays: 5,
    status: 'Active',
    preferred: false,
    website: 'aromasupply.example.my',
    address: '18, Jalan SS 13/3, Subang Jaya Industrial Estate, 47500 Petaling Jaya',
    onTimeRate: 90,
    completedOrders: 126,
    paymentTerms: 'Net 30',
    since: 2022,
    about: 'Café essentials distributor covering coffee beans, flavoured syrups and barista accessories.',
    distanceKm: 12,
  },
  {
    id: 's-nusantara',
    name: 'Nusantara Coffee Trading',
    initials: 'NC',
    brandColor: '#151DA4',
    category: 'Coffee & Tea',
    location: 'Ipoh',
    state: 'Perak',
    contactName: 'Ahmad Faizal',
    phone: '+60 5-254 7788',
    email: 'trade@nusantaracoffee.example.my',
    whatsapp: '+60 19-552 0193',
    reliability: 85,
    qualityRating: 4.2,
    avgDeliveryDays: 8,
    status: 'Active',
    preferred: false,
    website: 'nusantaracoffee.example.my',
    address: '42, Jalan Kuala Kangsar, 30010 Ipoh',
    onTimeRate: 81,
    completedOrders: 58,
    paymentTerms: 'Net 14',
    since: 2023,
    about: 'Bulk trader of Southeast Asian coffee and tea with competitive pricing on larger orders.',
    distanceKm: 205,
  },
  {
    id: 's-freshmart',
    name: 'FreshMart Distribution',
    initials: 'FM',
    brandColor: '#22A06B',
    category: 'Dairy & Chilled',
    location: 'Puchong',
    state: 'Selangor',
    contactName: 'Michelle Wong',
    phone: '+60 3-8060 4411',
    email: 'cs@freshmart.example.my',
    whatsapp: '+60 11-2345 6789',
    reliability: 95,
    qualityRating: 4.5,
    avgDeliveryDays: 1,
    status: 'Active',
    preferred: true,
    website: 'freshmart.example.my',
    address: '3, Jalan Industri Puchong 2, 47100 Puchong',
    onTimeRate: 96,
    completedOrders: 341,
    paymentTerms: 'Net 14',
    since: 2021,
    about: 'Cold-chain distributor of fresh dairy, plant-based milk and chilled goods with next-day delivery.',
    distanceKm: 18,
  },
  {
    id: 's-klang',
    name: 'Klang Valley Packaging',
    initials: 'KV',
    brandColor: '#4169FF',
    category: 'Packaging',
    location: 'Klang',
    state: 'Selangor',
    contactName: 'Kumar Selvam',
    phone: '+60 3-3341 9022',
    email: 'orders@kvpack.example.my',
    whatsapp: '+60 17-889 2210',
    reliability: 94,
    qualityRating: 4.3,
    avgDeliveryDays: 4,
    status: 'Active',
    preferred: false,
    website: 'kvpack.example.my',
    address: '9, Jalan Kapar, Taman Perindustrian, 41400 Klang',
    onTimeRate: 93,
    completedOrders: 97,
    paymentTerms: 'Net 30',
    since: 2022,
    about: 'Food-grade cups, lids and takeaway packaging, including compostable options.',
    distanceKm: 36,
  },
  {
    id: 's-prime',
    name: 'Prime Food Ingredients',
    initials: 'PF',
    brandColor: '#737B92',
    category: 'Ingredients',
    location: 'Johor Bahru',
    state: 'Johor',
    contactName: 'Siti Hajar',
    phone: '+60 7-355 1028',
    email: 'sales@primefood.example.my',
    whatsapp: '+60 13-778 4410',
    reliability: 88,
    qualityRating: 4.1,
    avgDeliveryDays: 5,
    status: 'Active',
    preferred: false,
    website: 'primefood.example.my',
    address: '27, Jalan Tampoi 7/4, Kawasan Perindustrian Tampoi, 81200 Johor Bahru',
    onTimeRate: 84,
    completedOrders: 44,
    paymentTerms: 'Net 30',
    since: 2024,
    about: 'Broad-line F&B ingredient wholesaler. Flagged for review after two late deliveries last quarter.',
    distanceKm: 330,
  },
]

export const supplierProducts: SupplierProduct[] = [
  // Arabica Coffee Beans — the three quotations in the core demo
  { supplierId: 's-aroma', productId: 'p-coffee', unitPrice: 18.0, moq: 50, leadTimeDays: 5, deliveryFee: 50 },
  { supplierId: 's-beancraft', productId: 'p-coffee', unitPrice: 19.5, moq: 20, leadTimeDays: 2, deliveryFee: 0 },
  { supplierId: 's-nusantara', productId: 'p-coffee', unitPrice: 17.0, moq: 100, leadTimeDays: 8, deliveryFee: 80 },
  // Fresh Milk
  { supplierId: 's-freshmart', productId: 'p-milk', unitPrice: 6.5, moq: 50, leadTimeDays: 1, deliveryFee: 0 },
  { supplierId: 's-prime', productId: 'p-milk', unitPrice: 6.2, moq: 100, leadTimeDays: 3, deliveryFee: 60 },
  // Paper Cups
  { supplierId: 's-klang', productId: 'p-cups', unitPrice: 0.2, moq: 1000, leadTimeDays: 4, deliveryFee: 40 },
  { supplierId: 's-aroma', productId: 'p-cups', unitPrice: 0.24, moq: 500, leadTimeDays: 5, deliveryFee: 30 },
  // Brown Sugar
  { supplierId: 's-prime', productId: 'p-sugar', unitPrice: 4.0, moq: 25, leadTimeDays: 4, deliveryFee: 30 },
  { supplierId: 's-freshmart', productId: 'p-sugar', unitPrice: 4.3, moq: 10, leadTimeDays: 2, deliveryFee: 0 },
  // Matcha Powder
  { supplierId: 's-nusantara', productId: 'p-matcha', unitPrice: 115, moq: 2, leadTimeDays: 7, deliveryFee: 25 },
  { supplierId: 's-prime', productId: 'p-matcha', unitPrice: 125, moq: 1, leadTimeDays: 5, deliveryFee: 30 },
  // Chocolate Syrup
  { supplierId: 's-aroma', productId: 'p-choc', unitPrice: 27, moq: 6, leadTimeDays: 4, deliveryFee: 20 },
  { supplierId: 's-prime', productId: 'p-choc', unitPrice: 26, moq: 12, leadTimeDays: 5, deliveryFee: 30 },
  // Oat Milk
  { supplierId: 's-freshmart', productId: 'p-oat', unitPrice: 11, moq: 24, leadTimeDays: 2, deliveryFee: 0 },
  { supplierId: 's-prime', productId: 'p-oat', unitPrice: 10.4, moq: 48, leadTimeDays: 4, deliveryFee: 45 },
  // Tea Leaves
  { supplierId: 's-nusantara', productId: 'p-tea', unitPrice: 42, moq: 5, leadTimeDays: 6, deliveryFee: 25 },
  { supplierId: 's-prime', productId: 'p-tea', unitPrice: 46, moq: 2, leadTimeDays: 5, deliveryFee: 20 },
]

interface ProductSeed extends Omit<Product, 'usageHistory' | 'stockHistory' | 'supplierIds'> {
  avg: number
  usageOverride?: number[]
  integerUsage?: boolean
}

const productSeeds: ProductSeed[] = [
  {
    id: 'p-coffee', sku: 'BCC-COF-001', name: 'Arabica Coffee Beans', category: 'Coffee', unit: 'kg', icon: 'coffee',
    description: 'Medium-roast Arabica blend used for all espresso-based drinks. Supplied in 1 kg valve bags.',
    currentStock: 12, unitCost: 18.5, grossProfitPerUnit: 240, orderMultiple: 10, avg: 4,
    usageOverride: [3.6, 4.1, 3.9, 4.4, 3.8, 4.2, 4.0, 3.7, 4.3, 4.1, 3.9, 4.0, 4.2, 3.8],
    reorder: { triggerLevel: 24, reorderQty: null, preferredSupplierId: 's-beancraft', leadTimeDays: 3, safetyStock: 12, autoDraft: true },
  },
  {
    id: 'p-milk', sku: 'BCC-DAI-002', name: 'Fresh Milk', category: 'Dairy', unit: 'L', icon: 'milk',
    description: 'Full-cream fresh milk for lattes, cappuccinos and flat whites. Kept chilled at 2–4°C.',
    currentStock: 62, unitCost: 6.8, grossProfitPerUnit: 22, orderMultiple: 10, avg: 18,
    reorder: { triggerLevel: 66, reorderQty: null, preferredSupplierId: 's-freshmart', leadTimeDays: 2, safetyStock: 30, autoDraft: true },
  },
  {
    id: 'p-sugar', sku: 'BCC-SWT-003', name: 'Brown Sugar', category: 'Sweeteners', unit: 'kg', icon: 'sugar',
    description: 'Fine brown cane sugar for brown sugar lattes and house syrups.',
    currentStock: 38, unitCost: 4.2, grossProfitPerUnit: 45, orderMultiple: 5, avg: 1.5,
    reorder: { triggerLevel: 10, reorderQty: null, preferredSupplierId: 's-prime', leadTimeDays: 3, safetyStock: 5, autoDraft: true },
  },
  {
    id: 'p-cups', sku: 'BCC-PKG-004', name: 'Paper Cups 12oz', category: 'Packaging', unit: 'pcs', icon: 'cup',
    description: 'Double-wall 12oz takeaway cups with Brew & Co. print. Sleeves of 50.',
    currentStock: 2400, unitCost: 0.22, grossProfitPerUnit: 1.2, orderMultiple: 500, avg: 220, integerUsage: true,
    reorder: { triggerLevel: 1480, reorderQty: null, preferredSupplierId: 's-klang', leadTimeDays: 4, safetyStock: 600, autoDraft: true },
  },
  {
    id: 'p-matcha', sku: 'BCC-TEA-005', name: 'Matcha Powder', category: 'Tea', unit: 'kg', icon: 'matcha',
    description: 'Ceremonial-grade Uji matcha for matcha lattes. Store sealed, away from light.',
    currentStock: 6.5, unitCost: 120, grossProfitPerUnit: 520, orderMultiple: 1, avg: 0.35,
    reorder: { triggerLevel: 3.5, reorderQty: null, preferredSupplierId: 's-nusantara', leadTimeDays: 7, safetyStock: 1, autoDraft: true },
  },
  {
    id: 'p-choc', sku: 'BCC-SYR-006', name: 'Chocolate Syrup', category: 'Syrups', unit: 'btl', icon: 'syrup',
    description: 'Rich Belgian-style chocolate sauce in 1 L pump bottles for mochas and iced chocolate.',
    currentStock: 18, unitCost: 28, grossProfitPerUnit: 60, orderMultiple: 6, avg: 1.2,
    reorder: { triggerLevel: 9, reorderQty: null, preferredSupplierId: 's-aroma', leadTimeDays: 5, safetyStock: 3, autoDraft: true },
  },
  {
    id: 'p-oat', sku: 'BCC-DAI-007', name: 'Oat Milk', category: 'Dairy', unit: 'L', icon: 'oat',
    description: 'Barista-edition oat milk that steams well for plant-based drinks.',
    currentStock: 66, unitCost: 11.5, grossProfitPerUnit: 28, orderMultiple: 12, avg: 6,
    reorder: { triggerLevel: 30, reorderQty: null, preferredSupplierId: 's-freshmart', leadTimeDays: 3, safetyStock: 12, autoDraft: true },
  },
  {
    id: 'p-tea', sku: 'BCC-TEA-008', name: 'Tea Leaves', category: 'Tea', unit: 'kg', icon: 'tea',
    description: 'BOH-style black tea blend for teh tarik and iced lemon tea.',
    currentStock: 9, unitCost: 45, grossProfitPerUnit: 260, orderMultiple: 1, avg: 0.6,
    reorder: { triggerLevel: 4.5, reorderQty: null, preferredSupplierId: 's-nusantara', leadTimeDays: 5, safetyStock: 1.5, autoDraft: true },
  },
]

function roundTo(n: number, integer: boolean) {
  return integer ? Math.round(n) : Math.round(n * 10) / 10
}

/** Deterministic, gently varying usage pattern whose mean equals `avg`. */
function buildUsage(avg: number, seed: number, integer: boolean): number[] {
  const raw = Array.from({ length: 14 }, (_, i) => roundTo(avg * (1 + 0.11 * Math.sin(i * 1.7 + seed) + 0.05 * Math.cos(i * 0.9 + seed * 2)), integer))
  const diff = roundTo(avg * 14 - raw.reduce((a, b) => a + b, 0), integer)
  raw[raw.length - 1] = roundTo(raw[raw.length - 1] + diff, integer)
  return raw
}

/**
 * Reconstruct 14 days of end-of-day stock by walking backwards from today's stock.
 * Whenever the backward level exceeds two weeks of cover, a historical goods receipt is inferred.
 */
function buildHistory(p: ProductSeed, usage: number[]) {
  const integer = !!p.integerUsage
  const cap = p.avg * 13
  const receiptQty = Math.ceil((p.avg * 10) / p.orderMultiple) * p.orderMultiple
  const levels = new Array<number>(14)
  const receipts: { dayIndex: number; qty: number }[] = []
  // yesterday's closing = today's stock + today's usage so far (~half a day)
  let level = roundTo(p.currentStock + p.avg * 0.5, integer)
  for (let i = 13; i >= 0; i--) {
    levels[i] = level
    let opening = level + usage[i]
    if (opening > cap && i > 0) {
      opening -= receiptQty
      receipts.push({ dayIndex: i, qty: receiptQty })
    }
    level = roundTo(opening, integer)
  }
  return { levels, receipts }
}

const supplierIdsFor = (productId: string) => supplierProducts.filter((sp) => sp.productId === productId).map((sp) => sp.supplierId)

export function seedProductsAndMovements(): { products: Product[]; movements: InventoryMovement[] } {
  const products: Product[] = []
  const movements: InventoryMovement[] = []
  productSeeds.forEach((seed, idx) => {
    const usage = seed.usageOverride ?? buildUsage(seed.avg, idx + 1, !!seed.integerUsage)
    const { levels, receipts } = buildHistory(seed, usage)
    const { avg: _avg, usageOverride: _u, integerUsage: _i, ...rest } = seed
    products.push({ ...rest, usageHistory: usage, stockHistory: levels, supplierIds: supplierIdsFor(seed.id) })

    // Movement log: receipts plus the last 5 days of POS usage
    receipts.forEach((r, n) => {
      const dayOffset = r.dayIndex - 14
      movements.push({
        id: `mv-${seed.id}-r${n}`,
        productId: seed.id,
        type: 'receipt',
        quantity: r.qty,
        balanceAfter: roundTo(levels[r.dayIndex] + usage[r.dayIndex] * 0.6, !!seed.integerUsage),
        reason: 'Goods received',
        reference: `GRN-${2400 + idx * 7 + n}`,
        user: staffUser,
        date: isoAt(dayOffset, 10, 15),
      })
    })
    for (let i = 9; i < 14; i++) {
      movements.push({
        id: `mv-${seed.id}-u${i}`,
        productId: seed.id,
        type: 'usage',
        quantity: -usage[i],
        balanceAfter: levels[i],
        reason: 'Daily consumption (POS sync)',
        user: SYSTEM_USER,
        date: isoAt(i - 14, 22, 0),
      })
    }
  })
  movements.push({
    id: 'mv-p-choc-adj',
    productId: 'p-choc',
    type: 'adjustment',
    quantity: -1,
    balanceAfter: 18,
    reason: 'Damaged',
    notes: 'Pump bottle cracked during delivery handling.',
    user: staffUser,
    date: isoAt(-1, 17, 40),
  })
  movements.sort((a, b) => b.date.localeCompare(a.date))
  return { products, movements }
}

export interface QuotationHistoryEntry {
  id: string
  supplierId: string
  productId: string
  quantity: number
  total: number
  date: string
  outcome: 'Accepted' | 'Not selected' | 'Expired'
}

export function seedQuotationHistory(): QuotationHistoryEntry[] {
  return [
    { id: 'qh-1', supplierId: 's-beancraft', productId: 'p-coffee', quantity: 50, total: 975, date: isoAt(-18), outcome: 'Accepted' },
    { id: 'qh-2', supplierId: 's-aroma', productId: 'p-coffee', quantity: 50, total: 950, date: isoAt(-18), outcome: 'Not selected' },
    { id: 'qh-3', supplierId: 's-nusantara', productId: 'p-coffee', quantity: 100, total: 1780, date: isoAt(-18), outcome: 'Not selected' },
    { id: 'qh-4', supplierId: 's-klang', productId: 'p-cups', quantity: 3000, total: 640, date: isoAt(-15), outcome: 'Accepted' },
    { id: 'qh-5', supplierId: 's-aroma', productId: 'p-cups', quantity: 3000, total: 750, date: isoAt(-15), outcome: 'Not selected' },
    { id: 'qh-6', supplierId: 's-prime', productId: 'p-sugar', quantity: 25, total: 130, date: isoAt(-12), outcome: 'Accepted' },
    { id: 'qh-7', supplierId: 's-freshmart', productId: 'p-oat', quantity: 48, total: 528, date: isoAt(-2), outcome: 'Accepted' },
    { id: 'qh-8', supplierId: 's-prime', productId: 'p-choc', quantity: 24, total: 654, date: isoAt(-4), outcome: 'Expired' },
    { id: 'qh-9', supplierId: 's-nusantara', productId: 'p-tea', quantity: 10, total: 445, date: isoAt(-25), outcome: 'Accepted' },
    { id: 'qh-10', supplierId: 's-freshmart', productId: 'p-milk', quantity: 300, total: 1950, date: isoAt(-9), outcome: 'Accepted' },
  ]
}

export function seedApprovals(): ApprovalRequest[] {
  return [
    {
      id: 'apr-1004', kind: 'purchase', status: 'Pending', productId: 'p-milk', quantity: 390, supplierId: 's-freshmart',
      unitPrice: 6.5, deliveryFee: 0, total: 2535, leadTimeDays: 1, score: 0, priority: 'balanced',
      reason: 'Fresh milk will cross its reorder point within 2 days. FreshMart delivers next day with 95% reliability.',
      requestedBy: staffUser, requestedAt: minutesAgo(138),
    },
    {
      id: 'apr-1003', kind: 'purchase', status: 'Approved', productId: 'p-oat', quantity: 48, supplierId: 's-freshmart',
      unitPrice: 11, deliveryFee: 0, total: 528, leadTimeDays: 2, score: 0, priority: 'balanced',
      reason: 'Weekend promotion expected to lift plant-based drink sales.',
      requestedBy: staffUser, requestedAt: isoAt(-2, 10, 5), decidedBy: currentUser.name, decidedAt: isoAt(-2, 11, 30),
      resultingPoId: 'po-0141',
    },
    {
      id: 'apr-1002', kind: 'purchase', status: 'Rejected', productId: 'p-choc', quantity: 24, supplierId: 's-prime',
      unitPrice: 26, deliveryFee: 30, total: 654, leadTimeDays: 5, score: 0, priority: 'cost',
      reason: 'Lowest unit price for chocolate syrup.',
      requestedBy: staffUser, requestedAt: isoAt(-4, 15, 0), decidedBy: currentUser.name, decidedAt: isoAt(-4, 16, 20),
      decisionNote: 'Supplier is under review after late deliveries — stock is sufficient for now.',
    },
    {
      id: 'apr-1001', kind: 'purchase', status: 'Approved', productId: 'p-cups', quantity: 3000, supplierId: 's-klang',
      unitPrice: 0.2, deliveryFee: 40, total: 640, leadTimeDays: 4, score: 0, priority: 'balanced',
      reason: 'Cups below trigger level ahead of the school holiday rush.',
      requestedBy: staffUser, requestedAt: isoAt(-15, 9, 30), decidedBy: currentUser.name, decidedAt: isoAt(-15, 10, 2),
      resultingPoId: 'po-0139',
    },
  ]
}

export function seedPurchaseOrders(): PurchaseOrder[] {
  return [
    {
      id: 'po-0141', number: 'PO-2026-0141', supplierId: 's-freshmart', productId: 'p-oat', quantity: 48, unitPrice: 11, deliveryFee: 0,
      total: 528, status: 'Awaiting Confirmation', createdAt: isoAt(-2, 11, 30), expectedDelivery: isoAt(1), leadTimeDays: 2,
      paymentTerms: 'Net 14', approvalId: 'apr-1003', approvedBy: currentUser.name, approvedAt: isoAt(-2, 11, 30), sentVia: 'email',
      timeline: [
        { status: 'Created', label: 'Purchase order generated', date: isoAt(-2, 11, 30), by: SYSTEM_USER },
        { status: 'Approved', label: 'Approved by Alex Tan', date: isoAt(-2, 11, 30), by: currentUser.name },
        { status: 'Sent', label: 'Sent via Email', date: isoAt(-2, 11, 45), by: currentUser.name },
        { status: 'Awaiting Confirmation', label: 'Awaiting supplier confirmation', date: isoAt(-2, 11, 46), by: SYSTEM_USER },
      ],
    },
    {
      id: 'po-0140', number: 'PO-2026-0140', supplierId: 's-prime', productId: 'p-sugar', quantity: 25, unitPrice: 4.0, deliveryFee: 30,
      total: 130, status: 'Delivered', createdAt: isoAt(-12, 14, 0), expectedDelivery: isoAt(-8), leadTimeDays: 4,
      paymentTerms: 'Net 30', approvedBy: currentUser.name, approvedAt: isoAt(-12, 14, 0), sentVia: 'whatsapp', receivedQty: 25, deliveredAt: isoAt(-8, 11, 20),
      timeline: [
        { status: 'Created', label: 'Purchase order generated', date: isoAt(-12, 14, 0), by: SYSTEM_USER },
        { status: 'Approved', label: 'Approved by Alex Tan', date: isoAt(-12, 14, 0), by: currentUser.name },
        { status: 'Sent', label: 'Sent via WhatsApp', date: isoAt(-12, 14, 10), by: currentUser.name },
        { status: 'Confirmed', label: 'Supplier confirmed order', date: isoAt(-12, 16, 45), by: 'Prime Food Ingredients' },
        { status: 'Delivered', label: 'Goods received — 25 kg', date: isoAt(-8, 11, 20), by: staffUser },
      ],
    },
    {
      id: 'po-0139', number: 'PO-2026-0139', supplierId: 's-klang', productId: 'p-cups', quantity: 3000, unitPrice: 0.2, deliveryFee: 40,
      total: 640, status: 'Delivered', createdAt: isoAt(-15, 10, 2), expectedDelivery: isoAt(-11), leadTimeDays: 4,
      paymentTerms: 'Net 30', approvalId: 'apr-1001', approvedBy: currentUser.name, approvedAt: isoAt(-15, 10, 2), sentVia: 'email', receivedQty: 3000, deliveredAt: isoAt(-11, 9, 40),
      timeline: [
        { status: 'Created', label: 'Purchase order generated', date: isoAt(-15, 10, 2), by: SYSTEM_USER },
        { status: 'Approved', label: 'Approved by Alex Tan', date: isoAt(-15, 10, 2), by: currentUser.name },
        { status: 'Sent', label: 'Sent via Email', date: isoAt(-15, 10, 20), by: currentUser.name },
        { status: 'Confirmed', label: 'Supplier confirmed order', date: isoAt(-15, 13, 5), by: 'Klang Valley Packaging' },
        { status: 'Delivered', label: 'Goods received — 3,000 pcs', date: isoAt(-11, 9, 40), by: staffUser },
      ],
    },
  ]
}

export function seedMessages(): SupplierMessage[] {
  return [
    {
      id: 'msg-1', poId: 'po-0141', supplierId: 's-freshmart', direction: 'outbound', channel: 'email', simulated: true,
      subject: 'Purchase Order PO-2026-0141 — Brew & Co. Café',
      body: 'Dear Michelle,\n\nPlease find our purchase order PO-2026-0141 for 48 L Oat Milk (barista edition) at RM11.00/L. Kindly confirm availability and delivery date.\n\nThank you,\nAlex Tan\nBrew & Co. Café',
      date: isoAt(-2, 11, 45),
    },
    {
      id: 'msg-2', poId: 'po-0140', supplierId: 's-prime', direction: 'outbound', channel: 'whatsapp', simulated: true,
      body: 'Hi Siti, Brew & Co. Café here. PO-2026-0140: 25 kg Brown Sugar @ RM4.00/kg. Please confirm. Thanks!',
      date: isoAt(-12, 14, 10),
    },
    {
      id: 'msg-3', poId: 'po-0140', supplierId: 's-prime', direction: 'inbound', channel: 'whatsapp', simulated: true,
      body: 'Confirmed. Delivery in 4 working days. Thank you!',
      date: isoAt(-12, 16, 45),
    },
    {
      id: 'msg-4', poId: 'po-0139', supplierId: 's-klang', direction: 'outbound', channel: 'email', simulated: true,
      subject: 'Purchase Order PO-2026-0139 — Brew & Co. Café',
      body: 'Dear Kumar,\n\nPlease find attached PO-2026-0139 for 3,000 pcs Paper Cups 12oz at RM0.20/pc.\n\nRegards,\nAlex Tan',
      date: isoAt(-15, 10, 20),
    },
    {
      id: 'msg-5', poId: 'po-0139', supplierId: 's-klang', direction: 'inbound', channel: 'email', simulated: true,
      body: 'Order confirmed. Delivery scheduled within 4 days.',
      date: isoAt(-15, 13, 5),
    },
  ]
}

export function seedActivity(): ActivityLog[] {
  return [
    { id: 'act-s1', type: 'recommendation_created', title: 'Restock recommendation created', detail: 'Arabica Coffee Beans — 100 kg suggested to cover lead time plus 21 days of demand.', user: SYSTEM_USER, tone: 'info', date: minutesAgo(179), productId: 'p-coffee' },
    { id: 'act-s2', type: 'risk_detected', title: 'Inventory risk detected', detail: 'Arabica Coffee Beans is at its safety stock level (12 kg) with ~3 days of cover.', user: SYSTEM_USER, tone: 'critical', date: minutesAgo(180), productId: 'p-coffee' },
    { id: 'act-s3', type: 'approval_requested', title: 'Approval requested', detail: 'Fresh Milk — 390 L from FreshMart Distribution (RM2,535.00).', user: staffUser, tone: 'warning', date: minutesAgo(138), productId: 'p-milk', approvalId: 'apr-1004' },
    { id: 'act-s4', type: 'po_sent', title: 'Purchase order sent', detail: 'PO-2026-0141 sent to FreshMart Distribution via Email (demo simulation).', user: currentUser.name, tone: 'info', date: isoAt(-2, 11, 45), poId: 'po-0141' },
    { id: 'act-s5', type: 'po_generated', title: 'Purchase order generated', detail: 'PO-2026-0141 — 48 L Oat Milk from FreshMart Distribution.', user: SYSTEM_USER, tone: 'success', date: isoAt(-2, 11, 31), poId: 'po-0141' },
    { id: 'act-s6', type: 'approval_approved', title: 'Manager approved purchase', detail: 'Oat Milk — 48 L from FreshMart Distribution (RM528.00).', user: currentUser.name, tone: 'success', date: isoAt(-2, 11, 30), approvalId: 'apr-1003' },
    { id: 'act-s7', type: 'stock_adjusted', title: 'Stock adjusted', detail: 'Chocolate Syrup −1 btl (Damaged).', user: staffUser, tone: 'warning', date: isoAt(-1, 17, 40), productId: 'p-choc' },
    { id: 'act-s8', type: 'approval_rejected', title: 'Purchase request rejected', detail: 'Chocolate Syrup — 24 btl from Prime Food Ingredients. Reason: supplier under review.', user: currentUser.name, tone: 'critical', date: isoAt(-4, 16, 20), approvalId: 'apr-1002' },
    { id: 'act-s9', type: 'goods_received', title: 'Goods received', detail: 'PO-2026-0140 — 25 kg Brown Sugar received in full.', user: staffUser, tone: 'success', date: isoAt(-8, 11, 20), poId: 'po-0140' },
    { id: 'act-s10', type: 'goods_received', title: 'Goods received', detail: 'PO-2026-0139 — 3,000 pcs Paper Cups 12oz received in full.', user: staffUser, tone: 'success', date: isoAt(-11, 9, 40), poId: 'po-0139' },
  ]
}

export function seedNotifications(): AppNotification[] {
  return [
    { id: 'n-1', title: 'Coffee beans at safety stock', body: 'Arabica Coffee Beans has ~3 days of cover left.', link: '/app/forecasting?product=p-coffee', read: false, date: minutesAgo(180), tone: 'critical' },
    { id: 'n-2', title: 'Approval waiting', body: 'Fresh Milk — 390 L from FreshMart Distribution.', link: '/app/approvals', read: false, date: minutesAgo(138), tone: 'warning' },
    { id: 'n-3', title: 'PO awaiting supplier', body: 'PO-2026-0141 has not been confirmed yet.', link: '/app/purchase-orders?po=po-0141', read: true, date: isoAt(-1, 9, 0), tone: 'info' },
  ]
}

export const defaultSettings: AppSettings = {
  coverageDays: 21,
  defaultSafetyDays: 3,
  balancedWeights: { price: 35, delivery: 30, reliability: 20, quality: 10, compatibility: 5 },
  notifications: { stockAlerts: true, approvalRequests: true, supplierResponses: true, dailyDigest: false },
  approval: { dualApprovalThreshold: 10000, requireRejectionReason: true },
}

export const NEXT_PO_NUMBER = 142
export const NEXT_APPROVAL_NUMBER = 1005
