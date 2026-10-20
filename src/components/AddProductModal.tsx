import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PackagePlus } from 'lucide-react'
import { Modal } from './ui/Overlay'
import { Button } from './ui/Button'
import { Input, Label, Select, Textarea } from './ui/primitives'
import { useAppStore, type NewProductInput } from '@/store/useAppStore'
import { useSuppliers } from '@/hooks/useDerived'
import type { ProductCategory, ProductIcon } from '@/types'

const categories: { value: ProductCategory; icon: ProductIcon }[] = [
  { value: 'Coffee', icon: 'coffee' },
  { value: 'Dairy', icon: 'milk' },
  { value: 'Sweeteners', icon: 'sugar' },
  { value: 'Packaging', icon: 'cup' },
  { value: 'Tea', icon: 'tea' },
  { value: 'Syrups', icon: 'syrup' },
]

const blank = { name: '', sku: '', category: 'Coffee' as ProductCategory, unit: 'kg', description: '', currentStock: '', dailyUsage: '', unitCost: '', gp: '', safetyStock: '', leadTimeDays: '3', supplierId: '', multiple: '1' }

export function AddProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useAppStore((s) => s.addProduct)
  const count = useAppStore((s) => s.products.length)
  const suppliers = useSuppliers()
  const navigate = useNavigate()
  const [f, setF] = useState(blank)
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const n = (v: string) => parseFloat(v)
  const valid = f.name.trim() && n(f.currentStock) >= 0 && n(f.dailyUsage) >= 0 && n(f.unitCost) > 0 && n(f.leadTimeDays) > 0 && f.supplierId

  const submit = () => {
    const cat = categories.find((c) => c.value === f.category)!
    const input: NewProductInput = {
      name: f.name.trim(),
      sku: f.sku.trim() || `BCC-NEW-${String(count + 1).padStart(3, '0')}`,
      category: f.category,
      unit: f.unit.trim() || 'unit',
      icon: cat.icon,
      description: f.description.trim() || 'Added during demo.',
      currentStock: n(f.currentStock),
      dailyUsage: n(f.dailyUsage) || 0,
      unitCost: n(f.unitCost),
      grossProfitPerUnit: n(f.gp) || 0,
      safetyStock: n(f.safetyStock) || 0,
      leadTimeDays: n(f.leadTimeDays),
      preferredSupplierId: f.supplierId,
      orderMultiple: n(f.multiple) || 1,
    }
    const id = add(input)
    toast.success('Product added', { description: `${input.name} uses a baseline forecast until usage history builds up.` })
    setF(blank)
    onClose()
    navigate(`/app/inventory/${id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Add Product"
      description="New products start with a simple baseline forecast from your estimated daily usage."
      icon={<PackagePlus className="h-5 w-5" />}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid}>
            Add Product
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="np-name">Product name</Label>
          <Input id="np-name" value={f.name} onChange={set('name')} placeholder="e.g. Vanilla Syrup" autoFocus />
        </div>
        <div>
          <Label htmlFor="np-sku" hint="Optional">
            SKU
          </Label>
          <Input id="np-sku" value={f.sku} onChange={set('sku')} placeholder="Auto-generated" />
        </div>
        <div>
          <Label htmlFor="np-cat">Category</Label>
          <Select id="np-cat" value={f.category} onChange={set('category')}>
            {categories.map((c) => (
              <option key={c.value}>{c.value}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="np-unit">Unit</Label>
          <Input id="np-unit" value={f.unit} onChange={set('unit')} placeholder="kg, L, pcs, btl" />
        </div>
        <div>
          <Label htmlFor="np-stock">Opening stock</Label>
          <Input id="np-stock" type="number" min={0} value={f.currentStock} onChange={set('currentStock')} />
        </div>
        <div>
          <Label htmlFor="np-usage">Estimated daily usage</Label>
          <Input id="np-usage" type="number" min={0} step="any" value={f.dailyUsage} onChange={set('dailyUsage')} />
        </div>
        <div>
          <Label htmlFor="np-cost">Unit cost (RM)</Label>
          <Input id="np-cost" type="number" min={0} step="0.01" value={f.unitCost} onChange={set('unitCost')} />
        </div>
        <div>
          <Label htmlFor="np-safety">Safety stock</Label>
          <Input id="np-safety" type="number" min={0} step="any" value={f.safetyStock} onChange={set('safetyStock')} />
        </div>
        <div>
          <Label htmlFor="np-lead">Supplier lead time (days)</Label>
          <Input id="np-lead" type="number" min={1} value={f.leadTimeDays} onChange={set('leadTimeDays')} />
        </div>
        <div>
          <Label htmlFor="np-sup">Preferred supplier</Label>
          <Select id="np-sup" value={f.supplierId} onChange={set('supplierId')}>
            <option value="">Select supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="np-gp" hint="For profit-at-risk">
            Gross profit per unit (RM)
          </Label>
          <Input id="np-gp" type="number" min={0} step="0.01" value={f.gp} onChange={set('gp')} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="np-desc" hint="Optional">
            Description
          </Label>
          <Textarea id="np-desc" value={f.description} onChange={set('description')} />
        </div>
      </div>
    </Modal>
  )
}
