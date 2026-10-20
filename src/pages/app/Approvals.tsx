import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, CalendarDays, Check, ClipboardCheck, Inbox, Pencil, Repeat2, ShieldAlert, Sparkles, UserRound, X } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useForecasts, useSuppliers } from '@/hooks/useDerived'
import { buildQuotations, scoreQuotations, weightsFor } from '@/services/scoring'
import type { ApprovalRequest, ApprovalStatus } from '@/types'
import { ApprovalStatusBadge, CompatibilityScore, ProductThumb, SupplierLogo } from '@/components/common'
import { Badge, Card, EmptyState, Input, Label, PageHeader, SegmentedTabs, Select } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Modal } from '@/components/ui/Overlay'
import { matchLabel } from '@/components/SupplierComparison'
import { addDays, formatDate, formatDateTime, startOfToday } from '@/utils/date'
import { cn, formatQty, formatRM } from '@/utils/format'

type Tab = ApprovalStatus | 'All'

function ApprovalCard({ a, onApprove, onReject, onModify, onChoose }: { a: ApprovalRequest; onApprove: () => void; onReject: () => void; onModify: () => void; onChoose: () => void }) {
  const navigate = useNavigate()
  const all = useForecasts()
  const suppliers = useSuppliers()
  const pos = useAppStore((s) => s.purchaseOrders)
  const threshold = useAppStore((s) => s.settings.approval.dualApprovalThreshold)
  const pf = all.find((x) => x.product.id === a.productId)
  const supplier = suppliers.find((s) => s.id === a.supplierId)
  if (!pf || !supplier) return null
  const { product } = pf
  const isChange = a.kind === 'supplier-change'
  const po = pos.find((p) => p.id === (a.resultingPoId ?? a.poId))
  const delivery = addDays(startOfToday(), a.leadTimeDays)

  return (
    <Card className={cn('overflow-hidden transition-shadow duration-200 hover:shadow-lift', a.status === 'Pending' && isChange && 'border-[#f6e1b9]')}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-[#fbfbfe] px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          <span className="font-mono font-medium text-ink">{a.id.toUpperCase()}</span>
          {isChange ? <Badge tone="warning">Supplier changed terms</Badge> : <Badge tone="neutral">Purchase request</Badge>}
          {a.total > threshold && a.status === 'Pending' && (
            <Badge tone="violet">
              <ShieldAlert className="h-3 w-3" /> Above {formatRM(threshold)} — owner review
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-[12.5px] text-muted">
          <span className="flex items-center gap-1">
            <UserRound className="h-3.5 w-3.5" /> {a.requestedBy}
          </span>
          <span>{formatDateTime(a.requestedAt)}</span>
          <ApprovalStatusBadge status={a.status} />
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <ProductThumb product={product} />
            <div className="min-w-0">
              <div className="text-[16px] font-semibold text-ink">{product.name}</div>
              <div className="text-[13px] text-muted">
                {formatQty(a.quantity, product.unit)} · {formatRM(a.unitPrice)}/{product.unit}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2.5 rounded-xl bg-lavender/50 px-3.5 py-3 text-[13px] leading-relaxed text-[#2a3591]">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
            <p className="line-clamp-3">{a.reason}</p>
          </div>
          {a.overrideReason && (
            <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-warning-ink">
              <Repeat2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Override: {a.overrideReason}
            </p>
          )}
          {isChange && po && (
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-line p-3 text-[12.5px]">
              <div>
                <div className="text-muted">Unit price</div>
                <div className="tabular">
                  <span className="text-muted line-through">{formatRM(po.unitPrice)}</span> <span className="font-semibold text-ink">{formatRM(a.unitPrice)}</span>
                </div>
              </div>
              <div>
                <div className="text-muted">Lead time</div>
                <div>
                  <span className="text-muted line-through">{po.leadTimeDays}d</span> <span className="font-semibold text-ink">{a.leadTimeDays}d</span>
                </div>
              </div>
              <div>
                <div className="text-muted">Total</div>
                <div className="tabular">
                  <span className="text-muted line-through">{formatRM(po.total)}</span> <span className="font-semibold text-ink">{formatRM(a.total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 content-start gap-x-5 gap-y-4 text-[13px]">
          <div className="col-span-2 flex items-center gap-2.5">
            <SupplierLogo supplier={supplier} size="sm" />
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{supplier.name}</div>
              <div className="text-[12px] text-muted">{supplier.isNew ? 'New supplier' : `${supplier.reliability}% reliability`}</div>
            </div>
          </div>
          <div>
            <div className="text-muted">Estimated total</div>
            <div className="mt-0.5 text-[17px] font-semibold text-ink tabular">{formatRM(a.total)}</div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-muted">
              <CalendarDays className="h-3.5 w-3.5" /> Expected delivery
            </div>
            <div className="mt-0.5 font-semibold text-ink">{a.status === 'Pending' ? formatDate(delivery) : `${a.leadTimeDays} days`}</div>
          </div>
        </div>

        {!isChange && (
          <div className="flex items-center gap-3 lg:flex-col lg:items-center lg:justify-center lg:border-l lg:border-line lg:pl-5">
            <CompatibilityScore score={a.score} size={68} highlight={a.status !== 'Rejected'} />
            <div className="text-[12px] font-medium text-muted lg:text-center">{matchLabel(a.score)}</div>
          </div>
        )}
      </div>

      {a.status === 'Pending' ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5">
          {isChange ? (
            <Button variant="ghost" size="sm" className="mr-auto" onClick={() => po && navigate(`/app/purchase-orders?po=${po.id}`)}>
              View {po?.number}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="mr-auto" onClick={onModify}>
              <Pencil className="h-3.5 w-3.5" /> Modify
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onChoose}>
            <Repeat2 className="h-3.5 w-3.5" /> Choose Another Supplier
          </Button>
          <Button variant="outline" size="sm" className="text-[#c23f48] hover:border-[#f2c1c5] hover:bg-critical-soft" onClick={onReject}>
            <X className="h-3.5 w-3.5" /> Reject
          </Button>
          <Button variant="success" size="sm" onClick={onApprove}>
            <Check className="h-3.5 w-3.5" /> {isChange ? 'Approve Revised Terms' : 'Approve'}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[12.5px] text-muted">
          <span>
            {a.status} by {a.decidedBy} · {a.decidedAt && formatDateTime(a.decidedAt)}
            {a.decisionNote && <span className="text-ink"> — “{a.decisionNote}”</span>}
          </span>
          {po && a.status === 'Approved' && (
            <Button variant="ghost" size="sm" onClick={() => navigate(`/app/purchase-orders?po=${po.id}`)}>
              {po.number} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}

function ModifyModal({ a, onClose }: { a: ApprovalRequest | null; onClose: () => void }) {
  const navigate = useNavigate()
  const all = useForecasts()
  const balanced = useAppStore((s) => s.settings.balancedWeights)
  const update = useAppStore((s) => s.updateApproval)
  const approve = useAppStore((s) => s.approve)
  const [qty, setQty] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    if (a) {
      setQty(String(a.quantity))
      setSupplierId(a.supplierId)
    }
  }, [a])
  const q = parseFloat(qty)
  const ranked = useMemo(() => (a && q > 0 ? scoreQuotations(buildQuotations(a.productId, q), weightsFor(a.priority, balanced)) : []), [a, q, balanced])
  if (!a) return null
  const product = all.find((x) => x.product.id === a.productId)?.product
  const cur = ranked.find((r) => r.supplier.id === supplierId)
  const changed = !!cur && (q !== a.quantity || supplierId !== a.supplierId)
  const delta = cur ? cur.quotation.total - a.total : 0

  return (
    <>
      <Modal
        open={!!a && !confirm}
        onClose={onClose}
        title="Modify request"
        description="Adjust the quantity or supplier — cost and compatibility are recalculated."
        icon={<Pencil className="h-5 w-5" />}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              disabled={!changed}
              onClick={() => {
                update(a.id, { quantity: q, supplierId, overrideReason: supplierId !== a.supplierId ? 'Supplier changed by manager during review' : undefined })
                toast.success('Request updated — still pending approval')
                onClose()
              }}
            >
              Save Changes
            </Button>
            <Button variant="success" disabled={!cur} onClick={() => setConfirm(true)}>
              Approve Modified Request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="m-q" hint={product?.unit}>
                Quantity
              </Label>
              <Input id="m-q" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="m-s">Supplier</Label>
              <Select id="m-s" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {ranked.map((r) => (
                  <option key={r.supplier.id} value={r.supplier.id}>
                    {r.supplier.name} — {r.score}%
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {cur && (
            <div className="rounded-xl border border-line p-4 text-[13.5px]">
              <div className="flex justify-between py-1">
                <span className="text-muted">Unit price</span>
                <span className="tabular">{formatRM(cur.quotation.unitPrice)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted">Delivery</span>
                <span>
                  {cur.quotation.leadTimeDays} days · {formatRM(cur.quotation.deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted">Compatibility</span>
                <span className="font-medium tabular">
                  {cur.score}% · rank #{cur.rank}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
                <span className="font-semibold">New total</span>
                <span className="text-right">
                  <span className="text-[16px] font-semibold tabular">{formatRM(cur.quotation.total)}</span>
                  {delta !== 0 && (
                    <span className={cn('block text-[12px] tabular', delta > 0 ? 'text-[#c23f48]' : 'text-[#17794f]')}>
                      {delta > 0 ? '+' : '−'}
                      {formatRM(Math.abs(delta))} vs original
                    </span>
                  )}
                </span>
              </div>
              {q < cur.quotation.moq && <p className="mt-2 text-[12.5px] text-warning-ink">Below MOQ of {formatQty(cur.quotation.moq, product?.unit)}.</p>}
            </div>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        tone="success"
        title="Approve the modified request?"
        description="The request is updated and a purchase order is generated with these terms."
        confirmLabel="Approve & Generate PO"
        reasonLabel="Approval note"
        onConfirm={(note) => {
          if (changed) update(a.id, { quantity: q, supplierId, overrideReason: supplierId !== a.supplierId ? note || 'Supplier changed by manager during review' : undefined })
          const poId = approve(a.id, note || 'Approved with modifications')
          toast.success('Approved — purchase order generated')
          onClose()
          if (poId) navigate(`/app/purchase-orders?po=${poId}`)
        }}
      >
        {cur && (
          <p className="text-[13.5px] text-ink">
            {formatQty(q, product?.unit)} {product?.name} from <span className="font-semibold">{cur.supplier.name}</span> for <span className="font-semibold">{formatRM(cur.quotation.total)}</span>.
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}

export default function Approvals() {
  const navigate = useNavigate()
  const approvals = useAppStore((s) => s.approvals)
  const approve = useAppStore((s) => s.approve)
  const reject = useAppStore((s) => s.reject)
  const requireReason = useAppStore((s) => s.settings.approval.requireRejectionReason)
  const [tab, setTab] = useState<Tab>('Pending')
  const [approving, setApproving] = useState<ApprovalRequest | null>(null)
  const [rejecting, setRejecting] = useState<ApprovalRequest | null>(null)
  const [modifying, setModifying] = useState<ApprovalRequest | null>(null)
  const [switching, setSwitching] = useState<ApprovalRequest | null>(null)

  const counts = { Pending: 0, Approved: 0, Rejected: 0, All: approvals.length } as Record<Tab, number>
  approvals.forEach((a) => counts[a.status]++)
  const list = approvals.filter((a) => tab === 'All' || a.status === tab).sort((a, b) => (a.status === 'Pending' ? 0 : 1) - (b.status === 'Pending' ? 0 : 1) || b.requestedAt.localeCompare(a.requestedAt))
  const pendingTotal = approvals.filter((a) => a.status === 'Pending').reduce((s, a) => s + a.total, 0)

  const choose = (a: ApprovalRequest) => {
    if (a.kind === 'supplier-change') setSwitching(a)
    else navigate(`/app/quotations?approval=${a.id}`)
  }

  return (
    <div>
      <PageHeader title="Approvals" subtitle="Review procurement recommendations before purchase orders are issued." />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          items={(['Pending', 'Approved', 'Rejected', 'All'] as Tab[]).map((t) => ({ value: t, label: t, count: counts[t] }))}
        />
        {counts.Pending > 0 && (
          <span className="text-[13px] text-muted">
            {counts.Pending} pending · <span className="font-semibold text-ink">{formatRM(pendingTotal)}</span> awaiting decision
          </span>
        )}
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={tab === 'Pending' ? <ClipboardCheck className="h-7 w-7" /> : <Inbox className="h-7 w-7" />}
            title={tab === 'Pending' ? 'No approvals waiting' : `No ${tab.toLowerCase()} requests`}
            description={tab === 'Pending' ? 'New purchase requests from comparisons and recommendations will appear here.' : undefined}
            action={tab === 'Pending' && <Button variant="outline" onClick={() => navigate('/app/recommendations')}>View recommendations</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((a) => (
            <ApprovalCard key={a.id} a={a} onApprove={() => setApproving(a)} onReject={() => setRejecting(a)} onModify={() => setModifying(a)} onChoose={() => choose(a)} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!approving}
        onClose={() => setApproving(null)}
        tone="success"
        title={approving?.kind === 'supplier-change' ? 'Approve the revised supplier terms?' : 'Approve this purchase?'}
        description={approving?.kind === 'supplier-change' ? 'The purchase order is updated with the new terms and marked as confirmed.' : 'A purchase order will be generated. You can review it before sending to the supplier.'}
        confirmLabel={approving?.kind === 'supplier-change' ? 'Approve Terms' : 'Approve & Generate PO'}
        reasonLabel="Approval note"
        onConfirm={(note) => {
          if (!approving) return
          const poId = approve(approving.id, note || undefined)
          const po = useAppStore.getState().purchaseOrders.find((p) => p.id === poId)
          toast.success(approving.kind === 'supplier-change' ? 'Revised terms approved' : 'Approved — purchase order generated', { description: po ? `${po.number} is ready to send.` : 'Open Purchase Orders to send it to the supplier.' })
          if (poId) navigate(`/app/purchase-orders?po=${poId}`)
        }}
      >
        {approving && (
          <p className="text-[13.5px] text-ink">
            {formatRM(approving.total)} · {formatQty(approving.quantity)} units · {approving.leadTimeDays}-day delivery
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        tone="danger"
        title={rejecting?.kind === 'supplier-change' ? 'Reject the revised terms?' : 'Reject this purchase request?'}
        description={rejecting?.kind === 'supplier-change' ? 'The purchase order will be cancelled. You can then source from another supplier.' : 'No purchase order will be generated.'}
        confirmLabel="Reject"
        reasonLabel="Rejection reason"
        reasonRequired={requireReason}
        onConfirm={(reason) => {
          if (!rejecting) return
          reject(rejecting.id, reason)
          toast('Request rejected', { description: 'The decision has been logged.' })
        }}
      />

      <ConfirmDialog
        open={!!switching}
        onClose={() => setSwitching(null)}
        tone="danger"
        title="Switch to another supplier?"
        description="The revised terms are rejected, the current PO is cancelled, and you'll compare the remaining suppliers."
        confirmLabel="Reject & Compare"
        reasonLabel="Reason for switching"
        reasonRequired
        onConfirm={(reason) => {
          const a = switching
          if (!a) return
          reject(a.id, reason)
          navigate(`/app/quotations?product=${a.productId}&qty=${a.quantity}&po=${a.poId}`)
        }}
      />

      <ModifyModal a={modifying} onClose={() => setModifying(null)} />
    </div>
  )
}
