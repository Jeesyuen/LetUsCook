import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Boxes, ClipboardCheck, ShoppingCart, Sparkles, TriangleAlert, Wallet } from 'lucide-react'
import { useAppStore, OPEN_PO_STATUSES } from '@/store/useAppStore'
import { useForecasts, useOpenPOFor, useRecommendations, useRiskRanking } from '@/hooks/useDerived'
import { buildForecastSeries } from '@/services/forecasting'
import { ForecastChart, ChartLegend } from '@/components/charts/ForecastChart'
import { InventoryAlertCard } from '@/components/InventoryAlertCard'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { CompatibilityScore, StatCard } from '@/components/common'
import { Card, CardHeader, SegmentedTabs } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { formatDate, greeting } from '@/utils/date'
import { formatQty, formatRM0 } from '@/utils/format'

export default function Overview() {
  const navigate = useNavigate()
  const user = useAppStore((s) => s.user)
  const approvals = useAppStore((s) => s.approvals)
  const pos = useAppStore((s) => s.purchaseOrders)
  const activity = useAppStore((s) => s.activity)
  const all = useForecasts()
  const ranking = useRiskRanking()
  const recs = useRecommendations()

  const atRisk = all.filter((x) => x.forecast.status !== 'Healthy')
  const critical = all.filter((x) => x.forecast.risk === 'High').length
  const pending = approvals.filter((a) => a.status === 'Pending').length
  const activePOs = pos.filter((p) => OPEN_PO_STATUSES.includes(p.status))
  const awaiting = activePOs.filter((p) => p.status === 'Awaiting Confirmation' || p.status === 'Sent').length
  const value = all.reduce((sum, x) => sum + x.product.currentStock * x.product.unitCost, 0)
  const categories = new Set(all.map((x) => x.product.category)).size

  const top3 = ranking.slice(0, 3)
  const [chartId, setChartId] = useState<string>(top3[0]?.product.id ?? '')
  const selected = all.find((x) => x.product.id === chartId) ?? top3[0]
  const openPO = useOpenPOFor(selected?.product.id)
  const series = useMemo(() => (selected ? buildForecastSeries(selected.product, selected.forecast, openPO) : null), [selected, openPO])

  const insight = recs[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[13px] font-medium text-muted">{formatDate(new Date())}</p>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink sm:text-[32px]">{greeting()}, {user.name.split(' ')[0]}.</h1>
          <p className="mt-1.5 text-[15px] text-muted">Here's your inventory and procurement overview.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/app/inventory')}>
            <Boxes className="h-4 w-4" /> Inventory
          </Button>
          <Button onClick={() => navigate('/app/recommendations')}>
            <Sparkles className="h-4 w-4" /> Recommendations
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Inventory Items" value={all.length} icon={<Boxes />} hint={`${categories} categories tracked`} onClick={() => navigate('/app/inventory')} />
        <StatCard
          label="At-Risk Products"
          value={atRisk.length}
          icon={<TriangleAlert />}
          hint={critical ? <span className="font-medium text-[#c23f48]">{critical} critical</span> : 'None critical'}
          onClick={() => navigate('/app/forecasting')}
        />
        <StatCard label="Pending Approvals" value={pending} icon={<ClipboardCheck />} hint={pending ? 'Awaiting your decision' : 'All caught up'} onClick={() => navigate('/app/approvals')} />
        <StatCard label="Active Purchase Orders" value={activePOs.length} icon={<ShoppingCart />} hint={`${awaiting} awaiting supplier`} onClick={() => navigate('/app/purchase-orders')} />
        <StatCard label="Inventory Value" value={formatRM0(value)} icon={<Wallet />} hint="At unit cost" onClick={() => navigate('/app/inventory')} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0">
          <CardHeader
            title="Inventory Forecast"
            subtitle="Stock movement and projected consumption."
            action={
              <SegmentedTabs
                size="sm"
                items={top3.map((x) => ({ value: x.product.id, label: x.product.name.replace('Arabica ', '').replace(' 12oz', '') }))}
                value={selected?.product.id ?? ''}
                onChange={setChartId}
              />
            }
          />
          {selected && series && (
            <div className="px-3 pt-4 pb-5 sm:px-4">
              <ForecastChart points={series.points} unit={selected.product.unit} safety={selected.forecast.safetyStock} replenishDay={series.replenishDay} replenishQty={series.replenishQty} replenishFromPO={series.replenishFromPO} height={290} />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-2">
                <ChartLegend replenishLabel={series.replenishFromPO ? 'With open PO' : 'With recommended order'} />
                <Link to={`/app/forecasting?product=${selected.product.id}`} className="text-[13px] font-medium text-primary hover:underline">
                  Full forecast →
                </Link>
              </div>
            </div>
          )}
        </Card>

        <Card className="flex flex-col p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f3ecff] text-violet">
              <Sparkles className="h-4 w-4" />
            </span>
            <h3 className="text-[15px] font-semibold text-ink">SupplyWise Insight</h3>
          </div>
          {insight && insight.best ? (
            <>
              <p className="mt-4 text-[14.5px] leading-relaxed text-ink">
                {insight.product.name} {insight.forecast.status === 'Critical' ? 'has reached its safety stock' : 'is approaching its reorder point'} with ~{insight.forecast.daysRemaining} days of cover.{' '}
                <span className="text-muted">
                  {insight.best.supplier.name} delivers in {insight.best.quotation.leadTimeDays} days with {insight.best.supplier.reliability}% reliability. Reviewing quotations now could reduce replenishment risk.
                </span>
              </p>
              <div className="mt-5 flex items-center gap-4 rounded-2xl border border-line bg-subtle/60 p-4">
                <CompatibilityScore score={insight.best.score} size={56} highlight />
                <div className="min-w-0 text-[13px]">
                  <div className="font-semibold text-ink">{insight.best.supplier.name}</div>
                  <div className="text-muted">
                    {formatQty(insight.forecast.suggestedQty, insight.product.unit)} · {formatRM0(insight.best.quotation.total)}
                  </div>
                </div>
              </div>
              <div className="mt-auto pt-5">
                {insight.pendingApproval ? (
                  <Button variant="outline" className="w-full" onClick={() => navigate('/app/approvals')}>
                    Awaiting approval — review <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => navigate(`/app/quotations?product=${insight.product.id}&qty=${insight.forecast.suggestedQty}`)}>
                    Compare Suppliers <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="mt-4 text-[14px] leading-relaxed text-muted">All products are well stocked or have open orders. SupplyWise will flag the next item as it approaches its reorder point.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[17px] font-semibold text-ink">Smart Inventory Alerts</h2>
            <Link to="/app/inventory" className="text-[13px] font-medium text-primary hover:underline">
              View inventory →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {top3.map((x) => (
              <InventoryAlertCard key={x.product.id} item={x} />
            ))}
          </div>
        </div>
        <Card className="p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-[15px] font-semibold text-ink">Recent Activity</h3>
            <Link to="/app/activity" className="text-[13px] font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <ActivityTimeline items={activity.slice(0, 5)} compact />
        </Card>
      </div>
    </div>
  )
}
