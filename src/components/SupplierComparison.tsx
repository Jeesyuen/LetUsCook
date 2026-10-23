import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, CircleCheck, Clock, GitCompareArrows, Sparkles, TriangleAlert } from 'lucide-react'
import { getAIProcurementAdvice } from '@/services/runpodClient'
import { findSupplier } from '@/data/supplierRegistry'
import {
  categoryLabels,
  CRITERIA,
  criterionLabels,
  DELIVERY_SMOOTHING_DAYS,
  DISTANCE_SMOOTHING_KM,
  PRICE_PENALTY_PER_PCT,
  type CompareSuppliersResponse,
  type Criterion,
  type PurchaseUrgency,
  type RecommendationCategory,
  type SupplierRanking,
  type SupplierSuggestion,
} from '@/services/matching'
import { CompatibilityScore, SupplierLogo } from './common'
import { Badge, InfoTip } from './ui/primitives'
import { Button } from './ui/Button'
import { cn, formatRM } from '@/utils/format'

export const matchLabel = (score: number) => (score >= 85 ? 'Strong Match' : score >= 70 ? 'Good Match' : score >= 55 ? 'Fair Match' : 'Weak Match')

const CRITERION_COLORS: Record<Criterion, string> = {
  price: '#3154DF',
  delivery: '#9B5CFF',
  reliability: '#151DA4',
  distance: '#8FA6FF',
  product_suitability: '#C9B3FF',
}

export function ScoreExplainer() {
  return (
    <InfoTip>
      Compatibility is a weighted decision-support score, not a probability. Each criterion is normalised to 0–100: price (−{PRICE_PENALTY_PER_PCT} pts per 1% above the lowest total), delivery and distance (relative to the
      fastest / nearest, smoothed by {DELIVERY_SMOOTHING_DAYS} day / {DISTANCE_SMOOTHING_KM} km), reliability (on-time-in-full %) and product suitability. Missing data is not scored and the other weights are rescaled.
    </InfoTip>
  )
}

/** Directory logo when the supplier is known; neutral initials for suppliers outside the directory. */
export function RankingLogo({ ranking, size = 'md' }: { ranking: SupplierRanking; size?: 'sm' | 'md' }) {
  const known = findSupplier(ranking.supplier_id)
  const initials = ranking.supplier_name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
  return <SupplierLogo supplier={known ?? { initials, brandColor: '#8F9BC4' }} size={size} />
}

const fmtDays = (n: number | null) => (n === null ? null : `${n} ${n === 1 ? 'day' : 'days'}`)
const missing = <span className="text-[#9aa1b5]">Not available</span>

export function CategoryBadge({ category }: { category: RecommendationCategory }) {
  return (
    <Badge tone={category === 'best_overall' ? 'primary' : 'violet'}>
      {category === 'best_overall' && <Sparkles className="h-3 w-3" />}
      {categoryLabels[category]}
    </Badge>
  )
}

const urgencyStyle: Record<PurchaseUrgency, { label: string; tone: 'critical' | 'warning' | 'success' | 'neutral' }> = {
  critical: { label: 'Urgent purchase', tone: 'critical' },
  soon: { label: 'Time-sensitive', tone: 'warning' },
  healthy: { label: 'Stock healthy', tone: 'success' },
  unknown: { label: 'No forecast', tone: 'neutral' },
}

