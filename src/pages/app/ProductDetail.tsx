import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ClipboardList, PackageX, RefreshCw, Search, ShoppingCart, Truck } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useOpenPOFor, useProductForecast, useSuppliers } from '@/hooks/useDerived'
import { buildForecastSeries, explainForecast } from '@/services/forecasting'
import { supplierProducts } from '@/data/mockData'
import { ChartLegend, ForecastChart } from '@/components/charts/ForecastChart'
import { POStatusBadge, ProductThumb, StockStatusBadge, SupplierLogo } from '@/components/common'
import { Badge, Card, CardHeader, EmptyState, SegmentedTabs } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { StockAdjustmentModal } from '@/components/StockAdjustmentModal'
import { ReorderSettingsModal } from '@/components/ReorderSettingsModal'
import { formatDate, formatDateTime, relativeTime } from '@/utils/date'
import { cn, formatQty, formatRM } from '@/utils/format'

export default function ProductDetail() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const { hash } = useLocation()
  const pf = useProductForecast(productId)
  const movements = useAppStore((s) => s.movements)
  const suppliers = useSuppliers()
  const openPO = useOpenPOFor(productId)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [reorderOpen, setReorderOpen] = useState(false)
  const [view, setView] = useState(0)
  const [moveFilter, setMoveFilter] = useState<'all' | 'receipt' | 'adjustment' | 'usage'>('all')

  const history = useMemo(() => movements.filter((m) => m.productId === productId), [movements, productId])
  const series = useMemo(() => (pf ? buildForecastSeries(pf.product, pf.forecast, openPO) : null), [pf, openPO])
  useEffect(() => {
    if (hash === '#history') setTimeout(() => document.getElementById('history')?.scrollIntoView({ behavior: 'smooth' }), 250)
  }, [hash])

  if (!pf || !series)
    return (
      <Card>
        <EmptyState icon={<PackageX className="h-7 w-7" />} title="Product not found" description="It may have been removed when demo data was reset." action={<Button onClick={() => navigate('/app/inventory')}>Back to inventory</Button>} />
      </Card>
    )

  const { product, forecast } = pf
  const preferred = suppliers.find((s) => s.id === product.reorder.preferredSupplierId)
  const catalogue = supplierProducts.filter((sp) => sp.productId === product.id)
  const prefQuote = catalogue.find((c) => c.supplierId === preferred?.id)
  const lastUpdated = history[0]?.date
  const shown = history.filter((m) => moveFilter === 'all' || m.type === moveFilter).slice(0, 12)
  const qty = forecast.suggestedQty || forecast.calculatedQty || product.orderMultiple
  const findSupplier = () => navigate(`/app/quotations?product=${product.id}&qty=${qty}`)
  const tints = ['', 'hue-rotate-[20deg] saturate-50', 'grayscale opacity-80']

  const facts = [
    { label: 'Current stock', value: formatQty(product.currentStock, product.unit), sub: `${formatRM(product.currentStock * product.unitCost)} at cost` },
    { label: 'Average daily usage', value: formatQty(forecast.avgDailyUsage, product.unit), sub: forecast.isBaseline ? 'Baseline estimate' : '14-day average' },
    { label: 'Estimated stockout', value: forecast.stockoutDate ? formatDate(forecast.stockoutDate) : '—', sub: forecast.daysRemaining >= 999 ? 'No usage recorded' : `${forecast.daysRemaining} days of cover` },
    { label: 'Reorder point', value: formatQty(forecast.reorderPoint, product.unit), sub: `${forecast.leadTimeDays}-day lead time + ${formatQty(forecast.safetyStock)} safety` },
    { label: 'Recommended quantity', value: forecast.suggestedQty > 0 ? formatQty(forecast.suggestedQty, product.unit) : 'None needed', sub: forecast.incoming > 0 ? `${formatQty(forecast.incoming, product.unit)} already on order` : 'Covers lead time + 21 days' },
  ]

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted transition hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <ProductThumb product={product} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-ink sm:text-[30px]">{product.name}</h1>
              <StockStatusBadge status={forecast.status} />
            </div>
            <p className="mt-1 text-[13.5px] text-muted">
              <span className="font-mono">{product.sku}</span> · {product.category} · Last updated {lastUpdated ? relativeTime(lastUpdated) : '—'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setReorderOpen(true)}>
            <RefreshCw className="h-4 w-4" /> Reorder Rule
          </Button>
          <Button variant="outline" onClick={() => setAdjustOpen(true)}>
            <ClipboardList className="h-4 w-4" /> Adjust Stock
          </Button>
          <Button onClick={findSupplier}>
            <ShoppingCart className="h-4 w-4" /> Reorder
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card className="grid gap-6 p-6 md:grid-cols-[240px_1fr]">
            <div>
              <div className="flex aspect-square items-center justify-center rounded-2xl border border-line bg-gradient-to-br from-[#fafbff] to-lavender">
                <div className={tints[view]}>
                  <ProductThumb product={product} size="xl" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {tints.map((t, i) => (
                  <button key={i} onClick={() => setView(i)} className={cn('flex aspect-square items-center justify-center rounded-xl border bg-[#fafbff] transition', view === i ? 'border-primary ring-2 ring-primary/15' : 'border-line hover:border-[#cfd5e6]')} aria-label={`Image ${i + 1}`}>
                    <div className={t}>
                      <ProductThumb product={product} size="sm" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-ink">About this product</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{product.description}</p>
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-[13.5px] sm:grid-cols-3">
                {[
                  ['Unit', product.unit],
                  ['Unit cost', formatRM(product.unitCost)],
                  ['Order multiple', formatQty(product.orderMultiple, product.unit)],
                  ['Safety stock', formatQty(product.reorder.safetyStock, product.unit)],
                  ['Trigger level', formatQty(product.reorder.triggerLevel, product.unit)],
                  ['Auto-draft', product.reorder.autoDraft ? 'On' : 'Off'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted">{k}</dt>
                    <dd className="mt-0.5 font-semibold text-ink tabular">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 rounded-xl bg-lavender/60 px-4 py-3 text-[13.5px] leading-relaxed text-[#2a3591]">{explainForecast(product, forecast)}</div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Stock forecast" subtitle={forecast.isBaseline ? 'Baseline forecast — not enough history yet for a trend.' : 'Last 14 days and the next 21 days.'} />
            <div className="px-3 pt-4 pb-5 sm:px-4">
              <ForecastChart points={series.points} unit={product.unit} safety={forecast.safetyStock} replenishDay={series.replenishDay} replenishQty={series.replenishQty} replenishFromPO={series.replenishFromPO} height={280} />
              <div className="mt-3 px-2">
                <ChartLegend replenishLabel={series.replenishFromPO ? 'With open PO' : 'With recommended order'} />
              </div>
            </div>
          </Card>

          <Card id="history" className="scroll-mt-24">
            <CardHeader
              title="Stock movement history"
              subtitle="Receipts, adjustments and daily usage synced from POS."
              action={
                <SegmentedTabs
                  size="sm"
                  value={moveFilter}
                  onChange={setMoveFilter}
                  items={[
                    { value: 'all', label: 'All' },
                    { value: 'receipt', label: 'Receipts' },
                    { value: 'adjustment', label: 'Adjustments' },
                    { value: 'usage', label: 'Usage' },
                  ]}
                />
              }
            />
            <div className="overflow-x-auto px-2 pt-3 pb-2 scrollbar-thin">
              {shown.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">No movements of this type yet.</p>
              ) : (
                <table className="w-full min-w-[560px] text-left text-[13.5px]">
                  <thead>
                    <tr className="text-[12.5px] text-muted">
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 font-medium">Type</th>
                      <th className="px-4 font-medium">Reason</th>
                      <th className="px-4 text-right font-medium">Change</th>
                      <th className="px-4 text-right font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((m) => (
                      <tr key={m.id} className="border-t border-line/70">
                        <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateTime(m.date)}</td>
                        <td className="px-4">
                          <Badge tone={m.type === 'receipt' ? 'success' : m.type === 'adjustment' ? 'warning' : 'neutral'}>{m.type === 'receipt' ? 'Receipt' : m.type === 'adjustment' ? 'Adjustment' : 'Usage'}</Badge>
                        </td>
                        <td className="px-4 text-ink">
                          {m.reason}
                          {m.reference && <span className="ml-1.5 text-muted">· {m.reference}</span>}
                          {m.notes && <div className="text-[12px] text-muted">{m.notes}</div>}
                        </td>
                        <td className={cn('px-4 text-right font-semibold tabular', m.quantity < 0 ? 'text-[#c23f48]' : 'text-[#17794f]')}>
                          {m.quantity > 0 ? '+' : ''}
                          {formatQty(m.quantity)}
                        </td>
                        <td className="px-4 text-right text-ink tabular">{formatQty(m.balanceAfter, product.unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="divide-y divide-line">
            {facts.map((f) => (
              <div key={f.label} className="flex items-start justify-between gap-4 px-5 py-4">
                <span className="text-[13px] text-muted">{f.label}</span>
                <span className="text-right">
                  <span className="block text-[15px] font-semibold text-ink tabular">{f.value}</span>
                  <span className="block text-[12px] text-muted">{f.sub}</span>
                </span>
              </div>
            ))}
          </Card>

          {openPO ? (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-muted">Open purchase order</span>
                <POStatusBadge status={openPO.status} />
              </div>
              <div className="mt-2 text-[15px] font-semibold text-ink">{openPO.number}</div>
              <div className="text-[13px] text-muted">
                {formatQty(openPO.quantity, product.unit)} · expected {formatDate(openPO.expectedDelivery)}
              </div>
              <Button variant="outline" className="mt-4 w-full" onClick={() => navigate(`/app/purchase-orders?po=${openPO.id}`)}>
                <Truck className="h-4 w-4" /> Track order
              </Button>
            </Card>
          ) : (
            <Button size="lg" className="w-full" onClick={findSupplier}>
              <Search className="h-4 w-4" /> Find Best Supplier
            </Button>
          )}

          {preferred && (
            <Card className="p-5">
              <span className="text-[13px] font-medium text-muted">Preferred supplier</span>
              <Link to={`/app/suppliers/${preferred.id}`} className="mt-3 flex items-center gap-3 rounded-xl transition hover:opacity-80">
                <SupplierLogo supplier={preferred} />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-ink">{preferred.name}</div>
                  <div className="text-[12.5px] text-muted">{preferred.location}, {preferred.state}</div>
                </div>
              </Link>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-[12px]">
                <div className="rounded-xl bg-subtle px-2 py-2.5">
                  <dt className="text-muted">Reliability</dt>
                  <dd className="mt-0.5 text-[14px] font-semibold text-ink">{preferred.isNew ? '—' : `${preferred.reliability}%`}</dd>
                </div>
                <div className="rounded-xl bg-subtle px-2 py-2.5">
                  <dt className="text-muted">Lead time</dt>
                  <dd className="mt-0.5 text-[14px] font-semibold text-ink">{prefQuote?.leadTimeDays ?? preferred.avgDeliveryDays}d</dd>
                </div>
                <div className="rounded-xl bg-subtle px-2 py-2.5">
                  <dt className="text-muted">Price</dt>
                  <dd className="mt-0.5 text-[14px] font-semibold text-ink">{prefQuote ? formatRM(prefQuote.unitPrice) : '—'}</dd>
                </div>
              </dl>
              {catalogue.length > 1 && <p className="mt-3 text-[12.5px] text-muted">{catalogue.length} suppliers quote this product.</p>}
            </Card>
          )}
        </div>
      </div>

      <StockAdjustmentModal productId={product.id} open={adjustOpen} onClose={() => setAdjustOpen(false)} />
      <ReorderSettingsModal productId={product.id} open={reorderOpen} onClose={() => setReorderOpen(false)} />
    </div>
  )
}
