// Deterministic, template-based recommendation explanations.
// Designed so an LLM can later replace `explainRecommendation` behind the same interface.

import type { Product, ScoringPriority } from '@/types'
import type { Forecast } from './forecasting'
import type { ScoredQuotation } from './scoring'
import { formatRM } from '@/utils/format'

export interface Explanation {
  headline: string
  summary: string
  points: { tone: 'positive' | 'tradeoff' | 'neutral'; text: string }[]
}

export function explainRecommendation(ranked: ScoredQuotation[], priority: ScoringPriority, product: Product, forecast?: Forecast): Explanation {
  const best = ranked[0]
  if (!best) return { headline: 'No quotations available', summary: 'No suppliers have quoted for this item yet.', points: [] }
  const others = ranked.slice(1)
  const s = best.supplier
  const q = best.quotation
  const cheapest = [...ranked].sort((a, b) => a.quotation.total - b.quotation.total)[0]
  const fastest = [...ranked].sort((a, b) => a.quotation.leadTimeDays - b.quotation.leadTimeDays)[0]
  const isCheapest = cheapest.supplier.id === s.id
  const isFastest = fastest.supplier.id === s.id
  const points: Explanation['points'] = []

  if (isFastest) points.push({ tone: 'positive', text: `Fastest delivery: ${q.leadTimeDays} day${q.leadTimeDays > 1 ? 's' : ''}${others.length ? `, vs ${others.map((o) => `${o.quotation.leadTimeDays}`).join(' and ')} days from the others` : ''}.` })
  else points.push({ tone: 'neutral', text: `Delivers in ${q.leadTimeDays} days (fastest option: ${fastest.supplier.name}, ${fastest.quotation.leadTimeDays} days).` })

  if (isCheapest) points.push({ tone: 'positive', text: `Lowest landed cost at ${formatRM(q.total)} including delivery.` })
  else {
    const premium = q.total - cheapest.quotation.total
    points.push({ tone: 'tradeoff', text: `${formatRM(premium)} more than the cheapest quote from ${cheapest.supplier.name} (${formatRM(cheapest.quotation.total)}).` })
  }

  const bestReliability = Math.max(...ranked.map((r) => r.supplier.reliability))
  points.push({
    tone: s.reliability >= bestReliability ? 'positive' : 'neutral',
    text: `${s.reliability}% on-time, in-full history and a ${s.qualityRating.toFixed(1)}/5 quality rating.`,
  })

  if (forecast && Number.isFinite(forecast.daysRemaining)) {
    const slowOnes = ranked.filter((r) => r.quotation.leadTimeDays > forecast.daysRemaining)
    if (q.leadTimeDays <= forecast.daysRemaining && slowOnes.length)
      points.push({ tone: 'positive', text: `Arrives before the projected stockout in ${forecast.daysRemaining} days — ${slowOnes.map((o) => o.supplier.name).join(', ')} would not.` })
    else if (q.leadTimeDays > forecast.daysRemaining)
      points.push({ tone: 'tradeoff', text: `Delivery lands after the projected stockout in ${forecast.daysRemaining} days — consider a small bridging order.` })
  }

  if (q.quantity < q.moq) points.push({ tone: 'tradeoff', text: `Order is below this supplier's MOQ of ${q.moq} ${product.unit}.` })

  const priorityPhrase: Record<ScoringPriority, string> = {
    balanced: 'the best overall balance of cost, speed and reliability',
    cost: 'the lowest overall cost once reliability is factored in',
    delivery: 'the quickest path to replenishment',
    reliability: 'the most dependable fulfilment record',
  }

  let summary: string
  if (isCheapest && isFastest) summary = `${s.name} is both the cheapest and the fastest option for this order.`
  else if (isFastest)
    summary = `${s.name} offers faster delivery and strong fulfilment reliability. Although its quotation is not the cheapest, its shorter lead time helps reduce replenishment risk.`
  else if (isCheapest) summary = `${s.name} has the lowest landed cost. Its longer lead time is acceptable under the current priority setting.`
  else summary = `${s.name} offers ${priorityPhrase[priority]} across all quotations received.`

  return { headline: `${s.name} scores ${best.score}% compatibility`, summary, points }
}
