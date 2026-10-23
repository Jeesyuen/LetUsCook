import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CircleCheck, ClipboardCheck, GitCompareArrows, Sparkles, Truck, X } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useRecommendations, type Recommendation } from '@/hooks/useDerived'
import { CompatibilityScore, ProductThumb, RiskBadge, SupplierLogo } from '@/components/common'
import { CategoryBadge } from '@/components/SupplierComparison'
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Overlay'
import { formatShortDate } from '@/utils/date'
import { formatQty, formatRM } from '@/utils/format'

function AIRecommendationCard({ rec, onRequest, onDismiss }: { rec: Recommendation; onRequest: () => void; onDismiss: () => void }) {
  const navigate = useNavigate()
  const { product, forecast, best } = rec
  const compare = () => navigate(`/app/quotations?product=${product.id}&qty=${forecast.suggestedQty}`)
  return (
    <Card className="flex flex-col p-5 transition-all duration-200 hover:shadow-lift">
      <div className="flex items-start gap-3">
        <ProductThumb product={product} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-ink">{product.name}</div>
          <div className="text-[12.5px] text-muted">
            {formatQty(product.currentStock, product.unit)} in stock · out {forecast.stockoutDate ? formatShortDate(forecast.stockoutDate) : '—'}
          </div>
        </div>
        <RiskBadge risk={forecast.risk} />
      </div>

      {best ? (
        <div className="mt-4 flex items-center gap-4 rounded-2xl bg-subtle/70 p-3.5">
          <CompatibilityScore score={best.score} size={56} highlight />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <SupplierLogo supplier={best.supplier} size="sm" />
              <span className="truncate text-[13.5px] font-semibold text-ink">{best.supplier.name}</span>
            </div>
            <div className="mt-1 text-[12.5px] text-muted">
              {best.quotation.leadTimeDays}-day delivery · {best.supplier.reliability}% reliable
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-subtle/70 p-3.5 text-[13px] text-muted">No supplier quotations on file for this product yet.</p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
        <div>
          <dt className="text-muted">Recommended qty</dt>
          <dd className="mt-0.5 text-[15px] font-semibold text-ink tabular">{formatQty(forecast.suggestedQty, product.unit)}</dd>
        </div>
        <div>
          <dt className="text-muted">Estimated cost</dt>
          <dd className="mt-0.5 text-[15px] font-semibold text-ink tabular">{best ? formatRM(best.quotation.total) : '—'}</dd>
        </div>
      </dl>

      {best && rec.categories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rec.categories.map((c) => (
            <CategoryBadge key={c} category={c} />
          ))}
        </div>
      )}
      {best && <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-muted">{rec.explanation.summary}</p>}
      {best && rec.alternatives.length > 0 && (
        <div className="mt-3 text-[12.5px] text-muted">
          <span className="font-medium text-ink">Alternatives:</span> {rec.alternatives.map((a) => `${a.name} (${a.score}%)`).join(' · ')}
        </div>
      )}

      <div className="mt-auto pt-4">
        {rec.openPO ? (
          <Button variant="outline" className="w-full" onClick={() => navigate(`/app/purchase-orders?po=${rec.openPO!.id}`)}>
            <Truck className="h-4 w-4" /> {rec.openPO.number} · {rec.openPO.status}
          </Button>
        ) : rec.pendingApproval ? (
          <Button variant="outline" className="w-full" onClick={() => navigate('/app/approvals')}>
            <ClipboardCheck className="h-4 w-4" /> Awaiting approval
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={compare} disabled={!best}>
              <GitCompareArrows className="h-4 w-4" /> Review Comparison
            </Button>
            <Button size="sm" className="flex-1" onClick={onRequest} disabled={!best}>
              Request Approval
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDismiss} aria-label={`Dismiss recommendation for ${product.name}`} title="Dismiss">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

export default function Recommendations() {
  const navigate = useNavigate()
  const recs = useRecommendations()
  const dismissed = useAppStore((s) => s.dismissedRecs)
  const dismiss = useAppStore((s) => s.dismissRecommendation)
  const restore = useAppStore((s) => s.restoreRecommendations)
  const request = useAppStore((s) => s.requestApproval)
  const [requesting, setRequesting] = useState<Recommendation | null>(null)
  const [dismissing, setDismissing] = useState<Recommendation | null>(null)

  const actionable = recs.filter((r) => !r.pendingApproval && !r.openPO)
  const inProgress = recs.filter((r) => r.pendingApproval || r.openPO)
  const totalCost = actionable.reduce((s, r) => s + (r.best?.quotation.total ?? 0), 0)

  return (
    <div>
      <PageHeader
        title="AI Recommendations"
        subtitle="Smarter purchasing decisions, backed by your inventory data."
        actions={
          dismissed.length > 0 && (
            <Button variant="ghost" onClick={restore}>
              Restore {dismissed.length} dismissed
            </Button>
          )
        }
      />

      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-line bg-white px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f3ecff] text-violet">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-ink">
            <span className="font-semibold">{actionable.length} products</span> need a purchasing decision{actionable.length ? <> — about <span className="font-semibold">{formatRM(totalCost)}</span> at the best-ranked quotes.</> : '.'}
            <span className="text-muted"> {inProgress.length} more already in progress.</span>
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Ranked by AI Procurement Advisor using balanced supplier scores and inventory stockout forecasts.
          </p>
        </div>
      </div>

      {recs.length === 0 ? (
        <Card>
          <EmptyState icon={<CircleCheck className="h-7 w-7" />} title="Nothing to restock right now" description="All products have healthy cover or open orders. New recommendations appear automatically as stock runs down." action={<Button variant="outline" onClick={() => navigate('/app/forecasting')}>View forecasts</Button>} />
        </Card>
      ) : (
        <>
          {actionable.length > 0 && (
            <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {actionable.map((r) => (
                <AIRecommendationCard key={r.product.id} rec={r} onRequest={() => setRequesting(r)} onDismiss={() => setDismissing(r)} />
              ))}
            </div>
          )}
          {inProgress.length > 0 && (
            <>
              <h2 className="mb-3 text-[15px] font-semibold text-ink">In progress</h2>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {inProgress.map((r) => (
                  <AIRecommendationCard key={r.product.id} rec={r} onRequest={() => setRequesting(r)} onDismiss={() => setDismissing(r)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!requesting}
        onClose={() => setRequesting(null)}
        title="Request approval for this recommendation?"
        description="A pending approval is created with the top-ranked supplier. No PO is issued until a manager approves."
        confirmLabel="Request Approval"
        onConfirm={() => {
          const r = requesting
          if (!r?.best) return
          request({ productId: r.product.id, quantity: r.forecast.suggestedQty, supplierId: r.best.supplier.id, priority: 'balanced', score: r.best.score, reason: r.explanation.summary })
          toast.success('Approval requested', { description: `${r.product.name} — ${r.best.supplier.name}`, action: { label: 'View', onClick: () => navigate('/app/approvals') } })
        }}
      >
        {requesting?.best && (
          <div className="rounded-xl border border-line p-4 text-[13.5px]">
            <div className="flex justify-between py-1">
              <span className="text-muted">{requesting.product.name}</span>
              <span className="font-medium tabular">{formatQty(requesting.forecast.suggestedQty, requesting.product.unit)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted">{requesting.best.supplier.name}</span>
              <span className="font-medium tabular">{requesting.best.score}% match</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-line pt-2 text-[15px] font-semibold">
              <span>Total</span>
              <span className="tabular">{formatRM(requesting.best.quotation.total)}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={!!dismissing}
        onClose={() => setDismissing(null)}
        title={`Dismiss ${dismissing?.product.name ?? ''}?`}
        description="It will reappear if stock changes or after you restore dismissed items."
        confirmLabel="Dismiss"
        onConfirm={() => {
          if (dismissing) dismiss(dismissing.product.id)
          toast('Recommendation dismissed', { action: { label: 'Undo', onClick: restore } })
        }}
      />
    </div>
  )
}
