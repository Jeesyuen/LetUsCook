import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardList, Eye, History, LayoutGrid, MoreHorizontal, PackageSearch, Plus, RefreshCw, Rows3, Search, ShoppingCart } from 'lucide-react'
import { useForecasts, useSuppliers, type ProductWithForecast } from '@/hooks/useDerived'
import type { StockStatus } from '@/services/forecasting'
import { Card, EmptyState, Input, PageHeader, ProgressBar, Select } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { ProductThumb, StockStatusBadge, stockBarTone } from '@/components/common'
import { StockAdjustmentModal } from '@/components/StockAdjustmentModal'
import { ReorderSettingsModal } from '@/components/ReorderSettingsModal'
import { AddProductModal } from '@/components/AddProductModal'
import { formatShortDate } from '@/utils/date'
import { cn, formatQty, formatRM } from '@/utils/format'

type SortKey = 'risk' | 'name' | 'stock-asc' | 'stock-desc' | 'days-asc' | 'days-desc'
const STATUSES: StockStatus[] = ['Healthy', 'Reorder Soon', 'Critical', 'Out of Stock']

/** Fill level of the stock bar: current stock relative to 2× the reorder point (≈ a comfortable full level). */
const fillPct = (x: ProductWithForecast) => (x.product.currentStock / Math.max(1, x.forecast.reorderPoint * 2)) * 100

