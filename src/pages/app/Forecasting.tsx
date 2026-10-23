import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CalendarClock, ClipboardCheck, PackageX, Search, Sparkles, TriangleAlert, Truck, Wallet } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useForecasts, useOpenPOsFor, useRiskRanking } from '@/hooks/useDerived'
import { buildForecastSeries, EXPOSURE_BUFFER_DAYS, explainForecast, grossProfitAtRisk } from '@/services/forecasting'
import { getAIRestockAdvice } from '@/services/runpodClient'
import { ChartLegend, ForecastChart } from '@/components/charts/ForecastChart'
import { UsageForecastChart } from '@/components/charts/UsageForecastChart'
import { ProductThumb, RiskBadge, StatCard, StockStatusBadge } from '@/components/common'
import { Card, CardHeader, EmptyState, InfoTip, PageHeader } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { formatDate, formatShortDate } from '@/utils/date'
import { cn, formatQty, formatRM, formatRM0 } from '@/utils/format'
import type { HistorySource } from '@/services/forecasting'

const HISTORY_SOURCE_LABEL: Record<HistorySource, string> = {
  simulated: 'Simulated demo history',
  recorded: 'Recorded usage history',
  baseline: 'Single-entry baseline estimate',
  unverified: 'History source unverified',
}

export default function Forecasting() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const all = useForecasts()
  const ranking = useRiskRanking()
  const approvals = useAppStore((s) => s.approvals)
  const coverageDays = useAppStore((s) => s.settings.coverageDays)

  const productId = params.get('product') ?? ranking[0]?.product.id
  const selected = all.find((x) => x.product.id === productId) ?? ranking[0]
  const openPOs = useOpenPOsFor(selected?.product.id)
  const openPO = openPOs[0]
  const series = useMemo(() => (selected ? buildForecastSeries(selected.product, selected.forecast, openPOs) : null), [selected, openPOs])

  const atRisk = all.filter((x) => x.forecast.status !== 'Healthy').length
  const critical = all.filter((x) => x.forecast.risk === 'High')
  const stockouts = all.filter((x) => x.forecast.status === 'Out of Stock' || x.forecast.daysRemaining <= 14).length
  const upcoming = all.filter((x) => x.forecast.daysUntilReorder <= 7 && x.forecast.suggestedQty > 0).length
  const gpRisk = all.reduce((sum, x) => sum + grossProfitAtRisk(x.product, x.forecast), 0)

  // Hooks must run before the empty-state return below
  const [aiRestockAdvice, setAiRestockAdvice] = useState<string | null>(null)
  const p = selected?.product
  const f = selected?.forecast

  useEffect(() => {
    let active = true
    // Drop the previous product's advice so it never shows under this one
    setAiRestockAdvice(null)
    if (p && f?.needsReorder) {
      getAIRestockAdvice(p.name, p.unit, p.currentStock, f.avgDailyUsage, f.daysRemaining, f.suggestedQty, f.leadTimeDays).then((text) => {
        if (active && text) setAiRestockAdvice(text)
      })
    }
    return () => {
      active = false
    }
  }, [p?.name, p?.unit, p?.currentStock, f?.avgDailyUsage, f?.daysRemaining, f?.suggestedQty, f?.leadTimeDays, f?.needsReorder])

  if (!selected || !series)
    return (
      <div>
        <PageHeader title="Inventory Forecasting" subtitle="Know what you'll need before you run out." />
        <Card>
          <EmptyState
            icon={<PackageX className="h-7 w-7" />}
            title="No forecast data available"
            description="Add an inventory product to start reviewing stock forecasts."
            action={<Button onClick={() => navigate('/app/inventory')}>View inventory</Button>}
          />
        </Card>
      </div>
    )
  const { product, forecast } = selected
  const pending = approvals.find((a) => a.productId === product.id && a.status === 'Pending')
  const select = (id: string) => setParams({ product: id }, { replace: true })
  const qty = forecast.suggestedQty || forecast.calculatedQty || product.orderMultiple
  const findBest = () => navigate(`/app/quotations?product=${product.id}&qty=${qty}`)

  const details = [
    { label: 'Current stock', value: formatQty(product.currentStock, product.unit) },
    { label: 'Average daily usage', value: formatQty(forecast.avgDailyUsage, product.unit) },
    { label: 'Daily usage variability', value: forecast.usageStdDev === null ? 'Insufficient history' : `${formatQty(forecast.usageStdDev, product.unit)}/day` },
    { label: 'Estimated days remaining', value: forecast.daysRemaining >= 999 ? '—' : `${forecast.daysRemaining} days` },
    { label: 'Predicted stockout date', value: forecast.stockoutDate ? formatDate(forecast.stockoutDate) : '—' },
    { label: 'Supplier lead time', value: `${forecast.leadTimeDays} days` },
    { label: 'Safety stock', value: formatQty(forecast.safetyStock, product.unit) },
    { label: 'Reorder point', value: formatQty(forecast.reorderPoint, product.unit) },
    { label: 'Recommended reorder date', value: forecast.daysUntilReorder <= 0 ? 'Today' : formatDate(forecast.reorderDate) },
    { label: 'Recommended quantity', value: forecast.suggestedQty > 0 ? formatQty(forecast.suggestedQty, product.unit) : 'None' },
  ]

  return (
    <div>
      <PageHeader title="Inventory Forecasting" subtitle="Know what you'll need before you run out." />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-6">
        <StatCard label="Inventory Items" value={all.length} icon={<ClipboardCheck />} hint="Products currently tracked" onClick={() => navigate('/app/inventory')} />
        <StatCard label="Products at Risk" value={atRisk} icon={<TriangleAlert />} hint="Critical or below reorder point" onClick={() => navigate('/app/inventory')} />
        <StatCard label="Critical Alerts" value={critical.length} icon={<PackageX />} hint="Stockout risk needs action" />
        <StatCard label="Forecasted Stockouts" value={stockouts} icon={<PackageX />} hint="Within 14 days, including open orders" />
        <StatCard label="Upcoming Reorders" value={upcoming} icon={<CalendarClock />} hint="Reorder date within 7 days" onClick={() => navigate('/app/recommendations')} />
        <StatCard
          label="Est. Gross Profit at Risk"
          value={formatRM0(gpRisk)}
          icon={<Wallet />}
          hint={
            <span className="inline-flex items-center gap-1.5">
              If not ordered today
              <InfoTip side="bottom">
                Demand that can't be served if an order placed today arrives after the supplier lead time + {EXPOSURE_BUFFER_DAYS} days processing, valued at each product's gross profit per unit from menu costing (e.g. coffee beans RM240/kg ≈ 55 drinks). Open POs are counted as incoming stock.
              </InfoTip>
            </span>
          }
        />
      </div>

      {critical.length > 0 && (
        <Card className="mb-5 border-critical/30 bg-critical-soft/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-[#a7353d]">
            <TriangleAlert className="h-4 w-4" /> Critical stock alerts
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {critical.map(({ product: item, forecast: itemForecast }) => (
              <button
                key={item.id}
                onClick={() => select(item.id)}
                className="rounded-xl border border-critical/20 bg-white/80 p-3 text-left transition hover:bg-white"
              >
                <span className="block text-[13px] font-semibold text-ink">{item.name}</span>
                <span className="mt-1 block text-[12px] leading-relaxed text-muted">{itemForecast.riskReason}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {ranking.map((x) => {
          const active = x.product.id === product.id
          const dot = x.forecast.status === 'Healthy' ? 'bg-success' : x.forecast.status === 'Reorder Soon' ? 'bg-warning' : 'bg-critical'
          return (
            <button
              key={x.product.id}
              onClick={() => select(x.product.id)}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition',
                active ? 'border-primary/40 bg-white shadow-[0_0_0_3px_rgba(49,84,223,0.08)]' : 'border-line bg-white/60 hover:bg-white',
              )}
            >
              <ProductThumb product={x.product} size="sm" />
              <span>
                <span className={cn('block text-[13px] font-semibold', active ? 'text-primary' : 'text-ink')}>{x.product.name}</span>
                <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
                  <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
                  {x.forecast.daysRemaining >= 999 ? 'No usage' : `${x.forecast.daysRemaining} days`}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0">
          <CardHeader
            title={
              <span className="flex flex-wrap items-center gap-2.5">
                {product.name} <StockStatusBadge status={forecast.status} />
              </span>
            }
            subtitle={`${HISTORY_SOURCE_LABEL[forecast.historySource]} · ${forecast.isBaseline ? 'not enough history for trend or variability analysis.' : '14-day stock history with a 21-day projection.'}`}
            action={<RiskBadge risk={forecast.risk} />}
          />
          <div className="px-3 pt-4 pb-5 sm:px-4">
            <ForecastChart points={series.points} unit={product.unit} safety={forecast.safetyStock} replenishDay={series.replenishDay} replenishQty={series.replenishQty} replenishFromPO={series.replenishFromPO} height={360} />
            <div className="mt-3 px-2">
              <ChartLegend replenishLabel={series.replenishFromPO ? `Expected replenishment (${openPO?.number})` : 'Expected replenishment'} />
            </div>
          </div>
          <div className="grid gap-px border-t border-line bg-line sm:grid-cols-3">
            {details.map((d) => (
              <div key={d.label} className="bg-white px-5 py-4">
                <div className="text-[12.5px] text-muted">{d.label}</div>
                <div className="mt-0.5 text-[15px] font-semibold text-ink tabular">{d.value}</div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className={cn('p-6', forecast.needsReorder && 'border-[#dcd2ff]')}>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f3ecff] text-violet">
                <Sparkles className="h-4 w-4" />
              </span>
              <h3 className="text-[15px] font-semibold text-ink">{forecast.needsReorder ? 'Restock Recommended' : openPO ? 'Replenishment on the way' : 'No restock needed yet'}</h3>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">{aiRestockAdvice || explainForecast(product, forecast)}</p>

            {forecast.needsReorder && (
              <div className="mt-4 rounded-2xl bg-subtle/80 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-muted">Suggested order</span>
                  <span className="text-[20px] font-semibold text-ink tabular">{formatQty(forecast.suggestedQty, product.unit)}</span>
                </div>
                <div className="mt-1 text-[12.5px] text-muted">
                  ≈ {formatRM(forecast.suggestedQty * product.unitCost)} at current unit cost · order by {forecast.daysUntilReorder <= 0 ? 'today' : formatShortDate(forecast.reorderDate)}
                </div>
                <div className="mt-3 text-[12px] leading-relaxed text-[#8a91a8]">{forecast.recommendationReason}</div>
              </div>
            )}

            {openPO && (
              <button onClick={() => navigate(`/app/purchase-orders?po=${openPO.id}`)} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-line p-3.5 text-left transition hover:bg-subtle">
                <Truck className="h-4 w-4 text-primary" />
                <span className="flex-1 text-[13px]">
                  <span className="font-semibold text-ink">{openPO.number}</span>
                  <span className="text-muted"> · {formatQty(openPO.quantity, product.unit)} · {openPO.status}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted" />
              </button>
            )}

            <div className="mt-5 space-y-2">
              {pending ? (
                <Button className="w-full" variant="outline" onClick={() => navigate('/app/approvals')}>
                  <ClipboardCheck className="h-4 w-4" /> Approval pending — review
                </Button>
              ) : (
                <Button size="lg" className="w-full" variant={forecast.needsReorder ? 'primary' : 'outline'} onClick={findBest}>
                  <Search className="h-4 w-4" /> Find Best Supplier
                </Button>
              )}
              <Button variant="ghost" className="w-full" onClick={() => navigate(`/app/inventory/${product.id}`)}>
                View product details
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h4 className="text-[13.5px] font-semibold text-ink">How this forecast works</h4>
            <ul className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-muted">
              <li>
                <span className="font-medium text-ink">Days remaining</span> = projected stock after dated incoming orders ÷ forecast daily usage
              </li>
              <li>
                <span className="font-medium text-ink">Reorder point</span> = forecast daily usage × lead time + safety stock
              </li>
              <li>
                <span className="font-medium text-ink">Suggested quantity</span> covers the lead time plus {coverageDays} days, net of stock on hand and open orders
              </li>
              <li>Deterministic and explainable — ready to be replaced by a seasonal ML model when more sales history is available.</li>
            </ul>
          </Card>
        </div>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Detailed inventory forecast"
          subtitle="Stockout estimates include dated open purchase orders. Select a product to inspect its chart and recommendation."
        />
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[1320px] text-left text-[13px]">
            <thead>
              <tr className="border-y border-line bg-[#fafbfe] text-[12px] text-muted">
                <th className="py-3 pr-3 pl-5 font-medium">Product</th>
                <th className="px-3 text-right font-medium">Current stock</th>
                <th className="px-3 text-right font-medium">Avg daily usage</th>
                <th className="px-3 text-right font-medium">Days until stockout</th>
                <th className="px-3 font-medium">Predicted stockout</th>
                <th className="px-3 text-right font-medium">Lead time</th>
                <th className="px-3 text-right font-medium">Reorder point</th>
                <th className="px-3 text-right font-medium">Recommended order</th>
                <th className="px-3 pr-5 font-medium">Risk & reason</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(({ product: item, forecast: itemForecast }) => (
                <tr
                  key={item.id}
                  onClick={() => select(item.id)}
                  className={cn('cursor-pointer border-b border-line/70 align-top transition last:border-0 hover:bg-[#f8f9ff]', item.id === product.id && 'bg-lavender/50')}
                >
                  <td className="py-3.5 pr-3 pl-5">
                    <span className="block font-semibold text-ink">{item.name}</span>
                    <span className="mt-0.5 block text-[11.5px] text-muted">{HISTORY_SOURCE_LABEL[itemForecast.historySource]}</span>
                  </td>
                  <td className="px-3 py-3.5 text-right font-medium tabular">{formatQty(item.currentStock, item.unit)}</td>
                  <td className="px-3 py-3.5 text-right tabular">
                    <span className="block">{formatQty(itemForecast.avgDailyUsage, item.unit)}</span>
                    {itemForecast.trendPct !== null && (
                      <span className="text-[11.5px] text-muted">{itemForecast.trendPct > 0 ? '+' : ''}{itemForecast.trendPct}% recent trend</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-right tabular">{itemForecast.daysRemaining >= 999 ? '—' : `${itemForecast.daysRemaining} days`}</td>
                  <td className="px-3 py-3.5 tabular">{itemForecast.stockoutDate ? formatDate(itemForecast.stockoutDate) : 'Not estimated'}</td>
                  <td className="px-3 py-3.5 text-right tabular">{itemForecast.leadTimeDays} days</td>
                  <td className="px-3 py-3.5 text-right tabular">{formatQty(itemForecast.reorderPoint, item.unit)}</td>
                  <td className="px-3 py-3.5 text-right tabular">
                    <span className="block font-semibold">{itemForecast.suggestedQty > 0 ? formatQty(itemForecast.suggestedQty, item.unit) : 'None'}</span>
                    <span className="block max-w-[220px] whitespace-normal text-[11px] leading-relaxed text-muted">{itemForecast.recommendationReason}</span>
                  </td>
                  <td className="px-3 py-3.5 pr-5">
                    <RiskBadge risk={itemForecast.risk} />
                    <span className="mt-1.5 block max-w-[260px] whitespace-normal text-[11.5px] leading-relaxed text-muted">{itemForecast.riskReason}</span>
                    {itemForecast.limitation && (
                      <span className="mt-1 block max-w-[260px] whitespace-normal text-[11px] leading-relaxed text-warning-ink">{itemForecast.limitation}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-5 py-3 text-[12px] text-muted">
          Generated usage history is labeled simulated; unverified legacy data is not represented as confirmed historical records. Dates are estimates based on current forecasts.
        </div>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Historical vs forecast daily usage"
          subtitle={`${HISTORY_SOURCE_LABEL[forecast.historySource]} · observed daily usage is compared with the next 7 days at the current forecast rate.`}
        />
        <UsageForecastChart product={product} forecast={forecast} />
      </Card>
    </div>
  )
}