function SuggestionCard({ s, primary, selected, onSelect }: { s: SupplierSuggestion; primary: boolean; selected: boolean; onSelect: () => void }) {
  return (
    <motion.div
      layout
      transition={{ type: 'spring', duration: 0.45, bounce: 0.12 }}
      className={cn(
        'relative flex flex-col rounded-[20px] border bg-white p-5',
        primary ? 'border-primary/50 shadow-[0_0_0_4px_rgba(49,84,223,0.07),0_12px_32px_-14px_rgba(49,84,223,0.35)]' : 'border-line shadow-card',
        selected && !primary && 'border-ink/30',
      )}
    >
      <div className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">{primary ? 'Recommended' : 'Alternative'} · Rank #{s.rank}</div>
      <div className="mt-2 flex items-center gap-3">
        <CompatibilityScore score={s.compatibility_score} size={primary ? 64 : 56} highlight={primary} />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-ink">{s.supplier_name}</div>
          <div className="text-[12px] text-muted">compatibility</div>
        </div>
      </div>
      {(s.categories.length > 0 || s.arrives_before_stockout !== null) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {s.categories.map((c) => (
            <CategoryBadge key={c} category={c} />
          ))}
          {s.arrives_before_stockout === true && (
            <Badge tone="success">
              <CircleCheck className="h-3 w-3" /> Before stockout
            </Badge>
          )}
          {s.arrives_before_stockout === false && (
            <Badge tone="critical">
              <Clock className="h-3 w-3" /> After stockout
            </Badge>
          )}
        </div>
      )}
      <p className="mt-3 text-[13px] leading-relaxed text-ink">{s.why}</p>
      {s.advantages.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {s.advantages.map((t) => (
            <li key={t} className="flex gap-2 text-[12.5px] leading-relaxed text-muted">
              <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
              {t}
            </li>
          ))}
        </ul>
      )}
      {s.drawbacks.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {s.drawbacks.map((t) => (
            <li key={t} className="flex gap-2 text-[12.5px] leading-relaxed text-muted">
              <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
              {t}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 rounded-xl bg-subtle px-3 py-2 text-[12.5px] leading-relaxed text-ink">{s.choose_when}</p>
      <div className="mt-auto pt-4">
        <button
          type="button"
          aria-pressed={selected}
          onClick={onSelect}
          className={cn(
            'flex h-9 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-medium transition focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
            selected ? 'bg-primary text-white' : 'border border-line text-ink hover:bg-subtle',
          )}
        >
          {selected ? (
            <>
              <Check className="h-4 w-4" /> Selected
            </>
          ) : (
            'Select Supplier'
          )}
        </button>
      </div>
    </motion.div>
  )
}

/** AI Procurement Advisor: urgency-aware advice with the primary pick and two alternatives. */
export function ProcurementAdvisorPanel({
  result,
  selectedId,
  onSelect,
  onCompare,
}: {
  result: CompareSuppliersResponse
  selectedId: string | null
  onSelect: (id: string) => void
  onCompare: () => void
}) {
  const advice = result.advice
  const [customAdvice, setCustomAdvice] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!advice) return

    const primary = result.rankings.find((r) => r.supplier_id === advice.primary_supplier_id)
    if (!primary) return

    const alts = result.rankings
      .filter((r) => r.supplier_id !== advice.primary_supplier_id && r.rank !== null)
      .slice(0, 2)
      .map((r) => ({
        name: r.supplier_name,
        totalPrice: r.supplier.total_price,
        deliveryDays: r.supplier.delivery_days,
      }))

    getAIProcurementAdvice(
      result.product,
      result.priority,
      result.days_until_stockout,
      {
        name: primary.supplier_name,
        totalPrice: primary.supplier.total_price,
        deliveryDays: primary.supplier.delivery_days,
        reliability: primary.supplier.reliability,
      },
      alts
    ).then((text) => {
      if (active && text) setCustomAdvice(text)
    })

    return () => {
      active = false
    }
  }, [advice, result])

  if (!advice) return null
  const u = urgencyStyle[advice.urgency]
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3ecff] text-violet">
            <Sparkles className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold text-ink">AI Procurement Advisor</h2>
            <p className="text-[12.5px] text-muted">Top suppliers for this purchase, with when to choose each one.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={u.tone} dot>
            {u.label}
          </Badge>
          {advice.suggestions.length > 1 && (
            <Button size="sm" variant="outline" onClick={onCompare}>
              <GitCompareArrows className="h-4 w-4" /> Compare
            </Button>
          )}
        </div>
      </div>

      <p className="mt-4 text-[14.5px] leading-relaxed text-ink">{customAdvice || advice.final_recommendation}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{advice.urgency_note}</p>
      {advice.warnings.length > 0 && (
        <ul className="mt-3 space-y-1.5 rounded-xl border border-[#f6e1b9] bg-warning-soft/50 px-3.5 py-2.5">
          {advice.warnings.map((t) => (
            <li key={t} className="flex gap-2 text-[12.5px] leading-relaxed text-warning-ink">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t}
            </li>
          ))}
        </ul>
      )}

      <div className={cn('mt-5 grid gap-4', advice.suggestions.length >= 3 ? 'lg:grid-cols-3' : advice.suggestions.length === 2 ? 'md:grid-cols-2' : '')}>
        {advice.suggestions.map((s) => (
          <SuggestionCard key={s.supplier_id} s={s} primary={s.supplier_id === advice.primary_supplier_id} selected={s.supplier_id === selectedId} onSelect={() => onSelect(s.supplier_id)} />
        ))}
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-[#9aa1b5]">
        Generated from calculated scores, supplier data and inventory stock forecast. <ScoreExplainer />
      </p>
    </div>
  )
}