export default function Inventory() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const all = useForecasts()
  const suppliers = useSuppliers()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [supplier, setSupplier] = useState('all')
  const status = params.get('status') ?? 'all'
  const [sort, setSort] = useState<SortKey>('risk')
  const [view, setView] = useState<'table' | 'grid'>('table')
  const [adjustId, setAdjustId] = useState<string | null>(null)
  const [reorderId, setReorderId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const categories = useMemo(() => [...new Set(all.map((x) => x.product.category))], [all])
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? '—'

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    const filtered = all.filter(
      (x) =>
        (!t || x.product.name.toLowerCase().includes(t) || x.product.sku.toLowerCase().includes(t)) &&
        (category === 'all' || x.product.category === category) &&
        (supplier === 'all' || x.product.supplierIds.includes(supplier) || x.product.reorder.preferredSupplierId === supplier) &&
        (status === 'all' || x.forecast.status === status),
    )
    const sorters: Record<SortKey, (a: ProductWithForecast, b: ProductWithForecast) => number> = {
      risk: (a, b) => a.forecast.coverageMargin - b.forecast.coverageMargin,
      name: (a, b) => a.product.name.localeCompare(b.product.name),
      'stock-asc': (a, b) => a.product.currentStock - b.product.currentStock,
      'stock-desc': (a, b) => b.product.currentStock - a.product.currentStock,
      'days-asc': (a, b) => a.forecast.daysRemaining - b.forecast.daysRemaining,
      'days-desc': (a, b) => b.forecast.daysRemaining - a.forecast.daysRemaining,
    }
    return [...filtered].sort(sorters[sort])
  }, [all, q, category, supplier, status, sort])

  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, all.filter((x) => x.forecast.status === s).length])), [all])
  const setStatus = (v: string) => {
    const p = new URLSearchParams(params)
    if (v === 'all') p.delete('status')
    else p.set('status', v)
    setParams(p, { replace: true })
  }
  const reorder = (x: ProductWithForecast) => navigate(`/app/quotations?product=${x.product.id}&qty=${x.forecast.suggestedQty || x.forecast.calculatedQty || x.product.orderMultiple}`)

  const actions = (x: ProductWithForecast) => [
    { label: 'View Details', icon: <Eye />, onClick: () => navigate(`/app/inventory/${x.product.id}`) },
    { label: 'Adjust Stock', icon: <ClipboardList />, onClick: () => setAdjustId(x.product.id) },
    { label: 'Reorder', icon: <ShoppingCart />, onClick: () => reorder(x) },
    { label: 'Set Reorder Rule', icon: <RefreshCw />, onClick: () => setReorderId(x.product.id) },
    { label: 'View Stock History', icon: <History />, onClick: () => navigate(`/app/inventory/${x.product.id}#history`) },
  ]
  const clear = () => {
    setQ('')
    setCategory('all')
    setSupplier('all')
    setStatus('all')
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Monitor stock levels and manage replenishment."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition',
              status === s ? 'border-primary/30 bg-lavender text-primary' : 'border-line bg-white text-muted hover:border-[#d3d9ea] hover:text-ink',
            )}
          >
            {s === 'all' ? 'All items' : s}
            <span className="ml-1.5 text-[12px] opacity-70 tabular">{s === 'all' ? all.length : counts[s]}</span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SKU" className="pl-10" />
          </div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full sm:w-[150px]" aria-label="Category">
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="w-full sm:w-[180px]" aria-label="Supplier">
            <option value="all">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full sm:w-[150px]" aria-label="Stock status">
            <option value="all">Any status</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-full sm:w-[190px]" aria-label="Sort">
            <option value="risk">Sort: Most at risk</option>
            <option value="days-asc">Days remaining ↑</option>
            <option value="days-desc">Days remaining ↓</option>
            <option value="stock-asc">Quantity ↑</option>
            <option value="stock-desc">Quantity ↓</option>
            <option value="name">Name A–Z</option>
          </Select>
          <div className="flex rounded-xl border border-line bg-subtle p-1" role="group" aria-label="View">
            {(
              [
                ['table', Rows3],
                ['grid', LayoutGrid],
              ] as const
            ).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)} className={cn('rounded-lg p-1.5 transition', view === v ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-ink')} aria-label={`${v} view`} aria-pressed={view === v}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<PackageSearch className="h-7 w-7" />} title="No products match" description="Try a different search term or clear the filters." action={<Button variant="outline" onClick={clear}>Clear filters</Button>} />
        ) : view === 'table' ? (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[1120px] text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-line bg-[#fafbfe] text-[12.5px] whitespace-nowrap text-muted">
                  <th className="py-3 pr-3 pl-5 font-medium">Product</th>
                  <th className="px-3 font-medium">SKU</th>
                  <th className="px-3 font-medium">Category</th>
                  <th className="px-3 font-medium">Supplier</th>
                  <th className="px-3 font-medium">Current Stock</th>
                  <th className="px-3 text-right font-medium">Daily Usage</th>
                  <th className="px-3 font-medium">Days Remaining</th>
                  <th className="px-3 font-medium">Status</th>
                  <th className="pr-5 pl-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.product.id} onClick={() => navigate(`/app/inventory/${x.product.id}`)} className="group cursor-pointer border-b border-line/70 transition-colors last:border-0 hover:bg-[#f8f9ff]">
                    <td className="py-3.5 pr-3 pl-5">
                      <div className="flex items-center gap-3">
                        <ProductThumb product={x.product} />
                        <div className="min-w-0">
                          <div className="font-semibold whitespace-nowrap text-ink group-hover:text-primary">{x.product.name}</div>
                          <div className="text-[12px] text-muted">{formatRM(x.product.unitCost)} / {x.product.unit}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 font-mono text-[12px] whitespace-nowrap text-muted">{x.product.sku}</td>
                    <td className="px-3 text-ink">{x.product.category}</td>
                    <td className="max-w-[160px] truncate px-3 text-ink">{supplierName(x.product.reorder.preferredSupplierId)}</td>
                    <td className="px-3">
                      <div className="w-[120px]">
                        <div className="mb-1.5 font-semibold text-ink tabular">{formatQty(x.product.currentStock, x.product.unit)}</div>
                        <ProgressBar value={fillPct(x)} tone={stockBarTone(x.forecast.status)} className="h-1" />
                      </div>
                    </td>
                    <td className="px-3 text-right whitespace-nowrap text-ink tabular">{formatQty(x.forecast.avgDailyUsage, x.product.unit)}</td>
                    <td className="px-3">
                      <div className="font-semibold text-ink tabular">{x.forecast.daysRemaining >= 999 ? '—' : `${x.forecast.daysRemaining} days`}</div>
                      <div className="text-[12px] text-muted">{x.forecast.stockoutDate ? `Out ${formatShortDate(x.forecast.stockoutDate)}` : 'No usage'}</div>
                    </td>
                    <td className="px-3">
                      <StockStatusBadge status={x.forecast.status} />
                    </td>
                    <td className="pr-5 pl-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {x.forecast.needsReorder && (
                          <Button size="sm" variant="secondary" onClick={() => reorder(x)}>
                            Reorder
                          </Button>
                        )}
                        <Menu
                          trigger={(open) => (
                            <button className={cn('rounded-lg p-2 text-muted transition hover:bg-subtle hover:text-ink', open && 'bg-subtle text-ink')} aria-label={`Actions for ${x.product.name}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          )}
                          items={actions(x)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {rows.map((x) => (
              <div key={x.product.id} onClick={() => navigate(`/app/inventory/${x.product.id}`)} className="group cursor-pointer rounded-2xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-start justify-between">
                  <ProductThumb product={x.product} size="lg" />
                  <div onClick={(e) => e.stopPropagation()}>
                    <Menu trigger={() => <button className="rounded-lg p-1.5 text-muted hover:bg-subtle" aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></button>} items={actions(x)} />
                  </div>
                </div>
                <div className="mt-3 font-semibold text-ink group-hover:text-primary">{x.product.name}</div>
                <div className="text-[12px] text-muted">
                  {x.product.sku} · {x.product.category}
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-[15px] font-semibold tabular">{formatQty(x.product.currentStock, x.product.unit)}</span>
                  <span className="text-[12.5px] text-muted tabular">{x.forecast.daysRemaining >= 999 ? '—' : `${x.forecast.daysRemaining} days`}</span>
                </div>
                <ProgressBar value={fillPct(x)} tone={stockBarTone(x.forecast.status)} className="mt-2 h-1" />
                <div className="mt-3">
                  <StockStatusBadge status={x.forecast.status} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[12.5px] text-muted">
          <span>
            Showing {rows.length} of {all.length} products
          </span>
          <span>Forecasts use a 14-day average of daily usage</span>
        </div>
      </Card>

      <StockAdjustmentModal productId={adjustId} open={!!adjustId} onClose={() => setAdjustId(null)} />
      <ReorderSettingsModal productId={reorderId} open={!!reorderId} onClose={() => setReorderId(null)} />
      <AddProductModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
