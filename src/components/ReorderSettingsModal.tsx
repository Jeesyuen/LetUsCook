import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { Modal } from './ui/Overlay'
import { Button } from './ui/Button'
import { Input, Label, Select, Toggle } from './ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { useProductForecast, useSuppliers } from '@/hooks/useDerived'
import { supplierProducts } from '@/data/mockData'
import { safetyStockFor } from '@/services/forecasting'
import { formatQty, formatRM, round } from '@/utils/format'

export function ReorderSettingsModal({ productId, open, onClose }: { productId: string | null; open: boolean; onClose: () => void }) {
  const pf = useProductForecast(productId ?? undefined)
  const save = useAppStore((s) => s.updateReorderSettings)
  const suppliers = useSuppliers()
  const [trigger, setTrigger] = useState('')
  const [qty, setQty] = useState('')
  const [useCalculated, setUseCalculated] = useState(true)
  const [supplierId, setSupplierId] = useState('')
  const [lead, setLead] = useState('')
  const [safety, setSafety] = useState('')
  const [autoDraft, setAutoDraft] = useState(true)

  useEffect(() => {
    if (open && pf) {
      const r = pf.product.reorder
      setTrigger(String(r.triggerLevel))
      setQty(String(r.reorderQty ?? pf.forecast.calculatedQty))
      setUseCalculated(r.reorderQty === null)
      setSupplierId(r.preferredSupplierId)
      setLead(String(r.leadTimeDays))
      setSafety(String(r.safetyStock))
      setAutoDraft(r.autoDraft)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId])

  if (!pf) return null
  const { product, forecast } = pf
  const catalogue = supplierProducts.filter((sp) => sp.productId === product.id)
  const options = suppliers.filter((s) => catalogue.some((c) => c.supplierId === s.id) || s.id === product.reorder.preferredSupplierId)
  const leadN = parseFloat(lead) || 0
  const safetyN = parseFloat(safety) || 0
  // Same formula as the forecast's reorder point, using the values being edited
  const suggestedTrigger = round(forecast.forecastDailyUsage * leadN + safetyStockFor(safetyN, forecast.usageStdDev, leadN), 1)
  const sp = catalogue.find((c) => c.supplierId === supplierId)
  const valid = parseFloat(trigger) >= 0 && leadN > 0 && safetyN >= 0 && (useCalculated || parseFloat(qty) > 0)

  const submit = () => {
    save(product.id, {
      triggerLevel: parseFloat(trigger),
      reorderQty: useCalculated ? null : parseFloat(qty),
      preferredSupplierId: supplierId,
      leadTimeDays: leadN,
      safetyStock: safetyN,
      autoDraft,
    })
    toast.success('Reorder rule saved', { description: `${product.name} will be recommended for restock at ${formatQty(parseFloat(trigger), product.unit)}.` })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Set Automatic Reorder"
      description="Configure when SupplyWise should recommend replenishment."
      icon={<RefreshCw className="h-5 w-5" />}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid}>
            Save Settings
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="trigger" hint={`Suggested ${formatQty(suggestedTrigger)}`}>
              Stock trigger level
            </Label>
            <div className="relative">
              <Input id="trigger" type="number" min={0} step="any" value={trigger} onChange={(e) => setTrigger(e.target.value)} className="pr-12" />
              <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-muted">{product.unit}</span>
            </div>
          </div>
          <div>
            <Label htmlFor="safety">Safety stock</Label>
            <div className="relative">
              <Input id="safety" type="number" min={0} step="any" value={safety} onChange={(e) => setSafety(e.target.value)} className="pr-12" />
              <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-muted">{product.unit}</span>
            </div>
          </div>
        </div>
        <div>
          <Label htmlFor="sup">Preferred supplier</Label>
          <Select id="sup" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          {sp && (
            <p className="mt-1.5 text-xs text-muted">
              Quoted {formatRM(sp.unitPrice)}/{product.unit} · MOQ {formatQty(sp.moq, product.unit)} · quoted lead time {sp.leadTimeDays} days
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="lead">Supplier lead time</Label>
            <div className="relative">
              <Input id="lead" type="number" min={1} value={lead} onChange={(e) => setLead(e.target.value)} className="pr-14" />
              <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-muted">days</span>
            </div>
          </div>
          <div>
            <Label htmlFor="qty" hint={useCalculated ? 'Auto' : 'Fixed'}>
              Reorder quantity
            </Label>
            <div className="relative">
              <Input id="qty" type="number" min={1} value={useCalculated ? String(forecast.calculatedQty) : qty} disabled={useCalculated} onChange={(e) => setQty(e.target.value)} className="pr-12" />
              <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-muted">{product.unit}</span>
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" checked={useCalculated} onChange={(e) => setUseCalculated(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
          Use calculated quantity (lead time + coverage days + safety stock − current stock)
        </label>
        <div className="rounded-xl border border-line p-4">
          <Toggle checked={autoDraft} onChange={setAutoDraft} label="Draft a recommendation automatically" description="When stock reaches the trigger level, SupplyWise prepares a restock recommendation with ranked suppliers." />
        </div>
        <div className="flex gap-3 rounded-xl bg-lavender/70 p-3.5 text-[13px] text-[#2a3591]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Automatic reorder only drafts recommendations. A manager must still approve every purchase before a PO is issued or sent.</p>
        </div>
      </div>
    </Modal>
  )
}
