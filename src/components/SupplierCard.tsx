import { useNavigate } from 'react-router-dom'
import { Clock, MapPin, Package, ShieldCheck, Star } from 'lucide-react'
import type { Supplier } from '@/types'
import { Badge } from './ui/primitives'
import { Button } from './ui/Button'
import { SupplierLogo } from './common'

export function SupplierCard({ supplier, productCount, onRequestQuote }: { supplier: Supplier; productCount: number; onRequestQuote: () => void }) {
  const navigate = useNavigate()
  const s = supplier
  return (
    <div className="group flex flex-col rounded-[18px] border border-line bg-[#fbfcff] p-1.5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d8deef] hover:shadow-lift">
      <div className="rounded-[14px] border border-line/70 bg-white p-4">
        <div className="flex items-start gap-3">
          <SupplierLogo supplier={s} />
          <div className="min-w-0 flex-1">
            <button onClick={() => navigate(`/app/suppliers/${s.id}`)} className="block max-w-full truncate text-left text-[15px] font-semibold text-ink transition hover:text-primary">
              {s.name}
            </button>
            <div className="mt-0.5 flex items-center gap-1 text-[12.5px] text-muted">
              <MapPin className="h-3.5 w-3.5" /> {s.location}, {s.state}
              {typeof s.distanceKm === 'number' && <span>· {s.distanceKm} km</span>}
            </div>
          </div>
          <Badge tone={s.status === 'Active' ? 'success' : 'neutral'} dot>
            {s.status}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{s.category}</Badge>
          {s.preferred && (
            <Badge tone="primary">
              <Star className="h-3 w-3" /> Preferred
            </Badge>
          )}
          {s.isNew && <Badge tone="violet">New</Badge>}
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-1 px-2.5 py-3 text-center">
        <div>
          <dt className="flex items-center justify-center gap-1 text-[11.5px] text-muted">
            <ShieldCheck className="h-3.5 w-3.5" /> Reliability
          </dt>
          <dd className="mt-0.5 text-[15px] font-semibold text-ink tabular">{s.isNew ? '—' : `${s.reliability}%`}</dd>
        </div>
        <div className="border-x border-line">
          <dt className="flex items-center justify-center gap-1 text-[11.5px] text-muted">
            <Clock className="h-3.5 w-3.5" /> Delivery
          </dt>
          <dd className="mt-0.5 text-[15px] font-semibold text-ink tabular">
            {s.avgDeliveryDays} {s.avgDeliveryDays === 1 ? 'day' : 'days'}
          </dd>
        </div>
        <div>
          <dt className="flex items-center justify-center gap-1 text-[11.5px] text-muted">
            <Package className="h-3.5 w-3.5" /> Products
          </dt>
          <dd className="mt-0.5 text-[15px] font-semibold text-ink tabular">{productCount}</dd>
        </div>
      </dl>
      <div className="flex gap-2 px-1.5 pb-1.5">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/app/suppliers/${s.id}`)}>
          View Profile
        </Button>
        <Button variant="secondary" size="sm" className="flex-1" onClick={onRequestQuote} disabled={productCount === 0}>
          Request Quote
        </Button>
      </div>
    </div>
  )
}
