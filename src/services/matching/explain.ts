// Data-grounded recommendation explanations. Every statement is built from the supplier data and the
// calculated scores — nothing is invented. An LLM may later rephrase the wording, but must not add
// facts or change the ranking.

import type { CompareSuppliersResponse, Criterion, RecommendationSummary, SupplierRanking } from './types'
import { criterionLabels, priorityLabels } from './config'
import { formatRM } from '@/utils/format'

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`
const km = (n: number) => `${Math.round(n)} km`
const has = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v)

function joinList(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function others(res: CompareSuppliersResponse, r: SupplierRanking) {
  return res.rankings.filter((o) => o.rank !== null && o.supplier_id !== r.supplier_id)
}

function best<T extends SupplierRanking>(list: T[], f: (o: T) => number | null | undefined, dir: 'min' | 'max'): T | undefined {
  return list.filter((o) => has(f(o))).sort((a, b) => (dir === 'min' ? f(a)! - f(b)! : f(b)! - f(a)!))[0]
}

export interface Analysis {
  advantages: string[]
  tradeoffs: string[]
  /** Short phrases for the summary, keyed by criterion */
  leads: Partial<Record<Criterion, string>>
  /** The most relevant trade-off, phrased to follow "Although" */
  mainTradeoff: string | null
}

export function analyse(res: CompareSuppliersResponse, r: SupplierRanking, daysLeft: number | null): Analysis {
  const s = r.supplier
  const rest = others(res, r)
  const a: Analysis = { advantages: [], tradeoffs: [], leads: {}, mainTradeoff: null }
  const tradeoffByCriterion: Partial<Record<Criterion, string>> = {}

  if (has(s.total_price)) {
    const o = best(rest, (x) => x.supplier.total_price, 'min')
    if (!o || s.total_price <= o.supplier.total_price!) {
      a.advantages.push(`Lowest total price at ${formatRM(s.total_price)}${o && s.total_price < o.supplier.total_price! ? `, ${formatRM(o.supplier.total_price! - s.total_price)} less than ${o.supplier_name}` : ''}.`)
      a.leads.price = 'the lowest total price'
    } else {
      const diff = s.total_price - o.supplier.total_price!
      const pct = Math.round((diff / o.supplier.total_price!) * 100)
      a.tradeoffs.push(`${formatRM(diff)} (${pct}%) more expensive than ${o.supplier_name}.`)
      tradeoffByCriterion.price = `its price is ${pct <= 10 ? 'slightly ' : ''}higher than ${o.supplier_name} (${formatRM(diff)} more)`
    }
  }

  if (has(s.delivery_days)) {
    const o = best(rest, (x) => x.supplier.delivery_days, 'min')
    if (!o || s.delivery_days <= o.supplier.delivery_days!) {
      a.advantages.push(`Fastest delivery in ${days(s.delivery_days)}${o && s.delivery_days < o.supplier.delivery_days! ? `, ${days(o.supplier.delivery_days! - s.delivery_days)} sooner than ${o.supplier_name}` : ''}.`)
      a.leads.delivery = 'faster delivery'
    } else {
      const diff = s.delivery_days - o.supplier.delivery_days!
      a.tradeoffs.push(`${days(diff)} slower than ${o.supplier_name} (${days(o.supplier.delivery_days!)}).`)
      tradeoffByCriterion.delivery = `it takes ${days(diff)} longer to deliver than ${o.supplier_name}`
    }
  }

  if (has(s.distance_km)) {
    const o = best(rest, (x) => x.supplier.distance_km, 'min')
    if (!o || s.distance_km <= o.supplier.distance_km!) {
      a.advantages.push(`Closest to your business at ${km(s.distance_km)}.`)
      a.leads.distance = 'a location closer to your business'
    } else {
      const diff = s.distance_km - o.supplier.distance_km!
      a.tradeoffs.push(`${km(diff)} further away than ${o.supplier_name}.`)
      tradeoffByCriterion.distance = `it is ${km(diff)} further away than ${o.supplier_name}`
    }
  }

  if (has(s.reliability)) {
    const o = best(rest, (x) => x.supplier.reliability, 'max')
    if (!o || s.reliability >= o.supplier.reliability!) {
      a.advantages.push(`Most reliable, with ${s.reliability}% on-time, in-full deliveries.`)
      a.leads.reliability = 'stronger delivery reliability'
    } else if (o.supplier.reliability! - s.reliability >= 3) {
      a.tradeoffs.push(`Reliability of ${s.reliability}% is below ${o.supplier_name} (${o.supplier.reliability}%).`)
      tradeoffByCriterion.reliability = `its reliability is lower than ${o.supplier_name}`
    }
  }

  if (has(s.product_suitability) && s.product_suitability < 100) a.tradeoffs.push(`Product is a ${s.product_suitability}% match to the requirement — confirm specifications.`)

  if (has(daysLeft) && has(s.delivery_days)) {
    const late = rest.filter((o) => has(o.supplier.delivery_days) && o.supplier.delivery_days > daysLeft)
    if (s.delivery_days <= daysLeft && late.length) a.advantages.push(`Arrives before the projected stockout in ${days(daysLeft)}; ${joinList(late.map((o) => o.supplier_name))} would not.`)
    else if (s.delivery_days > daysLeft) a.tradeoffs.push(`Arrives after the projected stockout in ${days(Math.max(0, daysLeft))}.`)
  }

  // The trade-off that matters most is the one on the most heavily weighted criterion
  const order = (Object.keys(tradeoffByCriterion) as Criterion[]).sort((x, y) => res.weights[y] - res.weights[x])
  a.mainTradeoff = order.length ? tradeoffByCriterion[order[0]]! : null
  return a
}

function caveats(r: SupplierRanking): string[] {
  const out = r.missing.map((c) => `${criterionLabels[c]} not available — not scored; the other weights were rescaled.`)
  if (r.supplier.is_mock) out.push('Based on sample supplier data, not live results.')
  return out
}

export function leadPhrase(res: CompareSuppliersResponse, a: Analysis): string {
  const leads = (Object.keys(a.leads) as Criterion[]).sort((x, y) => res.weights[y] - res.weights[x]).slice(0, 2).map((c) => a.leads[c]!)
  return leads.length ? joinList(leads) : 'the best balance of price, delivery speed and reliability'
}

export function recommendationSummary(res: CompareSuppliersResponse, r: SupplierRanking, daysLeft: number | null): RecommendationSummary {
  const a = analyse(res, r, daysLeft)
  const p = res.priority
  let summary = `${r.supplier_name} is recommended because it offers ${leadPhrase(res, a)}.`
  if (a.mainTradeoff) {
    const fastAndUrgent = !!a.leads.delivery && has(daysLeft) && has(r.supplier.delivery_days) && r.supplier.delivery_days <= daysLeft
    const reason =
      p === 'best_overall'
        ? fastAndUrgent
          ? 'its delivery advantage makes it more suitable for urgent restocking'
          : 'its overall balance of price, speed and reliability scores highest'
        : `the ${priorityLabels[p]} priority puts ${p === 'cheapest' ? 'total cost' : p === 'nearest' ? 'distance' : 'delivery speed'} first`
    summary += ` Although ${a.mainTradeoff}, ${reason}.`
  }
  const topWeights = (Object.keys(res.weights) as Criterion[]).sort((x, y) => res.weights[y] - res.weights[x]).slice(0, 2)
  return {
    supplier_id: r.supplier_id,
    headline: `${r.supplier_name} — ${Math.round(r.compatibility_score ?? 0)}% compatibility`,
    summary,
    advantages: a.advantages,
    tradeoffs: a.tradeoffs,
    caveats: caveats(r),
    priority_note: `${priorityLabels[p]}: ${res.ranking_rule} Highest weights: ${topWeights.map((c) => `${criterionLabels[c].toLowerCase()} ${res.weights[c]}%`).join(', ')}.`,
  }
}

/** One- or two-sentence explanation for any supplier in the output. */
export function explainSupplier(res: CompareSuppliersResponse, r: SupplierRanking, daysLeft: number | null): string {
  if (r.rank === null) return `Not eligible: ${r.issues.map((i) => i.replace(/\.$/, '')).join('; ')}.`
  if (r.rank === 1) return recommendationSummary(res, r, daysLeft).summary
  const a = analyse(res, r, daysLeft)
  const top = res.rankings[0]
  const strength = a.advantages[0]?.replace(/\.$/, '')
  const versusTop = a.mainTradeoff ? `, but ${a.mainTradeoff}` : ''
  return `Ranked #${r.rank} with ${Math.round(r.compatibility_score ?? 0)}% compatibility. ${strength ? `${strength}${versusTop}.` : `${top.supplier_name} scores higher under ${priorityLabels[res.priority]}.`}`
}
