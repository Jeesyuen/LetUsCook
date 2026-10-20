import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CalendarClock, ClipboardCheck, PackageX, Search, Sparkles, TriangleAlert, Truck, Wallet } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useForecasts, useOpenPOFor, useRiskRanking } from '@/hooks/useDerived'
import { buildForecastSeries, EXPOSURE_BUFFER_DAYS, explainForecast, grossProfitAtRisk } from '@/services/forecasting'
import { ChartLegend, ForecastChart } from '@/components/charts/ForecastChart'
import { ProductThumb, RiskBadge, StatCard, StockStatusBadge } from '@/components/common'
import { Card, CardHeader, InfoTip, PageHeader } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { formatDate, formatShortDate } from '@/utils/date'
import { cn, formatQty, formatRM, formatRM0 } from '@/utils/format'

export default function Forecasting() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const all = useForecasts()
  const ranking = useRiskRanking()
  const approvals = useAppStore((s) => s.approvals)
  const coverageDays = useAppStore((s) => s.settings.coverageDays)

  const productId = params.get('product') ?? ranking[0]?.product.id
  const selected = all.find((x) => x.product.id === productId) ?? ranking[0]
  const openPO = useOpenPOFor(selected?.product.id)
  const series = useMemo(() => (selected ? buildForecastSeries(selected.product, selected.forecast, openPO) : null), [selected, openPO])

  const atRisk = all.filter((x) => x.forecast.status !== 'Healthy').length
  const stockouts = all.filter((x) => x.forecast.daysRemaining <= 14 && x.forecast.incoming === 0).length
  const upcoming = all.filter((x) => x.forecast.daysUntilReorder <= 7 && x.forecast.suggestedQty > 0).length
  const gpRisk = all.reduce((sum, x) => sum + grossProfitAtRisk(x.product, x.forecast), 0)

  if (!selected || !series) return null
  const { product, forecast } = selected
  const pending = approvals.find((a) => a.productId === product.id && a.status === 'Pending')
  const select = (id: string) => setParams({ product: id }, { replace: true })
  const qty = forecast.suggestedQty || forecast.calculatedQty || product.orderMultiple
  const findBest = () => navigate(`/app/quotations?product=${product.id}&qty=${qty}`)

  const details = [
    { label: 'Current stock', value: formatQty(product.currentStock, product.unit) },
    { label: 'Average daily usage', value: formatQty(forecast.avgDailyUsage, product.unit) },
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

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Products at Risk" value={atRisk} icon={<TriangleAlert />} hint="Critical or below reorder point" onClick={() => navigate('/app/inventory')} />
        <StatCard label="Forecasted Stockouts" value={stockouts} icon={<PackageX />} hint="Within 14 days, no open order" />
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
            subtitle={forecast.isBaseline ? 'Baseline forecast from estimated usage — history is still building.' : 'Daily stock level: 14 days of history and a 21-day projection.'}
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
            <p className="mt-3 text-[14px] leading-relaxed text-muted">{explainForecast(product, forecast)}</p>

            {forecast.needsReorder && (
              <div className="mt-4 rounded-2xl bg-subtle/80 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-muted">Suggested order</span>
                  <span className="text-[20px] font-semibold text-ink tabular">{formatQty(forecast.suggestedQty, product.unit)}</span>
                </div>
                <div className="mt-1 text-[12.5px] text-muted">
                  ≈ {formatRM(forecast.suggestedQty * product.unitCost)} at current unit cost · order by {forecast.daysUntilReorder <= 0 ? 'today' : formatShortDate(forecast.reorderDate)}
                </div>
                <div className="mt-3 text-[12px] leading-relaxed text-[#8a91a8]">
                  {formatQty(forecast.avgDailyUsage)} × ({forecast.leadTimeDays} lead + {coverageDays} coverage days) + {formatQty(forecast.safetyStock)} safety − {formatQty(product.currentStock)} on hand{forecast.incoming ? ` − ${formatQty(forecast.incoming)} incoming` : ''}, rounded to {formatQty(product.orderMultiple, product.unit)} packs
                </div>
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
                <span className="font-medium text-ink">Days remaining</span> = current stock ÷ average daily usage
              </li>
              <li>
                <span className="font-medium text-ink">Reorder point</span> = daily usage × lead time + safety stock
              </li>
              <li>
                <span className="font-medium text-ink">Suggested quantity</span> covers the lead time plus {coverageDays} days, net of stock on hand and open orders
              </li>
              <li>Deterministic and explainable — ready to be replaced by a seasonal ML model when more sales history is available.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