/** Side-by-side comparison of the advisor's recommended suppliers. */
export function RecommendedComparison({ result }: { result: CompareSuppliersResponse }) {
  const advice = result.advice
  if (!advice) return null
  const list = advice.suggestions.map((s) => ({ s, r: result.rankings.find((x) => x.supplier_id === s.supplier_id)! }))
  const best = (f: (r: SupplierRanking) => number | null | undefined, dir: 'min' | 'max') => {
    const v = list.map(({ r }) => f(r)).filter((x): x is number => x !== null && x !== undefined)
    return v.length > 1 ? (dir === 'min' ? Math.min(...v) : Math.max(...v)) : null
  }
  const rows: { label: string; value: (r: SupplierRanking, s: SupplierSuggestion) => string; metric?: (r: SupplierRanking) => number | null | undefined; dir?: 'min' | 'max' }[] = [
    { label: 'Compatibility', value: (_r, s) => `${Math.round(s.compatibility_score)}%`, metric: (r) => r.compatibility_score, dir: 'max' },
    { label: 'Total price', value: (r) => (r.supplier.total_price === null ? 'Not available' : formatRM(r.supplier.total_price)), metric: (r) => r.supplier.total_price, dir: 'min' },
    { label: 'Delivery', value: (r) => (r.supplier.delivery_days === null ? 'Not available' : `${r.supplier.delivery_days} days`), metric: (r) => r.supplier.delivery_days, dir: 'min' },
    { label: 'Distance', value: (r) => (r.supplier.distance_km === null ? 'Not available' : `${Math.round(r.supplier.distance_km)} km`), metric: (r) => r.supplier.distance_km, dir: 'min' },
    { label: 'Reliability', value: (r) => (r.supplier.reliability === null ? 'Not available' : `${r.supplier.reliability}%`), metric: (r) => r.supplier.reliability, dir: 'max' },
    { label: 'Product suitability', value: (r) => (r.supplier.product_suitability === null ? 'Not available' : `${r.supplier.product_suitability}%`), metric: (r) => r.supplier.product_suitability, dir: 'max' },
    { label: 'Before stockout', value: (_r, s) => (s.arrives_before_stockout === null ? 'Unknown' : s.arrives_before_stockout ? 'Yes' : 'No') },
    { label: 'Data coverage', value: (r) => `${Math.round(r.data_coverage * 100)}%` },
  ]
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="border-b border-line">
            <th className="w-[150px] py-3 pr-4 text-left text-[12.5px] font-medium text-muted">Criteria</th>
            {list.map(({ s, r }) => (
              <th key={s.supplier_id} className="px-3 py-3 text-left align-top">
                <div className="flex items-center gap-2">
                  <RankingLogo ranking={r} size="sm" />
                  <span className="text-[13px] font-semibold text-ink">{s.supplier_name}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {s.categories.map((c) => (
                    <CategoryBadge key={c} category={c} />
                  ))}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const target = row.metric && row.dir ? best(row.metric, row.dir) : null
            return (
              <tr key={row.label} className="border-b border-line/70 last:border-0">
                <td className="py-2.5 pr-4 text-muted">{row.label}</td>
                {list.map(({ s, r }) => {
                  const good = target !== null && row.metric!(r) === target
                  return (
                    <td key={s.supplier_id} className="px-3 py-2.5">
                      <span className={cn('inline-flex items-center gap-1.5 tabular', good ? 'font-semibold text-ink' : 'text-ink')}>
                        {good && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success-soft text-success">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                        {row.value(r, s)}
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
          <tr>
            <td className="py-2.5 pr-4 align-top text-muted">When to choose</td>
            {list.map(({ s }) => (
              <td key={s.supplier_id} className="px-3 py-2.5 align-top text-[12.5px] leading-relaxed text-ink">
                {s.choose_when}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** Supplier comparison table: every ranked supplier with its key measures and compatibility. */
export function SupplierRankingTable({ result, selectedId, onSelect }: { result: CompareSuppliersResponse; selectedId: string | null; onSelect: (id: string) => void }) {
  const ranked = result.rankings.filter((r) => r.rank !== null)
  const primaryId = result.advice?.primary_supplier_id ?? result.recommended_supplier_id
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[820px] text-[13.5px]">
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-muted">
            <th className="py-3 pr-2 pl-5 font-medium">Rank</th>
            <th className="px-3 py-3 font-medium">Supplier</th>
            <th className="px-3 py-3 text-right font-medium">Total price</th>
            <th className="px-3 py-3 text-right font-medium">Distance</th>
            <th className="px-3 py-3 text-right font-medium">Delivery</th>
            <th className="px-3 py-3 text-right font-medium">Reliability</th>
            <th className="px-3 py-3 pr-5 font-medium">Compatibility</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r) => {
            const s = r.supplier
            const top = r.supplier_id === primaryId
            const selected = r.supplier_id === selectedId
            const cats = result.advice?.categories[r.supplier_id] ?? []
            return (
              <tr
                key={r.supplier_id}
                onClick={() => onSelect(r.supplier_id)}
                aria-selected={selected}
                className={cn('cursor-pointer border-b border-line/70 transition-colors last:border-0', selected ? 'bg-[#f5f7ff]' : 'hover:bg-[#fafbfe]', top && 'shadow-[inset_3px_0_0_#3154DF]')}
              >
                <td className="py-3.5 pr-2 pl-5">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold tabular', top ? 'bg-primary text-white' : 'bg-subtle text-muted')}>{r.rank}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <RankingLogo ranking={r} size="sm" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
                        {r.supplier_name}
                        {top && (
                          <Badge tone="primary">
                            <Sparkles className="h-3 w-3" /> AI Recommended
                          </Badge>
                        )}
                        {r.eligibility === 'unverified' && <Badge tone="warning">Unverified data</Badge>}
                      </div>
                      {s.location && <div className="text-[12px] text-muted">{s.location}</div>}
                      {cats.filter((c) => c !== 'best_overall').length > 0 && (
                        <div className="mt-1 text-[11.5px] font-medium text-[#7a3fe0]">
                          {cats
                            .filter((c) => c !== 'best_overall')
                            .map((c) => categoryLabels[c])
                            .join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular">
                  {s.total_price === null ? missing : <span className="font-semibold text-ink">{formatRM(s.total_price)}</span>}
                  {s.unit_price != null && (
                    <div className="text-[11.5px] text-muted">
                      {formatRM(s.unit_price)}/{result.unit}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-right tabular">{s.distance_km === null ? missing : `${Math.round(s.distance_km)} km`}</td>
                <td className="px-3 py-3 text-right tabular">{fmtDays(s.delivery_days) ?? missing}</td>
                <td className="px-3 py-3 text-right tabular">{s.reliability === null ? missing : `${s.reliability}%`}</td>
                <td className="px-3 py-3 pr-5">
                  <div className="flex items-center gap-2.5">
                    <CompatibilityScore score={r.compatibility_score ?? 0} size={40} highlight={top} label={false} />
                    <div>
                      <div className={cn('text-[15px] font-semibold tabular', top ? 'text-primary' : 'text-ink')}>{Math.round(r.compatibility_score ?? 0)}%</div>
                      {r.data_coverage < 1 && <div className="text-[11px] text-muted">{Math.round(r.data_coverage * 100)}% data</div>}
                    </div>
                    {selected && <Check className="ml-auto h-4 w-4 text-primary" aria-label="Selected" />}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Five-criterion score breakdown for one supplier. */
export function CriteriaBreakdown({ ranking }: { ranking: SupplierRanking }) {
  return (
    <div className="space-y-3.5">
      {CRITERIA.map((c) => {
        const d = ranking.details[c]
        return (
          <div key={c}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="flex items-center gap-1.5 font-medium text-ink">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: CRITERION_COLORS[c] }} />
                {criterionLabels[c]}
                <span className="font-normal text-[#a3a9bb]">
                  {d.weight}%{d.score !== null && d.applied_weight !== d.weight ? ` → ${d.applied_weight}%` : ''}
                </span>
              </span>
              <span className="text-muted tabular">
                {d.score === null ? (
                  <span className="text-[#9aa1b5]">Not scored — no data</span>
                ) : (
                  <>
                    <span className="font-semibold text-ink">{d.score}</span>/100 · {d.points.toFixed(1)} pts
                  </>
                )}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eef0f7]">
              <motion.div className="h-full rounded-full" style={{ background: CRITERION_COLORS[c] }} initial={{ width: 0 }} animate={{ width: `${d.score ?? 0}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
            </div>
          </div>
        )
      })}
      <div className="flex items-baseline justify-between border-t border-line pt-3 text-[13px]">
        <span className="text-muted">
          Compatibility{ranking.data_coverage < 1 ? ` · ${Math.round(ranking.data_coverage * 100)}% data coverage` : ''}
        </span>
        <span className="text-[16px] font-semibold text-ink tabular">{ranking.compatibility_score}%</span>
      </div>
    </div>
  )
}

/** Stacked bars: how each criterion contributes to every ranked supplier's score. */
export function ScoreBreakdownChart({ result }: { result: CompareSuppliersResponse }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
        {CRITERIA.map((c) => (
          <span key={c} className="flex items-center gap-1.5 text-[12.5px] text-muted">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: CRITERION_COLORS[c] }} />
            {criterionLabels[c]} <span className="text-[#a3a9bb]">{result.weights[c]}%</span>
          </span>
        ))}
      </div>
      <div className="space-y-3.5">
        {result.rankings
          .filter((r) => r.rank !== null)
          .map((r) => (
            <div key={r.supplier_id}>
              <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                <span className="truncate font-medium text-ink">{r.supplier_name}</span>
                <span className="font-semibold text-ink tabular">{Math.round(r.compatibility_score ?? 0)}%</span>
              </div>
              <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-[#eef0f7]">
                {CRITERIA.map((c) => (
                  <motion.div
                    key={c}
                    className="h-full first:rounded-l-full"
                    style={{ background: CRITERION_COLORS[c] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${r.details[c].points}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    title={`${criterionLabels[c]}: ${r.details[c].score ?? '—'}/100 → ${r.details[c].points} pts`}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

/** Suppliers that cannot fulfil the requirement, with the reasons. */
export function IneligibleSuppliers({ result }: { result: CompareSuppliersResponse }) {
  const list = result.rankings.filter((r) => r.rank === null)
  if (!list.length) return null
  return (
    <ul className="divide-y divide-line">
      {list.map((r) => (
        <li key={r.supplier_id} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
          <RankingLogo ranking={r} size="sm" />
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-ink">
              {r.supplier_name} {r.supplier.location && <span className="font-normal text-muted">· {r.supplier.location}</span>}
            </div>
            <div className="mt-0.5 text-[12.5px] text-[#c23f48]">{r.issues.join(' ')}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}
