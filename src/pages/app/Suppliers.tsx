import { useMemo, useState } from 'react'
import { Plus, Search, SearchX } from 'lucide-react'
import { useSuppliers } from '@/hooks/useDerived'
import { supplierProducts } from '@/data/mockData'
import type { Supplier } from '@/types'
import { SupplierCard } from '@/components/SupplierCard'
import { AddSupplierModal, RequestQuotationModal } from '@/components/SupplierModals'
import { Card, EmptyState, Input, PageHeader, Select } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'

export default function Suppliers() {
  const suppliers = useSuppliers()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [location, setLocation] = useState('all')
  const [status, setStatus] = useState('all')
  const [rfq, setRfq] = useState<Supplier | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const categories = useMemo(() => [...new Set(suppliers.map((s) => s.category))], [suppliers])
  const states = useMemo(() => [...new Set(suppliers.map((s) => s.state))], [suppliers])
  const count = (id: string) => supplierProducts.filter((sp) => sp.supplierId === id).length

  const list = suppliers.filter((s) => {
    const t = q.trim().toLowerCase()
    return (
      (!t || s.name.toLowerCase().includes(t) || s.category.toLowerCase().includes(t) || s.location.toLowerCase().includes(t)) &&
      (category === 'all' || s.category === category) &&
      (location === 'all' || s.state === location) &&
      (status === 'all' || (status === 'preferred' ? s.preferred : s.status === status))
    )
  })

  const avgReliability = Math.round(suppliers.filter((s) => !s.isNew).reduce((a, s) => a + s.reliability, 0) / Math.max(1, suppliers.filter((s) => !s.isNew).length))

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Manage your supplier network and sourcing options."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Supplier
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Suppliers', suppliers.length],
          ['Preferred', suppliers.filter((s) => s.preferred).length],
          ['Avg. reliability', `${avgReliability}%`],
          ['States covered', states.length],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-white px-4 py-3">
            <div className="text-[12.5px] text-muted">{k}</div>
            <div className="mt-0.5 text-[20px] font-semibold text-ink tabular">{v}</div>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suppliers, categories or cities" className="pl-10" />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full sm:w-[170px]" aria-label="Category">
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select value={location} onChange={(e) => setLocation(e.target.value)} className="w-full sm:w-[170px]" aria-label="Location">
          <option value="all">All locations</option>
          {states.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full sm:w-[150px]" aria-label="Status">
          <option value="all">Any status</option>
          <option value="preferred">Preferred</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </Select>
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<SearchX className="h-7 w-7" />}
            title="No suppliers found"
            description="Adjust your search or filters."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQ('')
                  setCategory('all')
                  setLocation('all')
                  setStatus('all')
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => (
            <SupplierCard key={s.id} supplier={s} productCount={count(s.id)} onRequestQuote={() => setRfq(s)} />
          ))}
        </div>
      )}

      <RequestQuotationModal supplier={rfq} open={!!rfq} onClose={() => setRfq(null)} />
      <AddSupplierModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
