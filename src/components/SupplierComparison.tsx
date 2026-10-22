import { AlertCircle, Check, Clock, MapPin, ShieldCheck, Star, Tag, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ScoredQuotation } from '@/services/scoring'
import { criterionLabels, DELIVERY_PENALTY_PER_DAY, PRICE_PENALTY_PER_PCT } from '@/services/scoring'
import type { ScoringWeights } from '@/types'
import { CompatibilityScore, SupplierLogo } from './common'
import { Badge, InfoTip } from './ui/primitives'
import { formatDate } from '@/utils/date'
import { cn, formatQty, formatRM } from '@/utils/format'

export const matchLabel = (score: number) => (score >= 85 ? 'Strong Match' : score >= 70 ? 'Good Match' : score >= 55 ? 'Fair Match' : 'Weak Match')

export function ScoreExplainer() {
  return (
    <InfoTip>
      Compatibility is a weighted decision-support score, not a probability. Each factor is normalised to 0–100 — price (−{PRICE_PENALTY_PER_PCT} pts per 1% above the lowest landed cost), delivery (−{DELIVERY_PENALTY_PER_DAY} pts per day slower than the fastest), reliability (on-time-in-full %), quality (rating × 20) and order fit (meets MOQ) — then combined using the priority weights.
    </InfoTip>
  )
}

