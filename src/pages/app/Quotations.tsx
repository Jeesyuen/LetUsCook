import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, ClipboardCheck, FileSearch, FileText, GitCompareArrows, Info, Loader2, Repeat2, Send, TriangleAlert } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useForecasts } from '@/hooks/useDerived'
import { useSupplierMatching } from '@/hooks/useSupplierMatching'
import { buildQuotations } from '@/services/scoring'
import { CRITERIA, criterionLabels, priorityLabels, type MatchingPriority } from '@/services/matching'
import type { ScoringPriority } from '@/types'
import { CriteriaBreakdown, IneligibleSuppliers, ProcurementAdvisorPanel, RankingLogo, RecommendedComparison, ScoreBreakdownChart, SupplierRankingTable } from '@/components/SupplierComparison'
import { ProductThumb, RiskBadge } from '@/components/common'
import { Badge, Card, CardHeader, EmptyState, Input, Label, PageHeader, SegmentedTabs, Select, DemoTag } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Modal } from '@/components/ui/Overlay'
import { formatDate, formatShortDate } from '@/utils/date'
import { formatQty, formatRM } from '@/utils/format'

// Approval records still use the legacy priority names
const toLegacyPriority: Record<MatchingPriority, ScoringPriority> = { best_overall: 'balanced', cheapest: 'cost', fastest: 'delivery', nearest: 'balanced' }
const fromLegacyPriority: Record<ScoringPriority, MatchingPriority> = { balanced: 'best_overall', cost: 'cheapest', delivery: 'fastest', reliability: 'best_overall' }
const PRIORITIES: MatchingPriority[] = ['best_overall', 'cheapest', 'nearest', 'fastest']

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

  const [priority, setPriority] = useState<MatchingPriority>(overrideFor ? fromLegacyPriority[overrideFor.priority] : 'best_overall')
  const exclude = useMemo(() => (declinedPO ? [declinedPO.supplierId] : []), [declinedPO])
  const daysLeft = pf && Number.isFinite(pf.forecast.daysRemaining) ? pf.forecast.daysRemaining : null
  const { result, loading, error } = useSupplierMatching({ product: pf?.product, quantity: qty, priority, daysUntilStockout: daysLeft, exclude })
  const ranked = useMemo(() => result?.rankings.filter((r) => r.rank !== null) ?? [], [result])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The advisor's pick (which accounts for the stock forecast) is the default and the reference for overrides
  const best = ranked.find((r) => r.supplier_id === result?.advice?.primary_supplier_id) ?? ranked[0]
  const selected = ranked.find((r) => r.supplier_id === selectedId) ?? best
  const isOverride = !!selected && !!best && selected.supplier_id !== best.supplier_id
  const [compareOpen, setCompareOpen] = useState(false)
  // Quotation on file for the selected supplier (directory suppliers only) — feeds the existing approval workflow
  const quote = useMemo(() => (selected ? buildQuotations(productId, qty).find((q) => q.supplierId === selected.supplier_id) : undefined), [selected, productId, qty])

  // reset selection to the top-ranked supplier whenever the ranking context changes
  useEffect(() => setSelectedId(null), [productId, qty, priority])
  useEffect(() => {
    if (overrideFor && result) {
      const quoted = buildQuotations(productId, qty).map((q) => q.supplierId)
      setSelectedId(ranked.find((r) => r.supplier_id !== overrideFor.supplierId && quoted.includes(r.supplier_id))?.supplier_id ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideFor?.id, !!result])

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
    if (!selected || !quote || !result) return
    if (overrideFor) {
      updateApproval(overrideFor.id, { supplierId: selected.supplier_id, quantity: qty, overrideReason: reason })
      toast.success('Supplier changed on approval request', { description: `${selected.supplier_name} · ${formatRM(quote.total)}. Override reason recorded.` })
      navigate('/app/approvals')
      return
    }
    const score = Math.round(selected.compatibility_score ?? 0)
    requestApproval({
      productId,
      quantity: qty,
      supplierId: selected.supplier_id,
      priority: toLegacyPriority[priority],
      score,
      reason: !isOverride && result.advice ? result.advice.final_recommendation : `Manager-selected supplier (ranked #${selected.rank}, ${score}%).`,
      overrideReason: isOverride ? reason : undefined,
    })
    toast.success('Approval requested', {
      description: `${formatQty(qty, product.unit)} ${product.name} from ${selected.supplier_name}. No PO has been issued yet.`,
      action: { label: 'View', onClick: () => navigate('/app/approvals') },
    })
    navigate('/app/approvals')
  }

  return (
    <div>
      <PageHeader
        title="Supplier Comparison"
        subtitle="AI supplier matching — ranked on price, delivery speed, reliability, distance and product suitability."
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
            <span className="font-semibold">{result?.rankings.find((r) => r.supplier_id === overrideFor.supplierId)?.supplier_name ?? 'current supplier'}</span>.
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
            <span className="text-[13px] font-medium text-ink">Recommendation priority</span>
            <SegmentedTabs value={priority} onChange={setPriority} items={PRIORITIES.map((k) => ({ value: k, label: priorityLabels[k] }))} />
          </div>
          {result && (
            <div className="flex flex-wrap gap-1.5">
              {CRITERIA.map((k) => (
                <span key={k} className="rounded-md bg-subtle px-2 py-1 text-[12px] text-muted">
                  {criterionLabels[k]} <span className="font-semibold text-ink">{result.weights[k]}%</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>

      {loading ? (
        <Card className="flex items-center justify-center gap-3 py-16 text-[14px] text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading supplier data…
        </Card>
      ) : error || !result ? (
        <Card>
          <EmptyState icon={<TriangleAlert className="h-7 w-7" />} title="Supplier matching unavailable" description={error ?? 'No supplier data could be loaded.'} />
        </Card>
      ) : ranked.length === 0 ? (
        <>
          <Card>
            <EmptyState
              icon={<FileSearch className="h-7 w-7" />}
              title="No eligible suppliers"
              description={result.rankings.length ? 'Every supplier found fails a basic requirement — see the reasons below, or adjust the quantity.' : 'No supplier data has been found for this product yet.'}
              action={<Button onClick={() => navigate('/app/suppliers')}>Browse suppliers</Button>}
            />
          </Card>
          {result.rankings.length > 0 && (
            <Card className="mt-6 overflow-hidden">
              <CardHeader title="Not eligible" subtitle="These suppliers cannot fulfil the requirement." />
              <div className="mt-3 border-t border-line">
                <IneligibleSuppliers result={result} />
              </div>
            </Card>
          )}
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-semibold text-ink">
              {ranked.length} supplier{ranked.length > 1 ? 's' : ''} ranked for {formatQty(qty, product.unit)}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
              {result.ranking_rule}
              {result.uses_mock_data && <Badge tone="violet">Sample supplier data — not live</Badge>}
            </div>
          </div>

          <Card className="mb-6 border-[#dcd2ff] p-6 shadow-[0_0_0_4px_rgba(155,92,255,0.05),0_4px_16px_-6px_rgba(49,84,223,0.08)]">
            <ProcurementAdvisorPanel result={result} selectedId={selected?.supplier_id ?? null} onSelect={setSelectedId} onCompare={() => setCompareOpen(true)} />
          </Card>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="min-w-0 space-y-6">
              <Card className="min-w-0 overflow-hidden">
                <CardHeader title="Supplier comparison" subtitle="Click a supplier to see its score breakdown." />
                <div className="mt-3">
                  <SupplierRankingTable result={result} selectedId={selected?.supplier_id ?? null} onSelect={setSelectedId} />
                </div>
              </Card>
              <Card className="p-6">
                <h3 className="mb-4 text-[15px] font-semibold text-ink">Compatibility by criterion</h3>
                <ScoreBreakdownChart result={result} />
              </Card>
              {result.rankings.some((r) => r.rank === null) && (
                <Card className="overflow-hidden">
                  <CardHeader title="Not eligible" subtitle="Excluded from the ranking because they cannot fulfil the requirement." />
                  <div className="mt-3 border-t border-line">
                    <IneligibleSuppliers result={result} />
                  </div>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              {selected && (
                <Card className="p-6">
                  <div className="mb-4 flex items-center gap-2.5">
                    <RankingLogo ranking={selected} size="sm" />
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold text-ink">Score breakdown — {selected.supplier_name}</h3>
                      <p className="text-[12px] text-muted">Rank #{selected.rank}</p>
                    </div>
                  </div>
                  <CriteriaBreakdown ranking={selected} />
                  <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{selected.explanation}</p>
                </Card>
              )}
            </div>
          </div>

          <Modal open={compareOpen} onClose={() => setCompareOpen(false)} size="xl" title="Compare recommended suppliers" description="Green checks mark the best value on each measure." icon={<GitCompareArrows className="h-5 w-5" />}>
            <RecommendedComparison result={result} />
          </Modal>

          {/* Action bar */}
          {selected && (
            <div className="sticky bottom-4 z-20 mt-6">
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white/95 px-5 py-4 shadow-lift backdrop-blur">
                <RankingLogo ranking={selected} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-ink">
                    {selected.supplier_name} <span className="font-normal text-muted">· {Math.round(selected.compatibility_score ?? 0)}% compatibility</span>
                  </div>
                  <div className="text-[12.5px] text-muted">
                    {formatQty(qty, product.unit)}
                    {selected.supplier.total_price !== null && ` · ${formatRM(selected.supplier.total_price)}`}
                    {selected.supplier.delivery_days !== null && ` · ${selected.supplier.delivery_days}-day delivery`}
                    {isOverride && <span className="ml-2 font-medium text-warning-ink">Differs from the AI recommendation</span>}
                    {!quote && <span className="ml-2 font-medium text-warning-ink">No quotation on file for this supplier</span>}
                  </div>
                </div>
                <Button variant="outline" onClick={() => setViewOpen(true)} disabled={!quote}>
                  <FileText className="h-4 w-4" /> View Quotation
                </Button>
                <Button onClick={() => setConfirmOpen(true)} disabled={!quote}>
                  <ClipboardCheck className="h-4 w-4" /> {overrideFor ? 'Update Approval Request' : 'Request Manager Approval'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {selected && quote && (
        <Modal
          open={viewOpen}
          onClose={() => setViewOpen(false)}
          size="lg"
          title={`Quotation from ${selected.supplier_name}`}
          description={`Ref. QT-${selected.supplier_id.slice(2, 4).toUpperCase()}-${product.sku.slice(-3)} · issued ${formatDate(quote.issuedAt)}`}
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
                <div className="font-semibold text-ink">{selected.supplier_name}</div>
                <div className="text-muted">{selected.supplier.location}</div>
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
                  <td className="py-3 text-right tabular">{formatRM(quote.unitPrice)}</td>
                  <td className="py-3 text-right tabular">{formatRM(quote.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="pt-3 text-right text-muted">
                    Delivery
                  </td>
                  <td className="pt-3 text-right tabular">{formatRM(quote.deliveryFee)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="pt-2 text-right font-semibold">
                    Total
                  </td>
                  <td className="pt-2 text-right text-[16px] font-semibold tabular">{formatRM(quote.total)}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-subtle p-4 text-[13px] sm:grid-cols-4">
              <div>
                <div className="text-muted">Lead time</div>
                <div className="font-medium">{quote.leadTimeDays} days</div>
              </div>
              <div>
                <div className="text-muted">MOQ</div>
                <div className="font-medium">{formatQty(quote.moq, product.unit)}</div>
              </div>
              <div>
                <div className="text-muted">Payment</div>
                <div className="font-medium">{quote.paymentTerms}</div>
              </div>
              <div>
                <div className="text-muted">Valid until</div>
                <div className="font-medium">{formatDate(quote.expiresAt)}</div>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12px] text-muted">
            <DemoTag /> Mock quotation generated from the supplier's catalogue pricing.
          </div>
        </Modal>
      )}

      {selected && quote && (
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
              <span className="font-medium">{selected.supplier_name}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted">Compatibility</span>
              <span className="font-medium tabular">
                {Math.round(selected.compatibility_score ?? 0)}% (rank #{selected.rank})
              </span>
            </div>
            <div className="mt-1 flex justify-between border-t border-line pt-2 text-[15px]">
              <span className="font-semibold">Estimated total</span>
              <span className="font-semibold tabular">{formatRM(quote.total)}</span>
            </div>
          </div>
          {isOverride && <p className="mt-3 text-[12.5px] text-warning-ink">You selected a supplier other than the top-ranked one. Please record why.</p>}
        </ConfirmDialog>
      )}
    </div>
  )
}
