import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Search, ShoppingCart } from 'lucide-react'
import { useAppStore, OPEN_PO_STATUSES } from '@/store/useAppStore'
import { useSuppliers } from '@/hooks/useDerived'
import type { POStatus } from '@/types'
import { POStatusBadge, ProductThumb, SupplierLogo } from '@/components/common'
import { Card, EmptyState, Input, PageHeader, Select } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { PurchaseOrderDetail } from '@/components/PurchaseOrderDetail'
import { formatDate } from '@/utils/date'
import { formatQty, formatRM, formatRM0 } from '@/utils/format'

const STATUSES: POStatus[] = ['Draft', 'Approved', 'Sent', 'Awaiting Confirmation', 'Confirmed', 'Changes Requested', 'Delivered', 'Cancelled']

export default function PurchaseOrders() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const pos = useAppStore((s) => s.purchaseOrders)
  const products = useAppStore((s) => s.products)
  const suppliers = useSuppliers()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'open' | POStatus>('all')
  const openId = params.get('po')

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return pos
      .filter((p) => {
        const sup = suppliers.find((s) => s.id === p.supplierId)?.name.toLowerCase() ?? ''
        const prod = products.find((x) => x.id === p.productId)?.name.toLowerCase() ?? ''
        return (!t || p.number.toLowerCase().includes(t) || sup.includes(t) || prod.includes(t)) && (status === 'all' || (status === 'open' ? OPEN_PO_STATUSES.includes(p.status) : p.status === status))
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [pos, q, status, suppliers, products])

  const open = pos.filter((p) => OPEN_PO_STATUSES.includes(p.status))
  const kpis = [
    { label: 'Open orders', value: open.length },
    { label: 'Ready to send', value: pos.filter((p) => p.status === 'Approved').length },
    { label: 'Awaiting supplier', value: pos.filter((p) => p.status === 'Sent' || p.status === 'Awaiting Confirmation').length },
    { label: 'Open order value', value: formatRM0(open.reduce((s, p) => s + p.total, 0)) },
  ]
  const setOpen = (id: string | null) => {
    const p = new URLSearchParams(params)
    if (id) p.set('po', id)
    else p.delete('po')
    setParams(p, { replace: !id })
  }

  return (
    <div>
      <PageHeader title="Purchase Orders" subtitle="Track approved orders from sending through confirmation and delivery." />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-white px-4 py-3">
            <div className="text-[12.5px] text-muted">{k.label}</div>
            <div className="mt-0.5 text-[20px] font-semibold text-ink tabular">{k.value}</div>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search PO number, supplier or product" className="pl-10" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-full sm:w-[210px]" aria-label="Status">
            <option value="all">All statuses</option>
            <option value="open">Open orders</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="h-7 w-7" />} title="No purchase orders" description="Purchase orders appear here once a manager approves a purchase request." action={<Button variant="outline" onClick={() => navigate('/app/approvals')}>Go to approvals</Button>} />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[1100px] text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-line bg-[#fafbfe] text-[12.5px] whitespace-nowrap text-muted">
                  <th className="py-3 pr-3 pl-5 font-medium">PO Number</th>
                  <th className="px-3 font-medium">Supplier</th>
                  <th className="px-3 font-medium">Product</th>
                  <th className="px-3 text-right font-medium">Quantity</th>
                  <th className="px-3 text-right font-medium">Total</th>
                  <th className="px-3 font-medium">Created</th>
                  <th className="px-3 font-medium">Expected Delivery</th>
                  <th className="px-3 font-medium">Status</th>
                  <th className="pr-5 pl-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const sup = suppliers.find((s) => s.id === p.supplierId)
                  const prod = products.find((x) => x.id === p.productId)
                  const cta = p.status === 'Approved' ? 'Send' : p.status === 'Confirmed' ? 'Receive' : p.status === 'Awaiting Confirmation' || p.status === 'Sent' ? 'Respond' : 'View'
                  return (
                    <tr key={p.id} onClick={() => setOpen(p.id)} className="group cursor-pointer border-b border-line/70 transition-colors last:border-0 hover:bg-[#f8f9ff]">
                      <td className="py-3.5 pr-3 pl-5 font-semibold whitespace-nowrap text-ink group-hover:text-primary">{p.number}</td>
                      <td className="px-3">
                        {sup && (
                          <div className="flex items-center gap-2.5">
                            <SupplierLogo supplier={sup} size="sm" />
                            <span className="max-w-[170px] truncate text-ink">{sup.name}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3">
                        {prod && (
                          <div className="flex items-center gap-2.5">
                            <ProductThumb product={prod} size="sm" />
                            <span className="whitespace-nowrap text-ink">{prod.name}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 text-right tabular">{formatQty(p.quantity, prod?.unit)}</td>
                      <td className="px-3 text-right font-semibold tabular">{formatRM(p.total)}</td>
                      <td className="px-3 text-muted">{formatDate(p.createdAt)}</td>
                      <td className="px-3 text-ink">{p.status === 'Cancelled' ? '—' : formatDate(p.expectedDelivery)}</td>
                      <td className="px-3">
                        <POStatusBadge status={p.status} />
                      </td>
                      <td className="pr-5 pl-3 text-right">
                        <Button size="sm" variant={cta === 'View' ? 'ghost' : 'secondary'} onClick={(e) => (e.stopPropagation(), setOpen(p.id))}>
                          {cta} <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PurchaseOrderDetail poId={openId} onClose={() => setOpen(null)} />
    </div>
  )
}