export function QuoteCard({ item, unit, selected, onSelect }: { item: ScoredQuotation; unit: string; selected: boolean; onSelect: () => void }) {
  const best = item.rank === 1
  const q = item.quotation
  const s = item.supplier
  return (
    <motion.div
      layout
      transition={{ type: 'spring', duration: 0.45, bounce: 0.12 }}
      onClick={onSelect}
      className={cn(
        'relative flex w-full cursor-pointer flex-col rounded-[20px] border bg-white p-5 text-left transition-shadow duration-200 hover:shadow-lift',
        best ? 'border-primary/50 shadow-[0_0_0_4px_rgba(49,84,223,0.07),0_12px_32px_-14px_rgba(49,84,223,0.35)]' : 'border-line shadow-card',
        selected && !best && 'border-ink/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <SupplierLogo supplier={s} />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-ink">{s.name}</div>
            <div className="flex items-center gap-1.5 text-[12.5px] text-muted">
              <span>{s.location}</span>
              {typeof (q.distanceKm ?? s.distanceKm) === 'number' && (
                <>
                  <span>·</span>
                  <span>{q.distanceKm ?? s.distanceKm} km away</span>
                </>
              )}
              <span>·</span>
              <span>Rank #{item.rank}</span>
            </div>
          </div>
        </div>
        {best && (
          <Badge tone="primary" className="absolute -top-3 right-5 border-primary bg-primary text-white shadow-[0_6px_14px_-6px_rgba(49,84,223,0.7)]">
            <Star className="h-3 w-3 fill-current" /> Recommended
          </Badge>
        )}
      </div>

      {(q.tags && q.tags.length > 0 || q.quantity < q.moq) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {q.tags?.includes('cheapest') && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              <Tag className="h-3 w-3 stroke-[2.2]" /> Lowest Cost
            </span>
          )}
          {q.tags?.includes('nearest') && (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              <MapPin className="h-3 w-3 stroke-[2.2]" /> Nearest
            </span>
          )}
          {q.tags?.includes('fastest') && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              <Zap className="h-3 w-3 stroke-[2.2]" /> Fastest
            </span>
          )}
          {q.quantity < q.moq && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
              <AlertCircle className="h-3 w-3 stroke-[2.2]" /> Below MOQ ({formatQty(q.moq, unit)})
            </span>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center gap-4">
        <CompatibilityScore score={item.score} size={best ? 84 : 72} highlight={best} />
        <div>
          <div className="flex items-center gap-1.5 text-[12.5px] text-muted">
            Compatibility <ScoreExplainer />
          </div>
          <div className={cn('mt-0.5 text-[15px] font-semibold', best ? 'text-primary' : 'text-ink')}>{matchLabel(item.score)}</div>
        </div>
      </div>

      <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-[12.5px] text-muted">Total quotation</span>
        <span className="text-[22px] font-semibold tracking-tight text-ink tabular">{formatRM(q.total)}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-end gap-1.5 text-right text-[12px] text-muted">
        <span>{formatRM(q.unitPrice)}/{unit} · {q.deliveryFee ? `+${formatRM(q.deliveryFee)} freight` : 'free freight'}</span>
        {q.quantity > 0 && (
          <span className="font-medium text-ink">
            ({formatRM(q.total / q.quantity)}/{unit} landed)
          </span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2.5 text-[12.5px]">
        <div className="rounded-xl bg-subtle px-3 py-2">
          <dt className="flex items-center gap-1 text-muted">
            <Clock className="h-3.5 w-3.5" /> Delivery
          </dt>
          <dd className="mt-0.5 text-[14px] font-semibold text-ink">{q.leadTimeDays} {q.leadTimeDays === 1 ? 'day' : 'days'}</dd>
        </div>
        <div className="rounded-xl bg-subtle px-3 py-2">
          <dt className="flex items-center gap-1 text-muted">
            <ShieldCheck className="h-3.5 w-3.5" /> Reliability
          </dt>
          <dd className="mt-0.5 text-[14px] font-semibold text-ink">{s.isNew ? '—' : `${s.reliability}%`}</dd>
        </div>
        <div className="rounded-xl bg-subtle px-3 py-2">
          <dt className="text-muted">Quality</dt>
          <dd className="mt-0.5 text-[14px] font-semibold text-ink">{s.qualityRating.toFixed(1)} / 5</dd>
        </div>
        <div className="rounded-xl bg-subtle px-3 py-2">
          <dt className="text-muted">MOQ</dt>
          <dd className="mt-0.5 text-[14px] font-semibold text-ink">{formatQty(q.moq, unit)}</dd>
        </div>
      </dl>

      <button
        type="button"
        aria-pressed={selected}
        onClick={(e) => (e.stopPropagation(), onSelect())}
        className={cn('mt-4 flex h-9 items-center justify-center gap-2 rounded-xl text-[13px] font-medium transition focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none', selected ? 'bg-primary text-white' : 'border border-line text-ink hover:bg-subtle')}
      >
        {selected ? (
          <>
            <Check className="h-4 w-4" /> Selected
          </>
        ) : (
          'Select Supplier'
        )}
      </button>
    </motion.div>
  )
}

/** Side-by-side comparison table with objective "best value" markers. */
export function SupplierComparisonTable({ ranked, unit }: { ranked: ScoredQuotation[]; unit: string }) {
  const min = (f: (r: ScoredQuotation) => number) => Math.min(...ranked.map(f))
  const max = (f: (r: ScoredQuotation) => number) => Math.max(...ranked.map(f))
  const rows: { label: string; value: (r: ScoredQuotation) => string; best?: (r: ScoredQuotation) => boolean }[] = [
    { label: 'Unit price', value: (r) => formatRM(r.quotation.unitPrice), best: (r) => r.quotation.unitPrice === min((x) => x.quotation.unitPrice) },
    { label: 'Subtotal', value: (r) => formatRM(r.quotation.subtotal) },
    { label: 'Delivery fee', value: (r) => (r.quotation.deliveryFee ? formatRM(r.quotation.deliveryFee) : 'Free'), best: (r) => r.quotation.deliveryFee === min((x) => x.quotation.deliveryFee) },
    { label: 'Total cost', value: (r) => formatRM(r.quotation.total), best: (r) => r.quotation.total === min((x) => x.quotation.total) },
    { label: 'Delivery lead time', value: (r) => `${r.quotation.leadTimeDays} days`, best: (r) => r.quotation.leadTimeDays === min((x) => x.quotation.leadTimeDays) },
    { label: 'Reliability', value: (r) => (r.supplier.isNew ? '—' : `${r.supplier.reliability}%`), best: (r) => r.supplier.reliability === max((x) => x.supplier.reliability) },
    { label: 'Quality', value: (r) => `${r.supplier.qualityRating.toFixed(1)} / 5`, best: (r) => r.supplier.qualityRating === max((x) => x.supplier.qualityRating) },
    { label: 'Minimum order', value: (r) => formatQty(r.quotation.moq, unit), best: (r) => r.quotation.quantity >= r.quotation.moq },
    { label: 'Payment terms', value: (r) => r.quotation.paymentTerms },
    { label: 'Quotation valid until', value: (r) => formatDate(r.quotation.expiresAt) },
  ]
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[640px] text-[13.5px]">
        <thead>
          <tr className="border-b border-line">
            <th className="w-[200px] py-3 pr-4 pl-5 text-left text-[12.5px] font-medium text-muted">Criteria</th>
            {ranked.map((r) => (
              <th key={r.supplier.id} className="px-4 py-3 text-left">
                <div className="flex items-center gap-2">
                  <SupplierLogo supplier={r.supplier} size="sm" />
                  <span className="text-[13px] font-semibold text-ink">{r.supplier.name}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-line/70 last:border-0 hover:bg-[#fafbfe]">
              <td className="py-3 pr-4 pl-5 text-muted">{row.label}</td>
              {ranked.map((r) => {
                const good = row.best?.(r) && ranked.length > 1
                return (
                  <td key={r.supplier.id} className="px-4 py-3">
                    <span className={cn('inline-flex items-center gap-1.5 tabular', good ? 'font-semibold text-ink' : 'text-ink')}>
                      {good && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success-soft text-success">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                      {row.value(r)}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
          <tr className="bg-[#fafbff]">
            <td className="py-3.5 pr-4 pl-5 font-semibold text-ink">Compatibility</td>
            {ranked.map((r) => (
              <td key={r.supplier.id} className="px-4 py-3.5">
                <span className={cn('text-[15px] font-semibold tabular', r.rank === 1 ? 'text-primary' : 'text-ink')}>{r.score}%</span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

const BAR_COLORS: Record<keyof ScoringWeights, string> = {
  price: '#3154DF',
  delivery: '#9B5CFF',
  reliability: '#151DA4',
  quality: '#8FA6FF',
  compatibility: '#C9B3FF',
}

/** Stacked bars showing how each criterion contributes to every supplier's score. */
export function ScoreBreakdown({ ranked, weights }: { ranked: ScoredQuotation[]; weights: ScoringWeights }) {
  const keys = Object.keys(weights) as (keyof ScoringWeights)[]
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
        {keys.map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-[12.5px] text-muted">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: BAR_COLORS[k] }} />
            {criterionLabels[k]} <span className="text-[#a3a9bb]">{weights[k]}%</span>
          </span>
        ))}
      </div>
      <div className="space-y-3.5">
        {ranked.map((r) => (
          <div key={r.supplier.id}>
            <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
              <span className="font-medium text-ink">{r.supplier.name}</span>
              <span className="font-semibold text-ink tabular">{r.score}%</span>
            </div>
            <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-[#eef0f7]">
              {keys.map((k) => (
                <motion.div
                  key={k}
                  className="group/seg relative h-full first:rounded-l-full"
                  style={{ background: BAR_COLORS[k] }}
                  initial={{ width: 0 }}
                  animate={{ width: `${r.contributions[k]}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  title={`${criterionLabels[k]}: ${r.criteria[k]}/100 × ${weights[k]}% = ${r.contributions[k]} pts`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
