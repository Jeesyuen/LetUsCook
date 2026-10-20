import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { ProductWithForecast } from '@/hooks/useDerived'
import { Button } from './ui/Button'
import { Card, ProgressBar } from './ui/primitives'
import { ProductThumb, StockStatusBadge, stockBarTone } from './common'
import { formatShortDate } from '@/utils/date'
import { formatQty } from '@/utils/format'

export function InventoryAlertCard({ item }: { item: ProductWithForecast }) {
  const { product, forecast } = item
  const navigate = useNavigate()
  const coverPct = Math.min(100, (forecast.daysRemaining / 21) * 100)
  return (
    <Card className="flex flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <ProductThumb product={product} />
        <StockStatusBadge status={forecast.status} />
      </div>
      <div className="mt-3 min-w-0">
        <div className="truncate text-[15px] font-semibold text-ink">{product.name}</div>
        <div className="text-[12.5px] text-muted">{product.sku}</div>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
          <span className="text-muted">Days of cover</span>
          <span className="font-semibold text-ink tabular">{forecast.daysRemaining} days</span>
        </div>
        <ProgressBar value={coverPct} tone={stockBarTone(forecast.status)} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
        <div>
          <dt className="text-[12px] text-muted">In stock</dt>
          <dd className="mt-0.5 text-[14px] font-semibold text-ink tabular">{formatQty(product.currentStock, product.unit)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Stockout</dt>
          <dd className="mt-0.5 text-[14px] font-semibold text-ink tabular">{forecast.stockoutDate ? formatShortDate(forecast.stockoutDate) : '—'}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Reorder</dt>
          <dd className="mt-0.5 text-[14px] font-semibold text-ink tabular">{forecast.suggestedQty > 0 ? formatQty(forecast.suggestedQty, product.unit) : '—'}</dd>
        </div>
      </dl>
      <Button variant={forecast.status === 'Healthy' ? 'outline' : 'primary'} size="sm" className="mt-4 w-full" onClick={() => navigate(`/app/forecasting?product=${product.id}`)}>
        Review Restock <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </Card>
  )
}
