import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { FileText, ShieldCheck, ShoppingCart, Truck } from 'lucide-react'
import { Modal } from './ui/Overlay'
import { Button } from './ui/Button'
import { DemoTag, Input, Label, Select, Textarea } from './ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { useForecasts } from '@/hooks/useDerived'
import { supplierProducts } from '@/data/mockData'
import { buildQuotations } from '@/services/scoring'
import type { Supplier } from '@/types'
import { formatQty, formatRM } from '@/utils/format'

function useCatalogue(supplier: Supplier | null, initialProductId?: string) {
  const all = useForecasts()
  const items = supplier ? supplierProducts.filter((sp) => sp.supplierId === supplier.id).map((sp) => ({ sp, pf: all.find((x) => x.product.id === sp.productId)! })).filter((x) => x.pf) : []
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('')
  const cur = items.find((i) => i.sp.productId === productId)
  const reset = () => {
    const first = items.find((i) => i.sp.productId === initialProductId) ?? items[0]
    if (first) {
      setProductId(first.sp.productId)
      setQty(String(Math.max(first.sp.moq, first.pf.forecast.suggestedQty || first.pf.forecast.calculatedQty || first.sp.moq)))
    }
  }
  return { items, productId, setProductId, qty, setQty, cur, reset }
}

/** Request a quotation from a supplier → opens the comparison for that product. */
export function RequestQuotationModal({ supplier, open, onClose, productId: initial }: { supplier: Supplier | null; open: boolean; onClose: () => void; productId?: string }) {
  const navigate = useNavigate()
  const c = useCatalogue(supplier, initial)
  useEffect(() => {
    if (open) c.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplier?.id, initial])
  if (!supplier) return null
  const q = parseFloat(c.qty)
  const go = () => {
    toast.success('Quotation request sent (simulated)', { description: `${supplier.name} responded instantly with demo pricing. Opening comparison…` })
    onClose()
    navigate(`/app/quotations?product=${c.productId}&qty=${q}`)
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request Quotation"
      description={`Ask ${supplier.name} to quote, then compare against other suppliers.`}
      icon={<FileText className="h-5 w-5" />}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} disabled={!c.cur || !(q > 0)}>
            Request & Compare
          </Button>
        </>
      }
    >
      {c.items.length === 0 ? (
        <p className="text-sm text-muted">This supplier has no product catalogue yet. Add catalogue pricing once the supplier sends a price list.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="rq-p">Product</Label>
            <Select id="rq-p" value={c.productId} onChange={(e) => c.setProductId(e.target.value)}>
              {c.items.map((i) => (
                <option key={i.sp.productId} value={i.sp.productId}>
                  {i.pf.product.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rq-q" hint={c.cur ? `MOQ ${formatQty(c.cur.sp.moq, c.cur.pf.product.unit)}` : undefined}>
              Quantity
            </Label>
            <Input id="rq-q" type="number" min={1} value={c.qty} onChange={(e) => c.setQty(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-subtle px-4 py-3 text-[13px]">
            <span className="text-muted">Sent via supplier email</span>
            <DemoTag />
          </div>
        </div>
      )}
    </Modal>
  )
}

/** Purchases started from a supplier profile still go through manager approval. */
export function CreatePurchaseRequestModal({ supplier, open, onClose }: { supplier: Supplier | null; open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const request = useAppStore((s) => s.requestApproval)
  const c = useCatalogue(supplier)
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (open) {
      c.reset()
      setReason('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplier?.id])
  if (!supplier) return null
  const q = parseFloat(c.qty)
  const quote = c.cur && q > 0 ? buildQuotations(c.cur.sp.productId, q).find((x) => x.supplierId === supplier.id) : undefined

  const submit = () => {
    if (!c.cur || !quote) return
    request({
      productId: c.cur.sp.productId,
      quantity: q,
      supplierId: supplier.id,
      priority: 'balanced',
      reason: reason.trim() || `Manual purchase request raised from ${supplier.name}'s profile.`,
      overrideReason: 'Supplier chosen directly from supplier profile',
    })
    toast.success('Purchase request sent for approval', { description: 'A PO will be generated once a manager approves it.' })
    onClose()
    navigate('/app/approvals')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Purchase Order"
      description={`Raise a purchase request with ${supplier.name}.`}
      icon={<ShoppingCart className="h-5 w-5" />}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!quote}>
            Submit for Approval
          </Button>
        </>
      }
    >
      {c.items.length === 0 ? (
        <p className="text-sm text-muted">This supplier has no product catalogue yet.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="po-p">Product</Label>
              <Select id="po-p" value={c.productId} onChange={(e) => c.setProductId(e.target.value)}>
                {c.items.map((i) => (
                  <option key={i.sp.productId} value={i.sp.productId}>
                    {i.pf.product.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="po-q" hint={c.cur?.pf.product.unit}>
                Quantity
              </Label>
              <Input id="po-q" type="number" min={1} value={c.qty} onChange={(e) => c.setQty(e.target.value)} />
            </div>
          </div>
          {quote && (
            <div className="rounded-xl border border-line p-4 text-[13.5px]">
              <div className="flex justify-between py-1">
                <span className="text-muted">Unit price</span>
                <span className="font-medium tabular">{formatRM(quote.unitPrice)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted">Delivery fee</span>
                <span className="font-medium tabular">{formatRM(quote.deliveryFee)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="flex items-center gap-1.5 text-muted">
                  <Truck className="h-3.5 w-3.5" /> Lead time
                </span>
                <span className="font-medium">{quote.leadTimeDays} days</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-line pt-2.5 text-[15px]">
                <span className="font-semibold">Total</span>
                <span className="font-semibold tabular">{formatRM(quote.total)}</span>
              </div>
              {q < quote.moq && <p className="mt-2 text-[12.5px] text-warning-ink">Below the supplier's MOQ of {formatQty(quote.moq, c.cur?.pf.product.unit)}.</p>}
            </div>
          )}
          <div>
            <Label htmlFor="po-r" hint="Optional">
              Reason
            </Label>
            <Textarea id="po-r" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this supplier and quantity?" />
          </div>
          <div className="flex gap-3 rounded-xl bg-lavender/70 p-3.5 text-[13px] text-[#2a3591]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>No purchase order is issued until a manager approves this request.</p>
          </div>
        </div>
      )}
    </Modal>
  )
}

const blank = { name: '', category: '', location: '', state: 'Selangor', address: '', contactName: '', phone: '', email: '', whatsapp: '', website: '', paymentTerms: 'Net 30', avgDeliveryDays: '3', about: '' }
const STATES = ['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Penang', 'Perak', 'Perlis', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'W.P. Kuala Lumpur', 'W.P. Putrajaya']

export function AddSupplierModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useAppStore((s) => s.addSupplier)
  const navigate = useNavigate()
  const [f, setF] = useState(blank)
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const valid = f.name.trim() && f.category.trim() && f.location.trim() && f.email.includes('@')
  const submit = () => {
    const id = add({
      name: f.name.trim(),
      category: f.category.trim(),
      location: f.location.trim(),
      state: f.state,
      address: f.address.trim() || `${f.location.trim()}, ${f.state}`,
      contactName: f.contactName.trim() || 'Sales team',
      phone: f.phone.trim(),
      email: f.email.trim(),
      whatsapp: f.whatsapp.trim() || f.phone.trim(),
      website: f.website.trim(),
      paymentTerms: f.paymentTerms,
      avgDeliveryDays: parseFloat(f.avgDeliveryDays) || 3,
      status: 'Active',
      preferred: false,
      about: f.about.trim() || 'Newly onboarded supplier.',
    })
    toast.success('Supplier added', { description: `${f.name} has been added to your directory.` })
    setF(blank)
    onClose()
    navigate(`/app/suppliers/${id}`)
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Add Supplier"
      description="New suppliers start without performance history; scores build up as orders complete."
      icon={<Truck className="h-5 w-5" />}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid}>
            Add Supplier
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="as-n">Company name</Label>
          <Input id="as-n" value={f.name} onChange={set('name')} placeholder="e.g. Seri Dairy Farm Sdn Bhd" autoFocus />
        </div>
        <div>
          <Label htmlFor="as-c">Category</Label>
          <Input id="as-c" value={f.category} onChange={set('category')} placeholder="e.g. Dairy" />
        </div>
        <div>
          <Label htmlFor="as-pt">Payment terms</Label>
          <Select id="as-pt" value={f.paymentTerms} onChange={set('paymentTerms')}>
            {['COD', 'Net 7', 'Net 14', 'Net 30', 'Net 60'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="as-l">City</Label>
          <Input id="as-l" value={f.location} onChange={set('location')} placeholder="e.g. Seremban" />
        </div>
        <div>
          <Label htmlFor="as-s">State</Label>
          <Select id="as-s" value={f.state} onChange={set('state')}>
            {STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="as-a" hint="Optional">
            Address
          </Label>
          <Input id="as-a" value={f.address} onChange={set('address')} />
        </div>
        <div>
          <Label htmlFor="as-cn">Contact person</Label>
          <Input id="as-cn" value={f.contactName} onChange={set('contactName')} />
        </div>
        <div>
          <Label htmlFor="as-e">Email</Label>
          <Input id="as-e" type="email" value={f.email} onChange={set('email')} placeholder="orders@company.my" />
        </div>
        <div>
          <Label htmlFor="as-p">Phone</Label>
          <Input id="as-p" value={f.phone} onChange={set('phone')} placeholder="+60 3-…" />
        </div>
        <div>
          <Label htmlFor="as-w" hint="Optional">
            WhatsApp
          </Label>
          <Input id="as-w" value={f.whatsapp} onChange={set('whatsapp')} placeholder="+60 1…" />
        </div>
        <div>
          <Label htmlFor="as-web" hint="Optional">
            Website
          </Label>
          <Input id="as-web" value={f.website} onChange={set('website')} />
        </div>
        <div>
          <Label htmlFor="as-d">Typical delivery (days)</Label>
          <Input id="as-d" type="number" min={1} value={f.avgDeliveryDays} onChange={set('avgDeliveryDays')} />
        </div>
      </div>
    </Modal>
  )
}
