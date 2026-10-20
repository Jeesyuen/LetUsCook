import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDownRight, ArrowUpRight, ClipboardList, Minus } from 'lucide-react'
import { Modal } from './ui/Overlay'
import { Button } from './ui/Button'
import { Input, Label, SegmentedTabs, Select, Textarea } from './ui/primitives'
import { ProductThumb, StockStatusBadge } from './common'
import { useAppStore } from '@/store/useAppStore'
import { useProductForecast } from '@/hooks/useDerived'
import { formatDateTime } from '@/utils/date'
import { cn, formatQty, formatRM, round } from '@/utils/format'

const REASONS = ['Damage', 'Expired', 'Misplacement', 'Stocktake Variance', 'Other'] as const

export function StockAdjustmentModal({ productId, open, onClose }: { productId: string | null; open: boolean; onClose: () => void }) {
  const pf = useProductForecast(productId ?? undefined)
  const movements = useAppStore((s) => s.movements)
  const adjust = useAppStore((s) => s.adjustStock)
  const [mode, setMode] = useState<'quantity' | 'value'>('quantity')
  const [count, setCount] = useState('')
  const [reason, setReason] = useState<string>('Stocktake Variance')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && pf) {
      setMode('quantity')
      setCount(String(pf.product.currentStock))
      setReason('Stocktake Variance')
      setNotes('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId])

  const history = useMemo(() => movements.filter((m) => m.productId === productId && m.type !== 'usage').slice(0, 5), [movements, productId])
  if (!pf) return null
  const { product, forecast } = pf
  const raw = parseFloat(count)
  const valid = Number.isFinite(raw) && raw >= 0
  const physical = valid ? (mode === 'value' ? round(raw / product.unitCost, 2) : raw) : product.currentStock
  const diff = round(physical - product.currentStock, 2)

  const save = async () => {
    if (!valid) return
    setSaving(true)
    await new Promise((r) => setTimeout(r, 400))
    adjust(product.id, physical, reason, notes.trim() || undefined)
    setSaving(false)
    toast.success('Stock adjustment saved', { description: `${product.name} is now ${formatQty(physical, product.unit)}. Forecast updated.` })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Audit Stock"
      description="Update your physical inventory count."
      icon={<ClipboardList className="h-5 w-5" />}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!valid || diff === 0}>
            Save Adjustment
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div>
            <Label>Adjustment type</Label>
            <SegmentedTabs
              items={[
                { value: 'quantity', label: 'Quantity' },
                { value: 'value', label: 'Value (RM)' },
              ]}
              value={mode}
              onChange={(v) => {
                setMode(v)
                setCount(v === 'value' ? String(round(product.currentStock * product.unitCost, 2)) : String(product.currentStock))
              }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cur">Current available</Label>
              <Input id="cur" disabled value={mode === 'value' ? formatRM(product.currentStock * product.unitCost) : formatQty(product.currentStock, product.unit)} />
            </div>
            <div>
              <Label htmlFor="count" hint={mode === 'value' ? `@ ${formatRM(product.unitCost)}/${product.unit}` : product.unit}>
                {mode === 'value' ? 'Physical value' : 'Physical count'}
              </Label>
              <Input id="count" type="number" min={0} step="any" value={count} onChange={(e) => setCount(e.target.value)} autoFocus />
            </div>
          </div>
          <div className={cn('flex items-center justify-between rounded-xl border px-4 py-3', diff < 0 ? 'border-[#f8d3d6] bg-critical-soft' : diff > 0 ? 'border-[#cdebdc] bg-success-soft' : 'border-line bg-subtle')}>
            <span className="text-sm font-medium text-ink">Difference</span>
            <span className={cn('flex items-center gap-1.5 text-base font-semibold tabular', diff < 0 ? 'text-[#c23f48]' : diff > 0 ? 'text-[#17794f]' : 'text-muted')}>
              {diff < 0 ? <ArrowDownRight className="h-4 w-4" /> : diff > 0 ? <ArrowUpRight className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              {diff > 0 ? '+' : ''}
              {formatQty(diff, product.unit)}
              <span className="text-[13px] font-normal text-muted">({diff > 0 ? '+' : ''}{formatRM(diff * product.unitCost)})</span>
            </span>
          </div>
          <div>
            <Label htmlFor="reason">Adjustment reason</Label>
            <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="notes" hint="Optional">
              Notes
            </Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Two bags found torn during Friday stocktake" />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-subtle/60 p-4">
            <div className="flex items-center gap-3">
              <ProductThumb product={product} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{product.name}</div>
                <div className="text-xs text-muted">
                  {product.sku} · {product.category}
                </div>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <dt className="text-muted">Status</dt>
                <dd className="mt-1">
                  <StockStatusBadge status={forecast.status} />
                </dd>
              </div>
              <div>
                <dt className="text-muted">Days of cover</dt>
                <dd className="mt-1 font-semibold text-ink tabular">{forecast.daysRemaining} days</dd>
              </div>
              <div>
                <dt className="text-muted">Unit cost</dt>
                <dd className="mt-1 font-semibold text-ink tabular">{formatRM(product.unitCost)}</dd>
              </div>
              <div>
                <dt className="text-muted">Safety stock</dt>
                <dd className="mt-1 font-semibold text-ink tabular">{formatQty(forecast.safetyStock, product.unit)}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h4 className="mb-2 text-[13px] font-semibold text-ink">Adjustment history</h4>
            {history.length === 0 && <p className="text-[13px] text-muted">No adjustments or receipts recorded yet.</p>}
            <ul className="space-y-2">
              {history.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-ink">{m.reason}</div>
                    <div className="text-[11.5px] text-muted">
                      {formatDateTime(m.date)} · {m.user}
                    </div>
                  </div>
                  <span className={cn('text-[13px] font-semibold tabular', m.quantity < 0 ? 'text-[#c23f48]' : 'text-[#17794f]')}>
                    {m.quantity > 0 ? '+' : ''}
                    {formatQty(m.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </Modal>
  )
}
