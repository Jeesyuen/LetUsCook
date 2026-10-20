import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, ClipboardCheck, FileSearch, FileText, Info, Repeat2, Send, Sparkles, TriangleAlert } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useForecasts, useScoredQuotes } from '@/hooks/useDerived'
import { explainRecommendation } from '@/services/explanations'
import { criterionLabels, priorityLabels } from '@/services/scoring'
import type { ScoringPriority, ScoringWeights } from '@/types'
import { QuoteCard, ScoreBreakdown, SupplierComparisonTable } from '@/components/SupplierComparison'
import { ProductThumb, RiskBadge, SupplierLogo } from '@/components/common'
import { Card, CardHeader, EmptyState, Input, Label, PageHeader, SegmentedTabs, Select, DemoTag } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Modal } from '@/components/ui/Overlay'
import { formatDate, formatShortDate } from '@/utils/date'
import { cn, formatQty, formatRM } from '@/utils/format'

export default function Quotations() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const all = useForecasts()
  const approvals = useAppStore((s) => s.approvals)
  const pos = useAppStore((s) => s.purchaseOrders)
  const business = useAppStore((s) => s.business)
  const requestApproval = useAppStore((s) => s.requestApproval)
  const updateApproval = useAppStore((s) => s.updateApproval)

  // Override mode: choosing another supplier for an existing pending approval
  const approvalId = params.get('approval')
  const overrideFor = approvals.find((a) => a.id === approvalId && a.status === 'Pending')
  // Re-sourcing after a supplier declined
  const declinedPO = pos.find((p) => p.id === params.get('po'))

  const productId = overrideFor?.productId ?? params.get('product') ?? 'p-coffee'
  const pf = all.find((x) => x.product.id === productId) ?? all[0]
  const defaultQty = overrideFor?.quantity ?? (pf ? pf.forecast.suggestedQty || pf.forecast.calculatedQty || pf.product.orderMultiple : 0)
  const qty = Number(params.get('qty')) || defaultQty
  const [qtyInput, setQtyInput] = useState(String(qty))
  useEffect(() => setQtyInput(String(qty)), [qty])

  const [priority, setPriority] = useState<ScoringPriority>(overrideFor?.priority ?? 'balanced')
  const exclude = useMemo(() => (declinedPO ? [declinedPO.supplierId] : []), [declinedPO])
  const { ranked, weights } = useScoredQuotes(pf?.product.id ?? '', qty, priority, exclude)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = ranked.find((r) => r.supplier.id === selectedId) ?? ranked[0]
  const best = ranked[0]
  const isOverride = !!selected && !!best && selected.supplier.id !== best.supplier.id
  const explanation = useMemo(() => (pf ? explainRecommendation(ranked, priority, pf.product, pf.forecast) : null), [ranked, priority, pf])

  // reset selection to the top-ranked supplier whenever the ranking context changes
  useEffect(() => setSelectedId(null), [productId, qty, priority])
  useEffect(() => {
    if (overrideFor) setSelectedId(ranked.find((r) => r.supplier.id !== overrideFor.supplierId)?.supplier.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideFor?.id])

  const [viewOpen, setViewOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const existingPending = approvals.find((a) => a.productId === productId && a.status === 'Pending' && a.kind === 'purchase' && a.id !== overrideFor?.id)

  const setParam = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v === null ? p.delete(k) : p.set(k, v)))
    setParams(p, { replace: true })
  }

  if (!pf) return null
  const { product, forecast } = pf
  const productsWithQuotes = all.filter((x) => x.product.supplierIds.length > 0)
  const needsOverrideReason = isOverride || !!overrideFor

  const submit = (reason: string) => {
    if (!selected || !explanation) return
    if (overrideFor) {
      updateApproval(overrideFor.id, { supplierId: selected.supplier.id, quantity: qty, overrideReason: reason })
      toast.success('Supplier changed on approval request', { description: `${selected.supplier.name} · ${formatRM(selected.quotation.total)}. Override reason recorded.` })
      navigate('/app/approvals')
      return
    }
    requestApproval({
      productId,
      quantity: qty,
      supplierId: selected.supplier.id,
      priority,
      reason: selected.rank === 1 ? explanation.summary : `Manager-selected supplier (ranked #${selected.rank}, ${selected.score}%).`,
      overrideReason: isOverride ? reason : undefined,
    })
    toast.success('Approval requested', {
      description: `${formatQty(qty, product.unit)} ${product.name} from ${selected.supplier.name}. No PO has been issued yet.`,
      action: { label: 'View', onClick: () => navigate('/app/approvals') },
    })
    navigate('/app/approvals')
  }

  return (
    <div>
      <PageHeader
        title="Supplier Comparison"
        subtitle="Find the best supplier based on cost, delivery, and reliability."
        actions={
          <Button variant="outline" onClick={() => navigate(`/app/forecasting?product=${productId}`)}>
            View forecast
          </Button>
        }
      />

      {overrideFor && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#dcd2ff] bg-[#f8f5ff] px-5 py-3.5 text-[13.5px]">
          <Repeat2 className="h-4 w-4 text-violet" />
          <span className="flex-1 text-ink">
            Choosing another supplier for approval request <span className="font-semibold">{overrideFor.id.toUpperCase()}</span> — currently {formatQty(overrideFor.quantity, product.unit)} from{' '}
            <span className="font-semibold">{ranked.find((r) => r.supplier.id === overrideFor.supplierId)?.supplier.name ?? 'current supplier'}</span>.
          </span>
          <Button size="sm" variant="ghost" onClick={() => navigate('/app/approvals')}>
            Cancel
          </Button>
        </div>
      )}
      {declinedPO && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#f8d3d6] bg-critical-soft/60 px-5 py-3.5 text-[13.5px] text-ink">
          <TriangleAlert className="h-4 w-4 text-critical" />
          {declinedPO.number} was declined by the supplier. They are excluded below — choose an alternative and request approval.
        </div>
      )}
      {existingPending && !overrideFor && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#f6e1b9] bg-warning-soft/70 px-5 py-3.5 text-[13.5px]">
          <Info className="h-4 w-4 text-warning-ink" />
          <span className="flex-1 text-ink">A purchase request for {product.name} is already awaiting approval.</span>
          <Link to="/app/approvals" className="font-medium text-primary hover:underline">
            Review it →
          </Link>
        </div>
      )}

      {/* Request context */}
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end gap-5">
          <div className="flex min-w-[240px] flex-1 items-center gap-4">
            <ProductThumb product={product} size="lg" />
            <div className="min-w-0 flex-1">
              <Label htmlFor="cmp-p">Product</Label>
              <Select id="cmp-p" value={productId} onChange={(e) => setParam({ product: e.target.value, qty: null, approval: null, po: null })} disabled={!!overrideFor}>
                {productsWithQuotes.map((x) => (
                  <option key={x.product.id} value={x.product.id}>
                    {x.product.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="w-[160px]">
            <Label htmlFor="cmp-q" hint={product.unit}>
              Required quantity
            </Label>
            <Input
              id="cmp-q"
              type="number"
              min={1}
              value={qtyInput}
              onChange={(e) => setQtyInput(e.target.value)}
              onBlur={() => {
                const n = parseFloat(qtyInput)
                if (n > 0) setParam({ qty: String(n) })
                else setQtyInput(String(qty))
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 pb-2 text-[13px]">
            <div>
              <div className="text-muted">Stock</div>
              <div className="font-semibold text-ink tabular">{formatQty(product.currentStock, product.unit)}</div>
            </div>
            <div>
              <div className="text-muted">Stockout</div>
              <div className="font-semibold text-ink tabular">{forecast.stockoutDate ? formatShortDate(forecast.stockoutDate) : '—'}</div>
            </div>
            <div>
              <div className="text-muted">Risk</div>
              <RiskBadge risk={forecast.risk} />
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] font-medium text-ink">Purchasing priority</span>
            <SegmentedTabs value={priority} onChange={setPriority} items={(Object.keys(priorityLabels) as ScoringPriority[]).map((k) => ({ value: k, label: priorityLabels[k] }))} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(weights) as (keyof ScoringWeights)[]).map((k) => (
              <span key={k} className="rounded-md bg-subtle px-2 py-1 text-[12px] text-muted">
                {criterionLabels[k]} <span className="font-semibold text-ink">{weights[k]}%</span>
              </span>
            ))}
          </div>
        </div>
      </Card>

      {ranked.length === 0 ? (
        <Card>
          <EmptyState icon={<FileSearch className="h-7 w-7" />} title="No quotations yet" description="No supplier has quoted this product. Add catalogue pricing or request a quotation from a supplier profile." action={<Button onClick={() => navigate('/app/suppliers')}>Browse suppliers</Button>} />
        </Card>
      ) : (
        <>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[17px] font-semibold text-ink">
              {ranked.length} quotation{ranked.length > 1 ? 's' : ''} for {formatQty(qty, product.unit)}
            </h2>
            <span className="text-[12.5px] text-muted">Ranked by {priorityLabels[priority].toLowerCase()} weighting</span>
          </div>
          <div className={cn('mb-6 grid gap-5', ranked.length >= 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2')}>
            {ranked.map((r) => (
              <QuoteCard key={r.supplier.id} item={r} unit={product.unit} selected={selected?.supplier.id === r.supplier.id} onSelect={() => setSelectedId(r.supplier.id)} />
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
            <Card className="min-w-0 overflow-hidden">
              <CardHeader title="Detailed comparison" subtitle="Green checks mark the objectively best value for each criterion." />
              <div className="mt-3">
                <SupplierComparisonTable ranked={ranked} unit={product.unit} />
              </div>
            </Card>

            <div className="space-y-6">
              {explanation && best && (
                <Card className="border-[#dcd2ff] p-6 shadow-[0_0_0_4px_rgba(155,92,255,0.05),0_4px_16px_-6px_rgba(49,84,223,0.08)]">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f3ecff] text-violet">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <h3 className="text-[15px] font-semibold text-ink">Why We Recommend {best.supplier.name}</h3>
                  </div>
                  <p className="mt-3 text-[14px] leading-relaxed text-ink">{explanation.summary}</p>
                  <ul className="mt-4 space-y-2">
                    {explanation.points.map((p, i) => (
                      <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
                        <span className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', p.tone === 'positive' ? 'bg-success' : p.tone === 'tradeoff' ? 'bg-warning' : 'bg-[#b3b9cb]')} />
                        {p.text}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-[11.5px] text-[#9aa1b5]">Generated from quotation data with deterministic rules — no external AI service is called.</p>
                </Card>
              )}

              <Card className="p-6">
                <h3 className="mb-4 text-[15px] font-semibold text-ink">Score breakdown</h3>
                <ScoreBreakdown ranked={ranked} weights={weights} />
              </Card>
            </div>
          </div>

          {/* Action bar */}
          {selected && (
            <div className="sticky bottom-4 z-20 mt-6">
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white/95 px-5 py-4 shadow-lift backdrop-blur">
                <SupplierLogo supplier={selected.supplier} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-ink">
                    {selected.supplier.name} <span className="font-normal text-muted">· {selected.score}% compatibility</span>
                  </div>
                  <div className="text-[12.5px] text-muted">
                    {formatQty(qty, product.unit)} · {formatRM(selected.quotation.total)} · {selected.quotation.leadTimeDays}-day delivery
                    {isOverride && <span className="ml-2 font-medium text-warning-ink">Override of #{best!.rank} recommendation</span>}
                  </div>
                </div>
                <Button variant="outline" onClick={() => setViewOpen(true)}>
                  <FileText className="h-4 w-4" /> View Quotation
                </Button>
                <Button onClick={() => setConfirmOpen(true)}>
                  <ClipboardCheck className="h-4 w-4" /> {overrideFor ? 'Update Approval Request' : 'Request Manager Approval'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {selected && (
        <Modal
          open={viewOpen}
          onClose={() => setViewOpen(false)}
          size="lg"
          title={`Quotation from ${selected.supplier.name}`}
          description={`Ref. QT-${selected.supplier.initials}-${product.sku.slice(-3)} · issued ${formatDate(selected.quotation.issuedAt)}`}
          icon={<FileText className="h-5 w-5" />}
          footer={
            <>
              <Button variant="outline" onClick={() => setViewOpen(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setViewOpen(false)
                  setConfirmOpen(true)
                }}
              >
                Request Approval <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          }
        >
          <div className="rounded-2xl border border-line p-5">
            <div className="flex flex-wrap justify-between gap-4 text-[13px]">
              <div>
                <div className="text-muted">From</div>
                <div className="font-semibold text-ink">{selected.supplier.name}</div>
                <div className="text-muted">{selected.supplier.address}</div>
              </div>
              <div className="text-right">
                <div className="text-muted">To</div>
                <div className="font-semibold text-ink">{business.name}</div>
                <div className="text-muted">{business.address}</div>
              </div>
            </div>
            <table className="mt-5 w-full text-[13.5px]">
              <thead>
                <tr className="border-y border-line text-[12.5px] text-muted">
                  <th className="py-2 text-left font-medium">Item</th>
                  <th className="py-2 text-right font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Unit price</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="py-3">{product.name}</td>
                  <td className="py-3 text-right tabular">{formatQty(qty, product.unit)}</td>
                  <td className="py-3 text-right tabular">{formatRM(selected.quotation.unitPrice)}</td>
                  <td className="py-3 text-right tabular">{formatRM(selected.quotation.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="pt-3 text-right text-muted">
                    Delivery
                  </td>
                  <td className="pt-3 text-right tabular">{formatRM(selected.quotation.deliveryFee)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="pt-2 text-right font-semibold">
                    Total
                  </td>
                  <td className="pt-2 text-right text-[16px] font-semibold tabular">{formatRM(selected.quotation.total)}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-subtle p-4 text-[13px] sm:grid-cols-4">
              <div>
                <div className="text-muted">Lead time</div>
                <div className="font-medium">{selected.quotation.leadTimeDays} days</div>
              </div>
              <div>
                <div className="text-muted">MOQ</div>
                <div className="font-medium">{formatQty(selected.quotation.moq, product.unit)}</div>
              </div>
              <div>
                <div className="text-muted">Payment</div>
                <div className="font-medium">{selected.quotation.paymentTerms}</div>
              </div>
              <div>
                <div className="text-muted">Valid until</div>
                <div className="font-medium">{formatDate(selected.quotation.expiresAt)}</div>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12px] text-muted">
            <DemoTag /> Mock quotation generated from the supplier's catalogue pricing.
          </div>
        </Modal>
      )}

      {selected && (
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title={overrideFor ? 'Change supplier on this request?' : 'Request manager approval?'}
          description="This creates an approval record. No purchase order is issued or sent until a manager approves."
          confirmLabel={overrideFor ? 'Update Request' : 'Request Approval'}
          icon={<Send className="h-5 w-5" />}
          reasonLabel={needsOverrideReason ? 'Override reason' : undefined}
          reasonRequired={needsOverrideReason}
          onConfirm={submit}
        >
          <div className="rounded-xl border border-line p-4 text-[13.5px]">
            <div className="flex justify-between py-1">
              <span className="text-muted">Product</span>
              <span className="font-medium">{product.name}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted">Quantity</span>
              <span className="font-medium tabular">{formatQty(qty, product.unit)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted">Supplier</span>
              <span className="font-medium">{selected.supplier.name}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted">Compatibility</span>
              <span className="font-medium tabular">
                {selected.score}% (rank #{selected.rank})
              </span>
            </div>
            <div className="mt-1 flex justify-between border-t border-line pt-2 text-[15px]">
              <span className="font-semibold">Estimated total</span>
              <span className="font-semibold tabular">{formatRM(selected.quotation.total)}</span>
            </div>
          </div>
          {isOverride && <p className="mt-3 text-[12.5px] text-warning-ink">You selected a supplier other than the top-ranked one. Please record why.</p>}
        </ConfirmDialog>
      )}
    </div>
  )
}
