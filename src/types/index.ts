// Domain model for SupplyWise AI. These interfaces mirror what a future backend API would return.

export interface Business {
  id: string
  name: string
  registrationNo: string
  industry: string
  address: string
  city: string
  state: string
  phone: string
  email: string
  currency: 'MYR'
}

export interface User {
  id: string
  name: string
  role: 'Manager' | 'Store Staff' | 'Owner'
  email: string
  initials: string
}

export type ProductCategory = 'Coffee' | 'Dairy' | 'Sweeteners' | 'Packaging' | 'Tea' | 'Syrups'

export type ProductIcon = 'coffee' | 'milk' | 'sugar' | 'cup' | 'matcha' | 'syrup' | 'oat' | 'tea'

export interface ReorderSettings {
  /** Stock level at which a restock recommendation is drafted */
  triggerLevel: number
  /** null = use the calculated suggestion */
  reorderQty: number | null
  preferredSupplierId: string
  leadTimeDays: number
  safetyStock: number
  /** Draft a recommendation automatically when the trigger is reached. Never bypasses approval. */
  autoDraft: boolean
}

export interface Product {
  id: string
  sku: string
  name: string
  category: ProductCategory
  unit: string
  icon: ProductIcon
  description: string
  currentStock: number
  unitCost: number
  /** Menu-costing assumption: gross profit generated per unit consumed (used for profit-at-risk) */
  grossProfitPerUnit: number
  /** Daily consumption for the last 14 days, oldest first */
  usageHistory: number[]
  /** End-of-day stock for the last 14 days, oldest first (yesterday last) */
  stockHistory: number[]
  /** Rounding step for purchase quantities, e.g. 10 kg bags */
  orderMultiple: number
  reorder: ReorderSettings
  supplierIds: string[]
}

export type MovementType = 'receipt' | 'adjustment' | 'usage'

export interface InventoryMovement {
  id: string
  productId: string
  type: MovementType
  quantity: number // signed
  balanceAfter: number
  reason: string
  notes?: string
  reference?: string
  user: string
  date: string
}

export type SupplierStatus = 'Active' | 'Inactive'

export interface Supplier {
  id: string
  name: string
  initials: string
  brandColor: string
  category: string
  location: string
  state: string
  contactName: string
  phone: string
  email: string
  whatsapp: string
  reliability: number // % on-time, in-full deliveries
  qualityRating: number // out of 5
  avgDeliveryDays: number
  status: SupplierStatus
  preferred: boolean
  website: string
  address: string
  onTimeRate: number // % delivered on or before promised date
  completedOrders: number
  /** Added during the demo — no performance history yet */
  isNew?: boolean
  paymentTerms: string
  since: number
  about: string
  /** Approximate road distance in km from business (Bangsar, KL) — Track 03A */
  distanceKm?: number
}

export interface SupplierProduct {
  supplierId: string
  productId: string
  unitPrice: number
  moq: number
  leadTimeDays: number
  deliveryFee: number
}

export interface LandedCostBreakdown {
  subtotal: number
  deliveryFee: number
  totalLandedCost: number
  landedUnitCost: number
  baselineUnitCost?: number
  costVariance?: number // savings (-) or premium (+) vs baseline
  costVariancePct?: number
}

export interface Quotation {
  id: string
  supplierId: string
  productId: string
  quantity: number
  unitPrice: number
  subtotal: number
  deliveryFee: number
  total: number
  leadTimeDays: number
  moq: number
  paymentTerms: string
  expiresAt: string
  issuedAt: string
  /** Detailed landed cost breakdown — Track 03A */
  landedCost?: LandedCostBreakdown
  /** Distance in km from business location — Track 03A */
  distanceKm?: number
  /** Whether requested quantity meets or exceeds MOQ — Track 03A */
  meetsMoq?: boolean
  /** Quick comparison highlight tags — Track 03A */
  tags?: ('cheapest' | 'nearest' | 'fastest' | 'best-value')[]
}

export interface DiscoveryQuery {
  productId?: string
  query?: string
  category?: ProductCategory | string
  quantity?: number
  maxDistanceKm?: number
  maxLeadTimeDays?: number
  mustMeetMoq?: boolean
}

