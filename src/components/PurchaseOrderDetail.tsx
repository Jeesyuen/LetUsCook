import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Ban, Building2, Check, CircleCheck, CircleX, Clock, Mail, MessageCircle, PackageCheck, Repeat2, ShieldCheck, TriangleAlert, Truck, X } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { getSupplier } from '@/services/scoring'
import type { POStatus, PurchaseOrder } from '@/types'
import type { Channel } from '@/services/communication'
import { POStatusBadge, ProductThumb, SupplierLogo } from './common'
import { Button } from './ui/Button'
import { Card, DemoTag, Input, Label, Textarea } from './ui/primitives'
import { ConfirmDialog, Drawer, Modal } from './ui/Overlay'
import { CommunicationPreviewModal } from './CommunicationPreviewModal'
import { formatDate, formatDateTime, relativeTime } from '@/utils/date'
import { cn, formatQty, formatRM } from '@/utils/format'

const FLOW: POStatus[] = ['Approved', 'Sent', 'Awaiting Confirmation', 'Confirmed', 'Delivered']

function StatusStepper({ po }: { po: PurchaseOrder }) {
  const idx = po.status === 'Changes Requested' ? 2 : FLOW.indexOf(po.status)
  const failed = po.status === 'Cancelled'
  return (
    <div className="flex items-center">
      {FLOW.map((s, i) => {
        const done = !failed && idx >= i
        const current = !failed && idx === i
        return (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-colors',
                  done ? 'border-primary bg-primary text-white' : 'border-line bg-white text-muted',
                  current && 'ring-4 ring-primary/15',
                )}
              >
                {done && (!current || po.status === 'Delivered') ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn('w-[72px] text-center text-[11px] leading-tight', done ? 'font-medium text-ink' : 'text-muted')}>{s === 'Awaiting Confirmation' ? 'Awaiting' : s}</span>
            </div>
            {i < FLOW.length - 1 && <div className={cn('mx-1 mb-5 h-0.5 flex-1 rounded-full', !failed && idx > i ? 'bg-primary' : 'bg-line')} />}
          </div>
        )
      })}
    </div>
  )
}

function RecordDeliveryModal({ po, open, onClose }: { po: PurchaseOrder; open: boolean; onClose: () => void }) {
  const record = useAppStore((s) => s.recordDelivery)
  const product = useAppStore((s) => s.products.find((p) => p.id === po.productId))
  const [qty, setQty] = useState(String(po.quantity))
  const [notes, setNotes] = useState('')
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    if (open) {
      setQty(String(po.quantity))
      setNotes('')
    }
  }, [open, po.quantity])
  if (!product) return null
  const q = parseFloat(qty)
  const valid = q > 0 && q <= po.quantity * 1.1
  return (
    <>
      <Modal
        open={open && !confirm}
        onClose={onClose}
        title="Record Delivery"
        description={`Goods receipt for ${po.number}. Inventory increases only after you confirm.`}
        icon={<PackageCheck className="h-5 w-5" />}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => setConfirm(true)} disabled={!valid}>
              Continue
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-subtle p-3.5">
            <ProductThumb product={product} />
            <div className="text-[13.5px]">
              <div className="font-semibold text-ink">{product.name}</div>
              <div className="text-muted">
                Ordered {formatQty(po.quantity, product.unit)} · on hand {formatQty(product.currentStock, product.unit)}
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="rcv" hint={product.unit}>
              Quantity received
            </Label>
            <Input id="rcv" type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
            {q > 0 && q < po.quantity && <p className="mt-1.5 text-[12.5px] text-warning-ink">Short delivery: {formatQty(po.quantity - q, product.unit)} less than ordered.</p>}
          </div>
          <div>
            <Label htmlFor="rcv-n" hint="Optional">
              Receiving notes
            </Label>
            <Textarea id="rcv-n" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. All bags sealed, roast date 3 days ago" />
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={open && confirm}
        onClose={() => {
          setConfirm(false)
          onClose()
        }}
        tone="success"
        title="Confirm goods receipt?"
        confirmLabel="Confirm & Update Inventory"
        icon={<PackageCheck className="h-5 w-5" />}
        onConfirm={() => {
          record(po.id, q, notes.trim() || undefined)
          toast.success('Delivery recorded — inventory updated', { description: `${product.name}: ${formatQty(product.currentStock, product.unit)} → ${formatQty(product.currentStock + q, product.unit)}. Forecast recalculated.` })
          setConfirm(false)
        }}
      >
        <p className="text-[13.5px] text-ink">
          {product.name} stock will increase from <span className="font-semibold">{formatQty(product.currentStock, product.unit)}</span> to{' '}
          <span className="font-semibold">{formatQty(product.currentStock + (q || 0), product.unit)}</span>.
        </p>
      </ConfirmDialog>
    </>
  )
}

