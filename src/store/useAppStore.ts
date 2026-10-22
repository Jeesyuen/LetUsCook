// Single source of truth for the demo. Persisted to localStorage so demo changes survive refreshes.
// Each action mirrors an API call a future backend would expose.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  business as seedBusiness,
  currentUser,
  defaultSettings,
  NEXT_APPROVAL_NUMBER,
  NEXT_PO_NUMBER,
  seedActivity,
  seedApprovals,
  seedMessages,
  seedNotifications,
  seedProductsAndMovements,
  seedPurchaseOrders,
  seedQuotationHistory,
  SYSTEM_USER,
  type QuotationHistoryEntry,
} from '@/data/mockData'
import { setCustomSuppliers } from '@/data/supplierRegistry'
import { composePOMessage, simulatedChangeRequest, supplierReplies, type Channel } from '@/services/communication'
import { computeForecast } from '@/services/forecasting'
import { buildQuotations, getSupplier, priorityLabels, scoreQuotations, weightsFor } from '@/services/scoring'
import type {
  ActivityLog,
  ActivityTone,
  ActivityType,
  AppNotification,
  AppSettings,
  ApprovalRequest,
  Business,
  InventoryMovement,
  POStatus,
  Product,
  PurchaseOrder,
  ReorderSettings,
  ScoringPriority,
  Supplier,
  SupplierMessage,
  User,
} from '@/types'
import { addDays, formatDate, nowIso, startOfToday } from '@/utils/date'
import { formatQty, formatRM, round, uid } from '@/utils/format'

export const OPEN_PO_STATUSES: POStatus[] = ['Approved', 'Sent', 'Awaiting Confirmation', 'Confirmed', 'Changes Requested']

interface DemoData {
  business: Business
  user: User
  products: Product[]
  movements: InventoryMovement[]
  approvals: ApprovalRequest[]
  purchaseOrders: PurchaseOrder[]
  messages: SupplierMessage[]
  activity: ActivityLog[]
  notifications: AppNotification[]
  quotationHistory: QuotationHistoryEntry[]
  settings: AppSettings
  dismissedRecs: string[]
  customSuppliers: Supplier[]
  nextPo: number
  nextApproval: number
}

export interface PurchaseRequestInput {
  productId: string
  quantity: number
  supplierId: string
  priority: ScoringPriority
  reason: string
  overrideReason?: string
  /** Compatibility from the supplier matching engine ; falls back to the legacy quotation score */
  score?: number
}

export interface NewProductInput {
  name: string
  sku: string
  category: Product['category']
  unit: string
  icon: Product['icon']
  description: string
  currentStock: number
  dailyUsage: number
  unitCost: number
  grossProfitPerUnit: number
  safetyStock: number
  leadTimeDays: number
  preferredSupplierId: string
  orderMultiple: number
}

interface Actions {
  addProduct: (input: NewProductInput) => string
  addSupplier: (input: Omit<Supplier, 'id' | 'initials' | 'brandColor' | 'reliability' | 'qualityRating' | 'onTimeRate' | 'completedOrders' | 'isNew' | 'since'>) => string
  adjustStock: (productId: string, physicalCount: number, reason: string, notes?: string) => void
  updateReorderSettings: (productId: string, settings: ReorderSettings) => void
  requestApproval: (input: PurchaseRequestInput) => string
  updateApproval: (id: string, patch: { quantity?: number; supplierId?: string; overrideReason?: string }) => void
  approve: (id: string, note?: string) => string | undefined
  reject: (id: string, reason: string) => void
  sendPO: (poId: string, channel: Channel) => void
  supplierRespond: (poId: string, response: 'accept' | 'changes' | 'decline') => void
  recordDelivery: (poId: string, receivedQty: number, notes?: string) => void
  cancelPO: (poId: string, reason: string) => void
  dismissRecommendation: (productId: string) => void
  restoreRecommendations: () => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  updateSettings: (patch: Partial<AppSettings>) => void
  updateBusiness: (patch: Partial<Business>) => void
  resetDemo: () => void
}

export type AppState = DemoData & Actions