export interface DiscoveredSupplierQuote {
  quotation: Quotation
  supplier: Supplier
  product?: Product
  supplierProduct?: SupplierProduct
  distanceKm: number
  meetsMoq: boolean
  moqShortfall: number
  landedCost: LandedCostBreakdown
  tags: ('cheapest' | 'nearest' | 'fastest' | 'best-value')[]
}

export interface ComparisonHighlights {
  cheapestSupplierId?: string
  nearestSupplierId?: string
  fastestSupplierId?: string
  highestReliabilitySupplierId?: string
}

export type RiskLevel = 'High' | 'Medium' | 'Low'

export interface ProcurementRecommendation {
  id: string
  productId: string
  quantity: number
  supplierId: string
  score: number
  estimatedCost: number
  risk: RiskLevel
  explanation: string
  stockoutDate: string
}

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected'
export type ApprovalKind = 'purchase' | 'supplier-change'

export interface ApprovalRequest {
  id: string
  kind: ApprovalKind
  status: ApprovalStatus
  productId: string
  quantity: number
  supplierId: string
  unitPrice: number
  deliveryFee: number
  total: number
  leadTimeDays: number
  score: number
  priority: ScoringPriority
  reason: string
  requestedBy: string
  requestedAt: string
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
  overrideReason?: string
  /** For supplier-change approvals, the PO being amended */
  poId?: string
  /** Resulting PO when approved */
  resultingPoId?: string
}

export type POStatus =
  | 'Draft'
  | 'Approved'
  | 'Sent'
  | 'Awaiting Confirmation'
  | 'Confirmed'
  | 'Changes Requested'
  | 'Delivered'
  | 'Cancelled'

export interface POTimelineEvent {
  status: POStatus | 'Created'
  label: string
  date: string
  by: string
}

export interface ProposedChanges {
  unitPrice: number
  quantity: number
  leadTimeDays: number
  note: string
}

export interface PurchaseOrder {
  id: string
  number: string
  supplierId: string
  productId: string
  quantity: number
  unitPrice: number
  deliveryFee: number
  total: number
  status: POStatus
  createdAt: string
  expectedDelivery: string
  leadTimeDays: number
  paymentTerms: string
  approvalId?: string
  approvedBy?: string
  approvedAt?: string
  sentVia?: 'email' | 'whatsapp'
  receivedQty?: number
  deliveredAt?: string
  cancelReason?: string
  declinedBySupplier?: boolean
  proposedChanges?: ProposedChanges
  timeline: POTimelineEvent[]
}

export interface SupplierMessage {
  id: string
  poId: string
  supplierId: string
  direction: 'outbound' | 'inbound'
  channel: 'email' | 'whatsapp' | 'system'
  subject?: string
  body: string
  date: string
  simulated: boolean
}

export type ActivityType =
  | 'risk_detected'
  | 'recommendation_created'
  | 'quotations_compared'
  | 'approval_requested'
  | 'approval_approved'
  | 'approval_rejected'
  | 'approval_modified'
  | 'po_generated'
  | 'po_sent'
  | 'supplier_confirmed'
  | 'supplier_changes'
  | 'supplier_declined'
  | 'goods_received'
  | 'inventory_updated'
  | 'stock_adjusted'
  | 'settings_updated'
  | 'recommendation_dismissed'

export type ActivityTone = 'info' | 'success' | 'warning' | 'critical'

export interface ActivityLog {
  id: string
  type: ActivityType
  title: string
  detail: string
  user: string
  tone: ActivityTone
  date: string
  productId?: string
  poId?: string
  approvalId?: string
}

export interface AppNotification {
  id: string
  title: string
  body: string
  link?: string
  read: boolean
  date: string
  tone: ActivityTone
}

export type ScoringPriority = 'balanced' | 'cost' | 'delivery' | 'reliability'

export interface ScoringWeights {
  price: number
  delivery: number
  reliability: number
  quality: number
  compatibility: number
}

export interface AppSettings {
  coverageDays: number
  defaultSafetyDays: number
  balancedWeights: ScoringWeights
  notifications: {
    stockAlerts: boolean
    approvalRequests: boolean
    supplierResponses: boolean
    dailyDigest: boolean
  }
  approval: {
    dualApprovalThreshold: number
    requireRejectionReason: boolean
  }
}