export function PurchaseOrderDetail({ poId, onClose }: { poId: string | null; onClose: () => void }) {
  const navigate = useNavigate()
  const po = useAppStore((s) => s.purchaseOrders.find((p) => p.id === poId))
  const products = useAppStore((s) => s.products)
  const business = useAppStore((s) => s.business)
  const messages = useAppStore((s) => s.messages)
  const approvals = useAppStore((s) => s.approvals)
  const respond = useAppStore((s) => s.supplierRespond)
  const cancel = useAppStore((s) => s.cancelPO)
  const [channel, setChannel] = useState<Channel | null>(null)
  const [deliveryOpen, setDeliveryOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [responding, setResponding] = useState<string | null>(null)

  const open = !!poId && !!po
  const product = po ? products.find((p) => p.id === po.productId) : undefined
  const supplier = po ? getSupplier(po.supplierId) : undefined
  const thread = po ? messages.filter((m) => m.poId === po.id).sort((a, b) => a.date.localeCompare(b.date)) : []
  const changeApproval = po ? approvals.find((a) => a.poId === po.id && a.status === 'Pending') : undefined

  const simulate = async (r: 'accept' | 'changes' | 'decline') => {
    if (!po) return
    setResponding(r)
    await new Promise((res) => setTimeout(res, 700))
    respond(po.id, r)
    setResponding(null)
    if (r === 'accept') toast.success(`${supplier?.name} confirmed ${po.number}`)
    if (r === 'changes') toast.warning('Supplier requested changes', { description: 'Revised terms sent to Approvals for re-approval.', action: { label: 'Review', onClick: () => navigate('/app/approvals') } })
    if (r === 'decline') toast.error(`${supplier?.name} declined ${po.number}`, { description: 'Select another supplier to continue.' })
  }

  return (
    <Drawer open={open} onClose={onClose} width="max-w-[680px]">
      {po && product && supplier && (
        <>
          <div className="flex items-start justify-between gap-4 border-b border-line bg-white px-6 py-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-[22px] font-semibold tracking-tight text-ink">{po.number}</h2>
                <POStatusBadge status={po.status} />
              </div>
              <p className="mt-0.5 text-[13px] text-muted">
                Created {formatDateTime(po.createdAt)} · Expected {formatDate(po.expectedDelivery)}
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-muted transition hover:bg-subtle hover:text-ink" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 scrollbar-thin">
            <Card className="p-5">
              <StatusStepper po={po} />
              {po.status === 'Cancelled' && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-critical-soft px-3.5 py-2.5 text-[13px] text-[#a8323a]">
                  <Ban className="mt-0.5 h-4 w-4 shrink-0" /> {po.cancelReason ?? 'Cancelled'}
                </div>
              )}
            </Card>

            {/* Primary actions by status */}
            {po.status === 'Approved' && (
              <Card className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink">Send to supplier</h3>
                    <p className="text-[13px] text-muted">Approved and ready. Choose how to send the PO.</p>
                  </div>
                  <DemoTag />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Button variant="outline" size="lg" onClick={() => setChannel('email')}>
                    <Mail className="h-4 w-4 text-primary" /> Send via Email
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => setChannel('whatsapp')}>
                    <MessageCircle className="h-4 w-4 text-success" /> Send via WhatsApp
                  </Button>
                </div>
              </Card>
            )}
            {(po.status === 'Sent' || po.status === 'Awaiting Confirmation') && (
              <Card className="border-[#e6dcff] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink">Supplier response</h3>
                    <p className="text-[13px] text-muted">{po.status === 'Sent' ? 'Delivering message…' : `Waiting for ${supplier.name} to respond.`}</p>
                  </div>
                  <DemoTag />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <Button variant="success" onClick={() => simulate('accept')} loading={responding === 'accept'} disabled={!!responding}>
                    <CircleCheck className="h-4 w-4" /> Simulate Acceptance
                  </Button>
                  <Button variant="outline" onClick={() => simulate('changes')} loading={responding === 'changes'} disabled={!!responding}>
                    <Repeat2 className="h-4 w-4" /> Simulate Changes
                  </Button>
                  <Button variant="outline" className="text-[#c23f48]" onClick={() => simulate('decline')} loading={responding === 'decline'} disabled={!!responding}>
                    <CircleX className="h-4 w-4" /> Simulate Rejection
                  </Button>
                </div>
              </Card>
            )}
            {po.status === 'Changes Requested' && po.proposedChanges && (
              <Card className="border-[#f6e1b9] p-5">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                  <TriangleAlert className="h-4 w-4 text-warning" /> Supplier requested changes
                </div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{po.proposedChanges.note}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[12.5px]">
                  <div className="rounded-xl bg-subtle px-3 py-2">
                    <div className="text-muted">Unit price</div>
                    <div className="font-semibold">
                      {formatRM(po.unitPrice)} → {formatRM(po.proposedChanges.unitPrice)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-subtle px-3 py-2">
                    <div className="text-muted">Quantity</div>
                    <div className="font-semibold">{formatQty(po.proposedChanges.quantity, product.unit)}</div>
                  </div>
                  <div className="rounded-xl bg-subtle px-3 py-2">
                    <div className="text-muted">Lead time</div>
                    <div className="font-semibold">
                      {po.leadTimeDays}d → {po.proposedChanges.leadTimeDays}d
                    </div>
                  </div>
                </div>
                <Button className="mt-4 w-full" onClick={() => navigate('/app/approvals')} disabled={!changeApproval}>
                  <ShieldCheck className="h-4 w-4" /> Review in Approvals
                </Button>
              </Card>
            )}
            {po.status === 'Confirmed' && (
              <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink">Awaiting delivery</h3>
                    <p className="text-[13px] text-muted">Expected {formatDate(po.expectedDelivery)}. Record the goods receipt when it arrives.</p>
                  </div>
                  <Button onClick={() => setDeliveryOpen(true)}>
                    <Truck className="h-4 w-4" /> Record Delivery
                  </Button>
                </div>
              </Card>
            )}
            {po.status === 'Delivered' && (
              <Card className="flex items-center gap-3 border-[#cdebdc] bg-success-soft/50 p-5 text-[13.5px]">
                <PackageCheck className="h-5 w-5 text-success" />
                <span className="text-ink">
                  Received {formatQty(po.receivedQty ?? po.quantity, product.unit)} on {po.deliveredAt && formatDateTime(po.deliveredAt)}. Inventory and forecast updated.
                </span>
              </Card>
            )}
            {po.status === 'Cancelled' && po.declinedBySupplier && (
              <Card className="p-5">
                <h3 className="text-[15px] font-semibold text-ink">Find an alternative</h3>
                <p className="mt-1 text-[13px] text-muted">Compare the remaining suppliers and send a new request for approval.</p>
                <Button className="mt-4 w-full" onClick={() => navigate(`/app/quotations?product=${po.productId}&qty=${po.quantity}&po=${po.id}`)}>
                  <Repeat2 className="h-4 w-4" /> Select Another Supplier
                </Button>
              </Card>
            )}

            {/* Parties */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-4">
                <div className="mb-3 text-[12px] font-medium text-muted">Supplier</div>
                <div className="flex items-center gap-3">
                  <SupplierLogo supplier={supplier} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold text-ink">{supplier.name}</div>
                    <div className="text-[12px] text-muted">{supplier.contactName}</div>
                  </div>
                </div>
                <div className="mt-3 space-y-0.5 text-[12.5px] text-muted">
                  <div>{supplier.email}</div>
                  <div>{supplier.phone}</div>
                  <div>{supplier.address}</div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="mb-3 text-[12px] font-medium text-muted">Bill & deliver to</div>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold text-ink">{business.name}</div>
                    <div className="text-[12px] text-muted">{business.registrationNo}</div>
                  </div>
                </div>
                <div className="mt-3 space-y-0.5 text-[12.5px] text-muted">
                  <div>{business.address}</div>
                  <div>
                    {business.city}, {business.state}
                  </div>
                  <div>{business.phone}</div>
                </div>
              </Card>
            </div>

            {/* Line items */}
            <Card className="overflow-hidden">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="border-b border-line bg-[#fafbfe] text-[12.5px] text-muted">
                    <th className="px-4 py-2.5 text-left font-medium">Item</th>
                    <th className="px-4 text-right font-medium">Qty</th>
                    <th className="px-4 text-right font-medium">Unit price</th>
                    <th className="px-4 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-line">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <ProductThumb product={product} size="sm" />
                        <div>
                          <div className="font-medium text-ink">{product.name}</div>
                          <div className="font-mono text-[11.5px] text-muted">{product.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 text-right tabular">{formatQty(po.quantity, product.unit)}</td>
                    <td className="px-4 text-right tabular">{formatRM(po.unitPrice)}</td>
                    <td className="px-4 text-right tabular">{formatRM(po.unitPrice * po.quantity)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-4 pt-3 text-right text-muted">
                      Delivery fee
                    </td>
                    <td className="px-4 pt-3 text-right tabular">{formatRM(po.deliveryFee)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-4 pt-1.5 pb-4 text-right font-semibold text-ink">
                      Total
                    </td>
                    <td className="px-4 pt-1.5 pb-4 text-right text-[17px] font-semibold text-ink tabular">{formatRM(po.total)}</td>
                  </tr>
                </tbody>
              </table>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-4 text-[13px]">
                <div className="mb-2 text-[12px] font-medium text-muted">Delivery terms</div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted">Lead time</span>
                  <span className="text-ink">{po.leadTimeDays} days</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted">Expected</span>
                  <span className="text-ink">{formatDate(po.expectedDelivery)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted">Payment</span>
                  <span className="text-ink">{po.paymentTerms}</span>
                </div>
              </Card>
              <Card className="p-4 text-[13px]">
                <div className="mb-2 text-[12px] font-medium text-muted">Manager approval</div>
                <div className="flex items-center gap-2 text-ink">
                  <ShieldCheck className="h-4 w-4 text-success" /> Approved by {po.approvedBy ?? '—'}
                </div>
                <div className="mt-1 text-muted">{po.approvedAt && formatDateTime(po.approvedAt)}</div>
                {po.approvalId && <div className="mt-1 font-mono text-[12px] text-muted">Ref. {po.approvalId.toUpperCase()}</div>}
              </Card>
            </div>

            {/* Communication */}
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-ink">Communication history</h3>
                {thread.length > 0 && <DemoTag />}
              </div>
              {thread.length === 0 ? (
                <p className="text-[13px] text-muted">No messages yet. Send the PO to start the conversation.</p>
              ) : (
                <div className="space-y-3">
                  {thread.map((m) => (
                    <div key={m.id} className={cn('flex', m.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px]', m.direction === 'outbound' ? 'rounded-br-md bg-lavender text-ink' : 'rounded-bl-md border border-line bg-white text-ink')}>
                        <div className="mb-1 flex items-center gap-1.5 text-[11.5px] text-muted">
                          {m.channel === 'whatsapp' ? <MessageCircle className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                          {m.direction === 'outbound' ? 'You' : supplier.name} · {relativeTime(m.date)}
                        </div>
                        <p className="line-clamp-4 leading-relaxed whitespace-pre-wrap">{m.subject ? <span className="font-medium">{m.subject}{'\n'}</span> : null}{m.body.replace(/\*/g, '')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Timeline */}
            <Card className="p-5">
              <h3 className="mb-4 text-[15px] font-semibold text-ink">Status timeline</h3>
              <ol className="space-y-4">
                {[...po.timeline].reverse().map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', i === 0 ? 'bg-primary ring-4 ring-primary/15' : 'bg-[#cfd5e6]')} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium text-ink">{e.label}</div>
                      <div className="flex items-center gap-1.5 text-[12px] text-muted">
                        <Clock className="h-3 w-3" /> {formatDateTime(e.date)} · {e.by}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>

          {!['Delivered', 'Cancelled'].includes(po.status) && (
            <div className="flex justify-end border-t border-line bg-white px-6 py-3">
              <Button variant="ghost" size="sm" className="text-[#c23f48] hover:bg-critical-soft" onClick={() => setCancelOpen(true)}>
                Cancel PO
              </Button>
            </div>
          )}

          <CommunicationPreviewModal po={po} channel={channel} onClose={() => setChannel(null)} />
          <RecordDeliveryModal po={po} open={deliveryOpen} onClose={() => setDeliveryOpen(false)} />
          <ConfirmDialog
            open={cancelOpen}
            onClose={() => setCancelOpen(false)}
            tone="danger"
            title={`Cancel ${po.number}?`}
            description="The supplier would need to be informed separately. This cannot be undone."
            confirmLabel="Cancel PO"
            reasonLabel="Cancellation reason"
            reasonRequired
            onConfirm={(r) => {
              cancel(po.id, r)
              toast('Purchase order cancelled')
            }}
          />
        </>
      )}
    </Drawer>
  )
}