function seed(): DemoData {
  const { products, movements } = seedProductsAndMovements()
  const approvals = seedApprovals().map((a) => {
    const ranked = scoreQuotations(buildQuotations(a.productId, a.quantity), weightsFor(a.priority, defaultSettings.balancedWeights))
    return { ...a, score: ranked.find((r) => r.supplier.id === a.supplierId)?.score ?? 0 }
  })
  return {
    business: seedBusiness,
    user: currentUser,
    products,
    movements,
    approvals,
    purchaseOrders: seedPurchaseOrders(),
    messages: seedMessages(),
    activity: seedActivity(),
    notifications: seedNotifications(),
    quotationHistory: seedQuotationHistory(),
    settings: defaultSettings,
    dismissedRecs: [],
    customSuppliers: [],
    nextPo: NEXT_PO_NUMBER,
    nextApproval: NEXT_APPROVAL_NUMBER,
  }
}

const productName = (s: DemoData, id: string) => s.products.find((p) => p.id === id)?.name ?? 'Unknown item'
const productUnit = (s: DemoData, id: string) => s.products.find((p) => p.id === id)?.unit ?? ''

function activity(type: ActivityType, title: string, detail: string, tone: ActivityTone, user: string, refs: Partial<ActivityLog> = {}): ActivityLog {
  return { id: uid('act'), type, title, detail, tone, user, date: nowIso(), ...refs }
}

function notification(title: string, body: string, tone: ActivityTone, link?: string): AppNotification {
  return { id: uid('n'), title, body, tone, link, read: false, date: nowIso() }
}

/** Raises a risk activity + notification when a product newly becomes Critical / Out of Stock. */
function riskEvents(s: DemoData, before: Product, after: Product): { acts: ActivityLog[]; notes: AppNotification[] } {
  const fb = computeForecast(before, s.settings.coverageDays)
  const fa = computeForecast(after, s.settings.coverageDays)
  if (fa.risk === 'High' && fb.risk !== 'High') {
    return {
      acts: [activity('risk_detected', 'Inventory risk detected', `${after.name} is now ${fa.status.toLowerCase()} with ~${fa.daysRemaining} days of cover.`, 'critical', SYSTEM_USER, { productId: after.id })],
      notes: s.settings.notifications.stockAlerts ? [notification(`${after.name} at risk`, `${fa.status} — about ${fa.daysRemaining} days of cover left.`, 'critical', `/app/forecasting?product=${after.id}`)] : [],
    }
  }
  return { acts: [], notes: [] }
}

