import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, Clock, CreditCard, FileText, Globe, Mail, MapPin, MessageCircle, Phone, SearchX, ShoppingCart, Star, UserRound } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useForecasts, useSuppliers } from '@/hooks/useDerived'
import { supplierProducts } from '@/data/mockData'
import { POStatusBadge, ProductThumb, SupplierLogo } from '@/components/common'
import { Badge, Card, EmptyState, ProgressBar, SegmentedTabs } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { CreatePurchaseRequestModal, RequestQuotationModal } from '@/components/SupplierModals'
import { addDays, formatDate, startOfToday } from '@/utils/date'
import { formatQty, formatRM } from '@/utils/format'

type Tab = 'catalogue' | 'quotations' | 'orders' | 'performance'
const monthFmt = new Intl.DateTimeFormat('en-MY', { month: 'short' })

export default function SupplierProfilePage() {
  const { supplierId } = useParams()
  const navigate = useNavigate()
  const suppliers = useSuppliers()
  const all = useForecasts()
  const pos = useAppStore((s) => s.purchaseOrders)
  const history = useAppStore((s) => s.quotationHistory)
  const approvals = useAppStore((s) => s.approvals)
  const [tab, setTab] = useState<Tab>('catalogue')
  const [rfqProduct, setRfqProduct] = useState<string | undefined>()
  const [rfqOpen, setRfqOpen] = useState(false)
  const [poOpen, setPoOpen] = useState(false)

  const s = suppliers.find((x) => x.id === supplierId)
  const catalogue = useMemo(() => supplierProducts.filter((sp) => sp.supplierId === supplierId).map((sp) => ({ sp, pf: all.find((x) => x.product.id === sp.productId) })).filter((x) => x.pf), [supplierId, all])
  const myPOs = pos.filter((p) => p.supplierId === supplierId)
  const quotes = [
    ...approvals.filter((a) => a.supplierId === supplierId && a.kind === 'purchase').map((a) => ({ id: a.id, productId: a.productId, quantity: a.quantity, total: a.total, date: a.requestedAt, outcome: a.status === 'Approved' ? 'Accepted' : a.status === 'Rejected' ? 'Rejected' : 'Pending approval' })),
    ...history.filter((h) => h.supplierId === supplierId),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const perf = useMemo(() => {
    if (!s) return []
    return Array.from({ length: 6 }, (_, i) => {
      const d = addDays(startOfToday(), -30 * (5 - i))
      const wobble = Math.round(Math.sin(i * 1.9 + s.reliability) * 3)
      return { month: monthFmt.format(d), onTime: Math.min(100, Math.max(0, s.onTimeRate + wobble)) }
    })
  }, [s])

  if (!s)
    return (
      <Card>
        <EmptyState icon={<SearchX className="h-7 w-7" />} title="Supplier not found" action={<Button onClick={() => navigate('/app/suppliers')}>Back to suppliers</Button>} />
      </Card>
    )

  const productName = (id: string) => all.find((x) => x.product.id === id)?.product.name ?? 'Item'
  const productUnit = (id: string) => all.find((x) => x.product.id === id)?.product.unit ?? ''
  const contact = [
    { icon: UserRound, label: 'Contact', value: s.contactName },
    { icon: Phone, label: 'Phone', value: s.phone || '—' },
    { icon: MessageCircle, label: 'WhatsApp', value: s.whatsapp || '—' },
    { icon: Mail, label: 'Email', value: s.email },
    { icon: Globe, label: 'Website', value: s.website || '—' },
    { icon: MapPin, label: 'Address', value: s.address },
    { icon: Clock, label: 'Average lead time', value: `${s.avgDeliveryDays} ${s.avgDeliveryDays === 1 ? 'day' : 'days'}` },
    { icon: CreditCard, label: 'Payment terms', value: s.paymentTerms },
  ]
  const performance = [
    { label: 'Reliability (on-time, in-full)', value: s.reliability, display: `${s.reliability}%` },
    { label: 'On-time delivery rate', value: s.onTimeRate, display: `${s.onTimeRate}%` },
    { label: 'Quality score', value: s.qualityRating * 20, display: `${s.qualityRating.toFixed(1)} / 5` },
  ]

  return (
    <div>
      <Link to="/app/suppliers" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted transition hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All suppliers
      </Link>

      <Card className="relative mb-6 overflow-hidden p-6">
        <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-gradient-to-br from-[#e3e8ff] to-[#efe6ff] blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <SupplierLogo supplier={s} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-ink">{s.name}</h1>
                <Badge tone={s.status === 'Active' ? 'success' : 'neutral'} dot>
                  {s.status}
                </Badge>
                {s.preferred && (
                  <Badge tone="primary">
                    <Star className="h-3 w-3" /> Preferred
                  </Badge>
                )}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[13.5px] text-muted">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {s.location}, {s.state}
                </span>
                <span>{s.category}</span>
                <span>Supplier since {s.since}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRfqProduct(undefined)
                setRfqOpen(true)
              }}
              disabled={catalogue.length === 0}
            >
              <FileText className="h-4 w-4" /> Request Quotation
            </Button>
            <Button onClick={() => setPoOpen(true)} disabled={catalogue.length === 0}>
              <ShoppingCart className="h-4 w-4" /> Create Purchase Order
            </Button>
          </div>
        </div>
        <p className="relative mt-4 max-w-3xl text-[14px] leading-relaxed text-muted">{s.about}</p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="text-[15px] font-semibold text-ink">Supplier details</h3>
            <dl className="mt-4 space-y-3.5">
              {contact.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#9aa1b5]" />
                  <div className="min-w-0">
                    <dt className="text-[12px] text-muted">{label}</dt>
                    <dd className="text-[13.5px] break-words text-ink">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="text-[15px] font-semibold text-ink">Supplier performance</h3>
            {s.isNew ? (
              <p className="mt-3 text-[13.5px] text-muted">No completed orders yet. Performance metrics appear after the first deliveries.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {performance.map((p) => (
                  <div key={p.label}>
                    <div className="mb-1.5 flex justify-between text-[13px]">
                      <span className="text-muted">{p.label}</span>
                      <span className="font-semibold text-ink tabular">{p.display}</span>
                    </div>
                    <ProgressBar value={p.value} tone={p.value >= 90 ? 'success' : p.value >= 80 ? 'warning' : 'critical'} />
                  </div>
                ))}
                <div className="flex justify-between border-t border-line pt-3 text-[13px]">
                  <span className="text-muted">Completed orders</span>
                  <span className="font-semibold text-ink tabular">{s.completedOrders + myPOs.filter((p) => p.status === 'Delivered').length}</span>
                </div>
              </div>
            )}
          </Card>
        </div>

        <Card className="min-w-0 p-5">
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'catalogue', label: 'Product Catalogue', count: catalogue.length },
              { value: 'quotations', label: 'Quotations', count: quotes.length },
              { value: 'orders', label: 'Purchase Orders', count: myPOs.length },
              { value: 'performance', label: 'Performance History' },
            ]}
          />
          <div className="mt-5">
            {tab === 'catalogue' &&
              (catalogue.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">No catalogue items yet.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {catalogue.map(({ sp, pf }) => (
                    <div key={sp.productId} className="flex flex-col rounded-2xl border border-line p-4 transition hover:border-[#d3d9ea] hover:shadow-card">
                      <div className="flex items-center gap-3">
                        <ProductThumb product={pf!.product} size="lg" />
                        <div className="min-w-0">
                          <Link to={`/app/inventory/${sp.productId}`} className="block truncate text-[14px] font-semibold text-ink hover:text-primary">
                            {pf!.product.name}
                          </Link>
                          <div className="text-[12px] text-muted">{pf!.product.category}</div>
                        </div>
                      </div>
                      <dl className="mt-4 space-y-1.5 text-[13px]">
                        <div className="flex justify-between">
                          <dt className="text-muted">Price range</dt>
                          <dd className="font-semibold text-ink tabular">
                            {formatRM(sp.unitPrice * 0.96)} – {formatRM(sp.unitPrice)}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted">Minimum order</dt>
                          <dd className="text-ink tabular">{formatQty(sp.moq, pf!.product.unit)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted">Availability</dt>
                          <dd className="flex items-center gap-1.5 text-ink">
                            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Ships in {sp.leadTimeDays}d
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-2 text-[11.5px] text-[#9aa1b5]">Lower price applies from 3× MOQ</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-4"
                        onClick={() => {
                          setRfqProduct(sp.productId)
                          setRfqOpen(true)
                        }}
                      >
                        Request Quotation
                      </Button>
                    </div>
                  ))}
                </div>
              ))}

            {tab === 'quotations' &&
              (quotes.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">No quotations yet.</p>
              ) : (
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full min-w-[520px] text-left text-[13.5px]">
                    <thead>
                      <tr className="border-b border-line text-[12.5px] text-muted">
                        <th className="py-2.5 pr-3 font-medium">Date</th>
                        <th className="px-3 font-medium">Product</th>
                        <th className="px-3 text-right font-medium">Qty</th>
                        <th className="px-3 text-right font-medium">Total</th>
                        <th className="pl-3 font-medium">Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((h) => (
                        <tr key={h.id} className="border-b border-line/70 last:border-0">
                          <td className="py-3 pr-3 text-muted">{formatDate(h.date)}</td>
                          <td className="px-3 text-ink">{productName(h.productId)}</td>
                          <td className="px-3 text-right tabular">{formatQty(h.quantity, productUnit(h.productId))}</td>
                          <td className="px-3 text-right font-medium tabular">{formatRM(h.total)}</td>
                          <td className="pl-3">
                            <Badge tone={h.outcome === 'Accepted' ? 'success' : h.outcome === 'Pending approval' ? 'warning' : h.outcome === 'Rejected' ? 'critical' : 'neutral'}>{h.outcome}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

            {tab === 'orders' &&
              (myPOs.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">No purchase orders with this supplier yet.</p>
              ) : (
                <div className="space-y-2">
                  {myPOs.map((p) => (
                    <button key={p.id} onClick={() => navigate(`/app/purchase-orders?po=${p.id}`)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line px-4 py-3 text-left transition hover:bg-subtle">
                      <span className="font-semibold text-ink">{p.number}</span>
                      <span className="text-[13px] text-muted">
                        {formatQty(p.quantity, productUnit(p.productId))} {productName(p.productId)}
                      </span>
                      <span className="ml-auto text-[13.5px] font-semibold tabular">{formatRM(p.total)}</span>
                      <POStatusBadge status={p.status} />
                    </button>
                  ))}
                </div>
              ))}

            {tab === 'performance' &&
              (s.isNew ? (
                <p className="py-10 text-center text-sm text-muted">Performance history will appear after completed deliveries.</p>
              ) : (
                <div>
                  <p className="mb-3 text-[13px] text-muted">On-time delivery rate by month (last 6 months)</p>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={perf} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} />
                        <YAxis domain={[60, 100]} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                        <Tooltip cursor={{ fill: '#f3f5fb' }} formatter={(v) => [`${v}%`, 'On-time']} contentStyle={{ borderRadius: 12, border: '1px solid #E6E9F2', fontSize: 12 }} />
                        <Bar dataKey="onTime" fill="#3154DF" radius={[6, 6, 0, 0]} maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>

      <RequestQuotationModal supplier={s} productId={rfqProduct} open={rfqOpen} onClose={() => setRfqOpen(false)} />
      <CreatePurchaseRequestModal supplier={s} open={poOpen} onClose={() => setPoOpen(false)} />
    </div>
  )
}
