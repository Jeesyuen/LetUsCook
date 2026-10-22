// AI Procurement Advisor. Turns the ranking into consultant-style advice:
// category labels, top-3 suggestions and urgency-aware guidance based on the forecast's
// days-until-stockout. Deterministic and data-grounded — every statement comes from supplier data
// or calculated scores. The forecasting output is only read, never changed.

import type { CompareSuppliersResponse, ProcurementAdvice, PurchaseUrgency, RecommendationCategory, SupplierRanking, SupplierSuggestion } from './types'
import { analyse, leadPhrase } from './explain'
import { priorityLabels } from './config'
import { formatRM } from '@/utils/format'

export const categoryLabels: Record<RecommendationCategory, string> = {
  best_overall: 'Best Overall',
  best_budget: 'Best Budget Choice',
  fastest_delivery: 'Fastest Delivery',
  nearest: 'Nearest Supplier',
  most_reliable: 'Most Reliable',
}

const CATEGORY_ORDER: RecommendationCategory[] = ['best_overall', 'best_budget', 'fastest_delivery', 'nearest', 'most_reliable']

const has = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v)
const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`

/**
 * Labels the suppliers that are genuinely best on a measure. Ties share the label; a measure where
 * fewer than two suppliers have data, or where everyone is equal, gives no label — nothing is forced.
 */
export function assignCategories(ranked: SupplierRanking[], balancedScore: (id: string) => number | null): Record<string, RecommendationCategory[]> {
  const out: Record<string, RecommendationCategory[]> = Object.fromEntries(ranked.map((r) => [r.supplier_id, []]))
  const award = (cat: RecommendationCategory, value: (r: SupplierRanking) => number | null | undefined, dir: 'min' | 'max', minEntries = 2) => {
    const withData = ranked.filter((r) => has(value(r)))
    if (withData.length < minEntries) return
    const values = withData.map((r) => value(r)!)
    const target = dir === 'min' ? Math.min(...values) : Math.max(...values)
    if (withData.length > 1 && values.every((v) => v === target)) return
    for (const r of withData) if (value(r) === target) out[r.supplier_id].push(cat)
  }
  award('best_overall', (r) => balancedScore(r.supplier_id), 'max', 1)
  award('best_budget', (r) => r.supplier.total_price, 'min')
  award('fastest_delivery', (r) => r.supplier.delivery_days, 'min')
  award('nearest', (r) => r.supplier.distance_km, 'min')
  // Only verified history counts — missing reliability is never treated as "most reliable"
  award('most_reliable', (r) => r.supplier.reliability, 'max')
  return out
}

function arrives(r: SupplierRanking, daysLeft: number | null): boolean | null {
  return has(daysLeft) && has(r.supplier.delivery_days) ? r.supplier.delivery_days <= daysLeft : null
}

function judgeUrgency(ranked: SupplierRanking[], daysLeft: number | null): PurchaseUrgency {
  if (!has(daysLeft)) return 'unknown'
  const timed = ranked.filter((r) => has(r.supplier.delivery_days))
  if (!timed.length) return 'unknown'
  const onTime = timed.filter((r) => r.supplier.delivery_days! <= daysLeft)
  if (onTime.length === timed.length) return 'healthy'
  const fastest = Math.min(...timed.map((r) => r.supplier.delivery_days!))
  if (onTime.length === 0 || onTime.every((r) => r.supplier.delivery_days === fastest)) return 'critical'
  return 'soon'
}

const CHOOSE_WHEN: Record<RecommendationCategory, string> = {
  best_overall: 'you want the best all-round balance of cost, speed and reliability',
  best_budget: 'keeping costs down matters more than delivery speed',
  fastest_delivery: 'you need the stock as soon as possible',
  nearest: 'you prefer a nearby supplier, for example for frequent small top-ups',
  most_reliable: 'on-time, complete delivery is your main concern',
}

const ALTERNATIVE_ROLE: Record<RecommendationCategory, string> = {
  best_overall: 'you want the best all-round balance',
  best_budget: 'the lowest price matters most',
  fastest_delivery: 'you need the stock sooner',
  nearest: 'you prefer a closer supplier',
  most_reliable: 'reliability matters most',
}

/** What an alternative does better than the primary pick, measured on the actual data (first match wins). */
function edgeOver(alt: SupplierRanking, primary: SupplierRanking): { role: string; detail: string } | null {
  const a = alt.supplier
  const p = primary.supplier
  if (has(a.total_price) && has(p.total_price) && a.total_price < p.total_price)
    return { role: 'reducing costs is more important', detail: `${formatRM(p.total_price - a.total_price)} cheaper than ${primary.supplier_name}` }
  if (has(a.delivery_days) && has(p.delivery_days) && a.delivery_days < p.delivery_days)
    return { role: 'you need the stock sooner', detail: `${days(p.delivery_days - a.delivery_days)} faster than ${primary.supplier_name}` }
  if (has(a.distance_km) && has(p.distance_km) && a.distance_km < p.distance_km)
    return { role: 'you prefer a closer supplier', detail: `${Math.round(p.distance_km - a.distance_km)} km closer than ${primary.supplier_name}` }
  if (has(a.reliability) && has(p.reliability) && a.reliability > p.reliability)
    return { role: 'reliability matters most', detail: `more reliable than ${primary.supplier_name} (${a.reliability}% vs ${p.reliability}%)` }
  return null
}

function joinList(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export function buildProcurementAdvice(res: CompareSuppliersResponse, balanced: CompareSuppliersResponse): ProcurementAdvice | null {
  const ranked = res.rankings.filter((r) => r.rank !== null)
  if (!ranked.length) return null
  const daysLeft = res.days_until_stockout
  const balancedScore = (id: string) => balanced.rankings.find((r) => r.supplier_id === id)?.compatibility_score ?? null
  const categories = assignCategories(ranked, balancedScore)
  const urgency = judgeUrgency(ranked, daysLeft)
  const warnings: string[] = []

  // Primary pick: the best-ranked supplier, unless stock runs out before it can deliver
  let primary = ranked[0]
  if ((urgency === 'soon' || urgency === 'critical') && arrives(primary, daysLeft) === false) {
    const onTime = ranked.find((r) => arrives(r, daysLeft) === true)
    const timed = ranked.filter((r) => has(r.supplier.delivery_days))
    const fallback = onTime ?? [...timed].sort((a, b) => a.supplier.delivery_days! - b.supplier.delivery_days! || a.rank! - b.rank!)[0] ?? primary
    if (fallback.supplier_id !== primary.supplier_id)
      warnings.push(
        `${primary.supplier_name} ranks first under ${priorityLabels[res.priority]} but delivers in ${days(primary.supplier.delivery_days!)}, after the projected stockout — so the advisor recommends ${fallback.supplier_name}${onTime ? ', which can deliver in time' : ', the fastest option'}.`,
      )
    primary = fallback
  }
  if (urgency === 'critical' && has(daysLeft) && !ranked.some((r) => arrives(r, daysLeft) === true))
    warnings.push(`No supplier can deliver within the ${days(Math.max(0, daysLeft))} before the projected stockout. Consider a small bridging purchase while this order arrives.`)

  const alternatives = ranked.filter((r) => r.supplier_id !== primary.supplier_id).slice(0, 2)
  const budget = ranked.filter((r) => categories[r.supplier_id].includes('best_budget'))

  // Cheapest supplier that cannot arrive before the stockout (unless already explained above)
  for (const b of budget) {
    if (b.supplier_id !== primary.supplier_id && b.supplier_id !== ranked[0].supplier_id && arrives(b, daysLeft) === false)
      warnings.push(`${b.supplier_name} has the lowest price (${formatRM(b.supplier.total_price!)}) but delivers in ${days(b.supplier.delivery_days!)} — after the projected stockout in ${days(Math.max(0, daysLeft!))}. Choosing it risks running out of stock.`)
  }
  if (primary.missing.length) warnings.push(`Some of ${primary.supplier_name}'s data is not verified (${primary.missing.join(', ').replace(/_/g, ' ')}) — confirm it with the supplier before ordering.`)

  let urgencyNote: string
  if (urgency === 'unknown') urgencyNote = 'No stock forecast is available, so this advice is based on supplier data only.'
  else {
    const timed = ranked.filter((r) => has(r.supplier.delivery_days))
    const onTimeCount = timed.filter((r) => arrives(r, daysLeft) === true).length
    if (urgency === 'healthy') {
      urgencyNote = `Stock is healthy — about ${days(daysLeft!)} of cover, and every supplier can deliver in time, so a lower-cost supplier with a longer lead time is a safe choice.`
      const cheaper = budget.find((b) => b.supplier_id !== primary.supplier_id)
      if (cheaper && has(primary.supplier.total_price))
        urgencyNote += ` Choosing ${cheaper.supplier_name} would save ${formatRM(primary.supplier.total_price - cheaper.supplier.total_price!)}.`
    } else if (urgency === 'soon') urgencyNote = `Stock runs out in about ${days(daysLeft!)}. ${onTimeCount} of ${timed.length} suppliers can deliver before then, so delivery speed matters for this order.`
    else urgencyNote = `Urgent: stock runs out in about ${days(Math.max(0, daysLeft!))}. ${onTimeCount ? `Only ${onTimeCount === 1 ? 'one supplier' : `${onTimeCount} suppliers`} can deliver in time.` : 'No supplier can deliver in time.'}`
  }

  const suggestion = (r: SupplierRanking, isPrimary: boolean): SupplierSuggestion => {
    const a = analyse(res, r, daysLeft)
    const cats = CATEGORY_ORDER.filter((c) => categories[r.supplier_id].includes(c))
    const onTime = arrives(r, daysLeft)
    const drawbacks = [...a.tradeoffs]
    if (r.missing.length) drawbacks.push(`Not verified: ${r.missing.join(', ').replace(/_/g, ' ')}.`)

    const edge = isPrimary ? null : edgeOver(r, primary)
    const why = isPrimary
      ? `Our top pick: it offers ${leadPhrase(res, a)}${onTime === true && urgency !== 'healthy' && urgency !== 'unknown' ? ', and it can deliver before the projected stockout' : ''}.`
      : cats.length
        ? `${categoryLabels[cats[0]]}: it offers ${leadPhrase(res, a)}${edge ? ` — ${edge.detail}` : ''}.`
        : edge
          ? `Alternative: ${edge.detail}, with ${Math.round(r.compatibility_score ?? 0)}% compatibility.`
          : `Ranked #${r.rank} with ${Math.round(r.compatibility_score ?? 0)}% compatibility — a backup option.`

    let chooseWhen: string
    if (onTime === false) chooseWhen = `Only if you can cover demand until it arrives in ${days(r.supplier.delivery_days!)} (after the projected stockout).`
    else if (cats.length) chooseWhen = `Choose when ${joinList(cats.slice(0, 2).map((c) => CHOOSE_WHEN[c]))}.`
    else if (edge) chooseWhen = `Choose when ${edge.role}.`
    else chooseWhen = isPrimary ? `Choose for the best fit under the ${priorityLabels[res.priority]} priority.` : 'Choose as a backup if your preferred supplier cannot fulfil the order.'

    return {
      supplier_id: r.supplier_id,
      supplier_name: r.supplier_name,
      rank: r.rank!,
      compatibility_score: r.compatibility_score ?? 0,
      balanced_score: balancedScore(r.supplier_id) ?? 0,
      categories: cats,
      why,
      advantages: a.advantages.slice(0, 3),
      drawbacks: drawbacks.slice(0, 3),
      choose_when: chooseWhen,
      arrives_before_stockout: onTime,
    }
  }

  const suggestions = [suggestion(primary, true), ...alternatives.map((r) => suggestion(r, false))]

  // Final recommendation, written like a procurement consultant
  const p = suggestions[0]
  const primaryAnalysis = analyse(res, primary, daysLeft)
  let final = `We recommend ${p.supplier_name} for this purchase because it offers ${leadPhrase(res, primaryAnalysis)}`
  final += p.arrives_before_stockout === true && urgency !== 'healthy' ? ` and can deliver before the projected stockout.` : '.'
  for (const alt of alternatives) {
    if (arrives(alt, daysLeft) === false) continue
    // A category the alternative genuinely holds comes first; otherwise its measured edge over the primary
    const category = categories[alt.supplier_id].find((x) => x !== 'best_overall')
    const role = category ? ALTERNATIVE_ROLE[category] : (edgeOver(alt, primary)?.role ?? null)
    final += role ? ` ${alt.supplier_name} is a strong alternative if ${role}.` : ` ${alt.supplier_name} is a reasonable backup at ${Math.round(alt.compatibility_score ?? 0)}% compatibility.`
  }
  const lateBudget = budget.find((b) => b.supplier_id !== primary.supplier_id && arrives(b, daysLeft) === false)
  if (lateBudget) final += ` ${lateBudget.supplier_name} offers the lowest price but may not be suitable for urgent restocking.`

  return {
    primary_supplier_id: primary.supplier_id,
    alternative_supplier_ids: alternatives.map((r) => r.supplier_id),
    urgency,
    urgency_note: urgencyNote,
    warnings,
    final_recommendation: final,
    suggestions,
    categories,
  }
}