function priceRequest(productId: string, quantity: number, supplierId: string, priority: ScoringPriority, settings: AppSettings) {
  const quotes = buildQuotations(productId, quantity)
  const ranked = scoreQuotations(quotes, weightsFor(priority, settings.balancedWeights))
  const mine = ranked.find((r) => r.supplier.id === supplierId)
  const q = mine?.quotation ?? quotes[0]
  return { quote: q, score: mine?.score ?? 0, ranked }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...seed(),

      addProduct: (input) => {
        const s = get()
        const id = uid('p')
        const product: Product = {
          id, sku: input.sku, name: input.name, category: input.category, unit: input.unit, icon: input.icon, description: input.description,
          currentStock: input.currentStock, unitCost: input.unitCost, grossProfitPerUnit: input.grossProfitPerUnit, orderMultiple: Math.max(1, input.orderMultiple),
          // New items have no history yet: a single baseline usage value drives a simple baseline forecast
          usageHistory: input.dailyUsage > 0 ? [input.dailyUsage] : [],
          stockHistory: [],
          supplierIds: input.preferredSupplierId ? [input.preferredSupplierId] : [],
          reorder: {
            triggerLevel: round(input.dailyUsage * input.leadTimeDays + input.safetyStock, 1), reorderQty: null,
            preferredSupplierId: input.preferredSupplierId, leadTimeDays: input.leadTimeDays, safetyStock: input.safetyStock, autoDraft: true,
          },
        }
        set({
          products: [...s.products, product],
          movements: [{ id: uid('mv'), productId: id, type: 'adjustment', quantity: input.currentStock, balanceAfter: input.currentStock, reason: 'Opening balance', user: s.user.name, date: nowIso() }, ...s.movements],
          activity: [activity('stock_adjusted', 'Product added', `${input.name} (${input.sku}) added with ${formatQty(input.currentStock, input.unit)} opening stock.`, 'info', s.user.name, { productId: id }), ...s.activity],
        })
        return id
      },

      addSupplier: (input) => {
        const s = get()
        const id = uid('s')
        const initials = input.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'SP'
        const supplier: Supplier = { ...input, id, initials, brandColor: '#4169FF', reliability: 0, qualityRating: 0, onTimeRate: 0, completedOrders: 0, isNew: true, since: new Date().getFullYear() }
        const customSuppliers = [...s.customSuppliers, supplier]
        setCustomSuppliers(customSuppliers)
        set({
          customSuppliers,
          activity: [activity('settings_updated', 'Supplier added', `${supplier.name} (${supplier.location}) added to the supplier directory.`, 'info', s.user.name), ...s.activity],
        })
        return id
      },

      adjustStock: (productId, physicalCount, reason, notes) =>
        set((s) => {
          const before = s.products.find((p) => p.id === productId)
          if (!before) return s
          const diff = round(physicalCount - before.currentStock, 2)
          const after = { ...before, currentStock: physicalCount }
          const mv: InventoryMovement = {
            id: uid('mv'), productId, type: 'adjustment', quantity: diff, balanceAfter: physicalCount, reason, notes, user: s.user.name, date: nowIso(),
          }
          const { acts, notes: ns } = riskEvents(s, before, after)
          const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±'
          return {
            products: s.products.map((p) => (p.id === productId ? after : p)),
            movements: [mv, ...s.movements],
            activity: [
              ...acts,
              activity('stock_adjusted', 'Stock adjusted', `${before.name} ${sign}${formatQty(Math.abs(diff), before.unit)} (${reason}). New balance ${formatQty(physicalCount, before.unit)}.`, diff < 0 ? 'warning' : 'info', s.user.name, { productId }),
              ...s.activity,
            ],
            notifications: [...ns, ...s.notifications],
            dismissedRecs: s.dismissedRecs.filter((id) => id !== productId),
          }
        }),

      updateReorderSettings: (productId, settings) =>
        set((s) => {
          const before = s.products.find((p) => p.id === productId)
          if (!before) return s
          const after = { ...before, reorder: settings }
          const { acts, notes } = riskEvents(s, before, after)
          return {
            products: s.products.map((p) => (p.id === productId ? after : p)),
            activity: [
              ...acts,
              activity('settings_updated', 'Reorder settings updated', `${before.name}: trigger ${formatQty(settings.triggerLevel, before.unit)}, safety stock ${formatQty(settings.safetyStock, before.unit)}, lead time ${settings.leadTimeDays} days, preferred supplier ${getSupplier(settings.preferredSupplierId).name}.`, 'info', s.user.name, { productId }),
              ...s.activity,
            ],
            notifications: [...notes, ...s.notifications],
          }
        }),

      requestApproval: (input) => {
        const s = get()
        const { quote, score, ranked } = priceRequest(input.productId, input.quantity, input.supplierId, input.priority, s.settings)
        const id = `apr-${s.nextApproval}`
        const supplier = getSupplier(input.supplierId)
        const approval: ApprovalRequest = {
          id, kind: 'purchase', status: 'Pending', productId: input.productId, quantity: input.quantity, supplierId: input.supplierId,
          unitPrice: quote.unitPrice, deliveryFee: quote.deliveryFee, total: quote.total, leadTimeDays: quote.leadTimeDays, score: input.score ?? score,
          priority: input.priority, reason: input.reason, overrideReason: input.overrideReason, requestedBy: s.user.name, requestedAt: nowIso(),
        }
        const name = productName(s, input.productId)
        const unit = productUnit(s, input.productId)
        const top = ranked[0]
        set({
          nextApproval: s.nextApproval + 1,
          approvals: [approval, ...s.approvals],
          activity: [
            activity('approval_requested', 'Approval requested', `${name} — ${formatQty(input.quantity, unit)} from ${supplier.name} (${formatRM(quote.total)}).`, 'warning', s.user.name, { productId: input.productId, approvalId: id }),
            activity('quotations_compared', 'Supplier quotations compared', `${ranked.length} quotations for ${formatQty(input.quantity, unit)} ${name} scored (${priorityLabels[input.priority]}). Top: ${top?.supplier.name} at ${top?.score}%.${input.overrideReason ? ` Override: ${input.overrideReason}` : ''}`, 'info', SYSTEM_USER, { productId: input.productId }),
            ...s.activity,
          ],
          notifications: s.settings.notifications.approvalRequests
            ? [notification('New approval request', `${name} — ${formatQty(input.quantity, unit)} from ${supplier.name}.`, 'warning', '/app/approvals'), ...s.notifications]
            : s.notifications,
        })
        return id
      },

      updateApproval: (id, patch) =>
        set((s) => {
          const a = s.approvals.find((x) => x.id === id)
          if (!a || a.status !== 'Pending') return s
          const quantity = patch.quantity ?? a.quantity
          const supplierId = patch.supplierId ?? a.supplierId
          const { quote, score, ranked } = priceRequest(a.productId, quantity, supplierId, a.priority, s.settings)
          const rank = ranked.findIndex((r) => r.supplier.id === supplierId) + 1
          const reason =
            supplierId !== a.supplierId
              ? `Manager override: switched from ${getSupplier(a.supplierId).name} to ${getSupplier(supplierId).name} (ranked #${rank} of ${ranked.length}, ${score}% compatibility, ${quote.leadTimeDays}-day delivery).`
              : a.reason
          const updated: ApprovalRequest = {
            ...a, quantity, supplierId, reason, unitPrice: quote.unitPrice, deliveryFee: quote.deliveryFee, total: quote.total,
            leadTimeDays: quote.leadTimeDays, score, overrideReason: patch.overrideReason ?? a.overrideReason,
          }
          const changes: string[] = []
          if (quantity !== a.quantity) changes.push(`quantity ${formatQty(a.quantity)} → ${formatQty(quantity, productUnit(s, a.productId))}`)
          if (supplierId !== a.supplierId) changes.push(`supplier ${getSupplier(a.supplierId).name} → ${getSupplier(supplierId).name}`)
          return {
            approvals: s.approvals.map((x) => (x.id === id ? updated : x)),
            activity: [
              activity('approval_modified', 'Approval request modified', `${productName(s, a.productId)}: ${changes.join(', ') || 'details updated'}. New total ${formatRM(quote.total)}.${patch.overrideReason ? ` Reason: ${patch.overrideReason}` : ''}`, 'info', s.user.name, { approvalId: id, productId: a.productId }),
              ...s.activity,
            ],
          }
        }),

      approve: (id, note) => {
        const s = get()
        const a = s.approvals.find((x) => x.id === id)
        if (!a || a.status !== 'Pending') return
        const now = nowIso()
        const name = productName(s, a.productId)
        const unit = productUnit(s, a.productId)
        const supplier = getSupplier(a.supplierId)

        if (a.kind === 'supplier-change' && a.poId) {
          set({
            approvals: s.approvals.map((x) => (x.id === id ? { ...x, status: 'Approved', decidedBy: s.user.name, decidedAt: now, decisionNote: note } : x)),
            purchaseOrders: s.purchaseOrders.map((po) =>
              po.id === a.poId
                ? {
                    ...po, quantity: a.quantity, unitPrice: a.unitPrice, total: a.total, leadTimeDays: a.leadTimeDays,
                    expectedDelivery: addDays(startOfToday(), a.leadTimeDays).toISOString(), status: 'Confirmed', proposedChanges: undefined,
                    timeline: [...po.timeline, { status: 'Confirmed', label: 'Revised terms approved — order confirmed', date: now, by: s.user.name }],
                  }
                : po,
            ),
            activity: [
              activity('supplier_confirmed', 'Revised terms approved', `${supplier.name}'s revised terms accepted. Order confirmed at ${formatRM(a.total)}.`, 'success', s.user.name, { poId: a.poId, approvalId: id }),
              ...s.activity,
            ],
          })
          return a.poId
        }

        const poId = uid('po')
        const number = `PO-${new Date().getFullYear()}-${String(s.nextPo).padStart(4, '0')}`
        const po: PurchaseOrder = {
          id: poId, number, supplierId: a.supplierId, productId: a.productId, quantity: a.quantity, unitPrice: a.unitPrice,
          deliveryFee: a.deliveryFee, total: a.total, status: 'Approved', createdAt: now,
          expectedDelivery: addDays(startOfToday(), a.leadTimeDays).toISOString(), leadTimeDays: a.leadTimeDays,
          paymentTerms: supplier.paymentTerms, approvalId: id, approvedBy: s.user.name, approvedAt: now,
          timeline: [
            { status: 'Approved', label: `Approved by ${s.user.name}`, date: now, by: s.user.name },
            { status: 'Created', label: 'Purchase order generated', date: now, by: SYSTEM_USER },
          ],
        }
        set({
          nextPo: s.nextPo + 1,
          approvals: s.approvals.map((x) => (x.id === id ? { ...x, status: 'Approved', decidedBy: s.user.name, decidedAt: now, decisionNote: note, resultingPoId: poId } : x)),
          purchaseOrders: [po, ...s.purchaseOrders],
          activity: [
            activity('po_generated', 'Purchase order generated', `${number} — ${formatQty(a.quantity, unit)} ${name} from ${supplier.name}. Ready to send.`, 'success', SYSTEM_USER, { poId, productId: a.productId }),
            activity('approval_approved', 'Manager approved purchase', `${name} — ${formatQty(a.quantity, unit)} from ${supplier.name} (${formatRM(a.total)}).${note ? ` Note: ${note}` : ''}`, 'success', s.user.name, { approvalId: id, productId: a.productId }),
            ...s.activity,
          ],
        })
        return poId
      },

      reject: (id, reason) =>
        set((s) => {
          const a = s.approvals.find((x) => x.id === id)
          if (!a || a.status !== 'Pending') return s
          const now = nowIso()
          const supplier = getSupplier(a.supplierId)
          return {
            approvals: s.approvals.map((x) => (x.id === id ? { ...x, status: 'Rejected', decidedBy: s.user.name, decidedAt: now, decisionNote: reason } : x)),
            purchaseOrders:
              a.kind === 'supplier-change' && a.poId
                ? s.purchaseOrders.map((po) =>
                    po.id === a.poId
                      ? { ...po, status: 'Cancelled', cancelReason: `Revised supplier terms rejected: ${reason}`, proposedChanges: undefined, timeline: [...po.timeline, { status: 'Cancelled', label: 'Revised terms rejected — PO cancelled', date: now, by: s.user.name }] }
                      : po,
                  )
                : s.purchaseOrders,
            activity: [
              activity('approval_rejected', a.kind === 'supplier-change' ? 'Revised terms rejected' : 'Purchase request rejected', `${productName(s, a.productId)} — ${formatQty(a.quantity, productUnit(s, a.productId))} from ${supplier.name}. Reason: ${reason || 'not specified'}. No purchase order issued.`, 'critical', s.user.name, { approvalId: id, productId: a.productId, poId: a.poId }),
              ...s.activity,
            ],
          }
        }),

      sendPO: (poId, channel) => {
        const s = get()
        const po = s.purchaseOrders.find((p) => p.id === poId)
        if (!po || po.status !== 'Approved') return
        const supplier = getSupplier(po.supplierId)
        const product = s.products.find((p) => p.id === po.productId)!
        const msg = composePOMessage(channel, po, supplier, product, s.business, s.user)
        const now = nowIso()
        const label = channel === 'email' ? 'Email' : 'WhatsApp'
        set({
          purchaseOrders: s.purchaseOrders.map((p) =>
            p.id === poId ? { ...p, status: 'Sent', sentVia: channel, timeline: [...p.timeline, { status: 'Sent', label: `Sent via ${label} (demo simulation)`, date: now, by: s.user.name }] } : p,
          ),
          messages: [{ id: uid('msg'), poId, supplierId: po.supplierId, direction: 'outbound', channel, subject: msg.subject, body: msg.body, date: now, simulated: true }, ...s.messages],
          activity: [activity('po_sent', 'Purchase order sent', `${po.number} sent to ${supplier.name} via ${label} (demo simulation — no message delivered).`, 'info', s.user.name, { poId, productId: po.productId }), ...s.activity],
        })
        // Simulated delivery receipt from the channel
        setTimeout(() => {
          set((st) => ({
            purchaseOrders: st.purchaseOrders.map((p) =>
              p.id === poId && p.status === 'Sent'
                ? { ...p, status: 'Awaiting Confirmation', timeline: [...p.timeline, { status: 'Awaiting Confirmation', label: 'Delivered to supplier — awaiting confirmation', date: nowIso(), by: SYSTEM_USER }] }
                : p,
            ),
          }))
        }, 1600)
      },

      supplierRespond: (poId, response) =>
        set((s) => {
          const po = s.purchaseOrders.find((p) => p.id === poId)
          if (!po || !['Sent', 'Awaiting Confirmation'].includes(po.status)) return s
          const supplier = getSupplier(po.supplierId)
          const product = s.products.find((p) => p.id === po.productId)!
          const now = nowIso()
          const channel = po.sentVia ?? 'email'
          const inbound = (body: string): SupplierMessage => ({ id: uid('msg'), poId, supplierId: po.supplierId, direction: 'inbound', channel, body, date: now, simulated: true })
          const notes = (title: string, body: string, tone: ActivityTone, link: string) =>
            s.settings.notifications.supplierResponses ? [notification(title, body, tone, link), ...s.notifications] : s.notifications

          if (response === 'accept') {
            const expectedDelivery = addDays(startOfToday(), po.leadTimeDays).toISOString()
            const confirmed = { ...po, expectedDelivery }
            return {
              purchaseOrders: s.purchaseOrders.map((p) =>
                p.id === poId ? { ...confirmed, status: 'Confirmed', timeline: [...p.timeline, { status: 'Confirmed', label: `${supplier.name} confirmed the order`, date: now, by: supplier.name }] } : p,
              ),
              messages: [inbound(supplierReplies.accept(confirmed)), ...s.messages],
              activity: [activity('supplier_confirmed', 'Supplier confirmed', `${supplier.name} accepted ${po.number}. Delivery expected ${formatDate(expectedDelivery)}.`, 'success', supplier.name, { poId, productId: po.productId }), ...s.activity],
              notifications: notes(`${po.number} confirmed`, `${supplier.name} accepted the order.`, 'success', `/app/purchase-orders?po=${poId}`),
            }
          }

          if (response === 'changes') {
            const changes = simulatedChangeRequest(po, product)
            const total = round(changes.unitPrice * changes.quantity + po.deliveryFee, 2)
            const aprId = `apr-${s.nextApproval}`
            const approval: ApprovalRequest = {
              id: aprId, kind: 'supplier-change', status: 'Pending', productId: po.productId, quantity: changes.quantity, supplierId: po.supplierId,
              unitPrice: changes.unitPrice, deliveryFee: po.deliveryFee, total, leadTimeDays: changes.leadTimeDays, score: 0, priority: 'balanced',
              reason: `${supplier.name} requested changes to ${po.number}: ${changes.note}`, requestedBy: supplier.name, requestedAt: now, poId,
            }
            return {
              nextApproval: s.nextApproval + 1,
              approvals: [approval, ...s.approvals],
              purchaseOrders: s.purchaseOrders.map((p) =>
                p.id === poId ? { ...p, status: 'Changes Requested', proposedChanges: changes, timeline: [...p.timeline, { status: 'Changes Requested', label: `${supplier.name} requested changes — re-approval needed`, date: now, by: supplier.name }] } : p,
              ),
              messages: [inbound(changes.note), ...s.messages],
              activity: [activity('supplier_changes', 'Supplier requested changes', `${supplier.name} proposed new terms for ${po.number} (${formatRM(total)}). Manager re-approval required.`, 'warning', supplier.name, { poId, approvalId: aprId, productId: po.productId }), ...s.activity],
              notifications: notes(`Changes requested on ${po.number}`, 'Revised terms need your approval.', 'warning', '/app/approvals'),
            }
          }

          return {
            purchaseOrders: s.purchaseOrders.map((p) =>
              p.id === poId
                ? { ...p, status: 'Cancelled', declinedBySupplier: true, cancelReason: 'Declined by supplier — insufficient stock', timeline: [...p.timeline, { status: 'Cancelled', label: `${supplier.name} declined the order`, date: now, by: supplier.name }] }
                : p,
            ),
            messages: [inbound(supplierReplies.decline(po)), ...s.messages],
            activity: [activity('supplier_declined', 'Supplier declined order', `${supplier.name} declined ${po.number}. Select another supplier to continue.`, 'critical', supplier.name, { poId, productId: po.productId }), ...s.activity],
            notifications: notes(`${po.number} declined`, `${supplier.name} cannot fulfil this order.`, 'critical', `/app/purchase-orders?po=${poId}`),
          }
        }),

      recordDelivery: (poId, receivedQty, notes) =>
        set((s) => {
          const po = s.purchaseOrders.find((p) => p.id === poId)
          if (!po || po.status !== 'Confirmed' || receivedQty <= 0) return s
          const product = s.products.find((p) => p.id === po.productId)!
          const now = nowIso()
          const newStock = round(product.currentStock + receivedQty, 2)
          const updatedProduct = { ...product, currentStock: newStock }
          const f = computeForecast(updatedProduct, s.settings.coverageDays)
          const short = receivedQty < po.quantity
          return {
            products: s.products.map((p) => (p.id === product.id ? updatedProduct : p)),
            movements: [
              { id: uid('mv'), productId: product.id, type: 'receipt', quantity: receivedQty, balanceAfter: newStock, reason: 'Goods received', notes, reference: po.number, user: s.user.name, date: now },
              ...s.movements,
            ],
            purchaseOrders: s.purchaseOrders.map((p) =>
              p.id === poId
                ? { ...p, status: 'Delivered', receivedQty, deliveredAt: now, timeline: [...p.timeline, { status: 'Delivered', label: `Goods received — ${formatQty(receivedQty, product.unit)}${short ? ' (partial)' : ''}`, date: now, by: s.user.name }] }
                : p,
            ),
            activity: [
              activity('inventory_updated', 'Inventory updated', `${product.name}: ${formatQty(product.currentStock, product.unit)} → ${formatQty(newStock, product.unit)}. Forecast now ${f.daysRemaining} days of cover (${f.status}).`, 'success', SYSTEM_USER, { productId: product.id, poId }),
              activity('goods_received', 'Goods received', `${po.number} — ${formatQty(receivedQty, product.unit)} of ${formatQty(po.quantity, product.unit)} ${product.name} received${short ? ' (short delivery)' : ' in full'}.${notes ? ` ${notes}` : ''}`, short ? 'warning' : 'success', s.user.name, { poId, productId: product.id }),
              ...s.activity,
            ],
            dismissedRecs: s.dismissedRecs.filter((id) => id !== product.id),
          }
        }),

      cancelPO: (poId, reason) =>
        set((s) => {
          const po = s.purchaseOrders.find((p) => p.id === poId)
          if (!po || ['Delivered', 'Cancelled'].includes(po.status)) return s
          const now = nowIso()
          return {
            purchaseOrders: s.purchaseOrders.map((p) => (p.id === poId ? { ...p, status: 'Cancelled', cancelReason: reason, timeline: [...p.timeline, { status: 'Cancelled', label: 'Cancelled by manager', date: now, by: s.user.name }] } : p)),
            activity: [activity('approval_rejected', 'Purchase order cancelled', `${po.number} cancelled. Reason: ${reason}`, 'critical', s.user.name, { poId }), ...s.activity],
          }
        }),

      dismissRecommendation: (productId) =>
        set((s) => ({
          dismissedRecs: [...s.dismissedRecs, productId],
          activity: [activity('recommendation_dismissed', 'Recommendation dismissed', `Restock recommendation for ${productName(s, productId)} dismissed.`, 'info', s.user.name, { productId }), ...s.activity],
        })),

      restoreRecommendations: () => set({ dismissedRecs: [] }),

      markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      updateSettings: (patch) =>
        set((s) => ({
          settings: { ...s.settings, ...patch },
          activity: [activity('settings_updated', 'Settings updated', `Updated ${Object.keys(patch).join(', ')}.`, 'info', s.user.name), ...s.activity],
        })),

      updateBusiness: (patch) => set((s) => ({ business: { ...s.business, ...patch } })),

      resetDemo: () => {
        setCustomSuppliers([])
        set(seed())
      },
    }),
    {
      name: 'supplywise-demo',
      version: 2,
      // Older persisted shapes are discarded and the demo is re-seeded
      migrate: () => seed() as unknown as AppState,
      partialize: (s) => {
        const { business, user, products, movements, approvals, purchaseOrders, messages, activity, notifications, quotationHistory, settings, dismissedRecs, customSuppliers, nextPo, nextApproval } = s
        return { business, user, products, movements, approvals, purchaseOrders, messages, activity, notifications, quotationHistory, settings, dismissedRecs, customSuppliers, nextPo, nextApproval }
      },
      onRehydrateStorage: () => (state) => {
        // A PO left in "Sent" (e.g. refreshed mid-simulation) moves on to awaiting confirmation.
        if (state) {
          setCustomSuppliers(state.customSuppliers ?? [])
          const stuck = state.purchaseOrders.some((p) => p.status === 'Sent')
          if (stuck) useAppStore.setState({ purchaseOrders: state.purchaseOrders.map((p) => (p.status === 'Sent' ? { ...p, status: 'Awaiting Confirmation' } : p)) })
        }
      },
    },
  ),
)

