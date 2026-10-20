import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Bell, Boxes, Building2, Database, Mail, MessageCircle, Plug, RotateCcw, Scale, ShieldCheck, Workflow } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { criterionLabels } from '@/services/scoring'
import type { ScoringWeights } from '@/types'
import { Badge, Card, Input, Label, PageHeader, Toggle } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Overlay'
import { defaultSettings } from '@/data/mockData'
import { cn } from '@/utils/format'

function Section({ id, icon, title, description, children }: { id: string; icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24 p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavender text-primary [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>
        <div>
          <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
          <p className="text-[13px] text-muted">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  )
}

const nav = [
  ['business', 'Business Profile'],
  ['inventory', 'Inventory Preferences'],
  ['scoring', 'Supplier Scoring'],
  ['notifications', 'Notifications'],
  ['approval', 'Approval Rules'],
  ['integrations', 'Integrations'],
  ['demo', 'Demo Data'],
]

export default function Settings() {
  const navigate = useNavigate()
  const business = useAppStore((s) => s.business)
  const settings = useAppStore((s) => s.settings)
  const updateBusiness = useAppStore((s) => s.updateBusiness)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const reset = useAppStore((s) => s.resetDemo)

  const [biz, setBiz] = useState({ name: business.name, phone: business.phone, email: business.email, address: business.address, city: business.city })
  const [coverage, setCoverage] = useState(String(settings.coverageDays))
  const [weights, setWeights] = useState<ScoringWeights>(settings.balancedWeights)
  const [threshold, setThreshold] = useState(String(settings.approval.dualApprovalThreshold))
  const [resetOpen, setResetOpen] = useState(false)
  const total = Object.values(weights).reduce((a, b) => a + b, 0)

  const integrations = [
    { name: 'Email (SMTP / Gmail)', icon: <Mail className="h-4 w-4" />, desc: 'Send purchase orders and RFQs by email.' },
    { name: 'WhatsApp Business API', icon: <MessageCircle className="h-4 w-4" />, desc: 'Message suppliers and capture replies.' },
    { name: 'MCP Server', icon: <Plug className="h-4 w-4" />, desc: 'Let AI agents read inventory and draft procurement actions via tools.' },
    { name: 'Orbyte', icon: <Workflow className="h-4 w-4" />, desc: 'Sync products, stock and purchase orders with Orbyte.' },
  ]

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure your workspace, forecasting and approval policies." />
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="hidden lg:block">
          <div className="sticky top-24 space-y-0.5">
            {nav.map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={(e) => (e.preventDefault(), document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }))} className="block rounded-lg px-3 py-2 text-[13.5px] text-muted transition hover:bg-white hover:text-ink">
                {label}
              </a>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          <Section id="business" icon={<Building2 />} title="Business Profile" description="Shown on purchase orders and supplier messages.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="b-n">Business name</Label>
                <Input id="b-n" value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="b-r">Registration no.</Label>
                <Input id="b-r" value={business.registrationNo} disabled />
              </div>
              <div>
                <Label htmlFor="b-e">Email</Label>
                <Input id="b-e" value={biz.email} onChange={(e) => setBiz({ ...biz, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="b-p">Phone</Label>
                <Input id="b-p" value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="b-a">Address</Label>
                <Input id="b-a" value={biz.address} onChange={(e) => setBiz({ ...biz, address: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="b-c">City</Label>
                <Input id="b-c" value={biz.city} onChange={(e) => setBiz({ ...biz, city: e.target.value })} />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                onClick={() => {
                  updateBusiness(biz)
                  toast.success('Business profile saved')
                }}
                disabled={!biz.name.trim()}
              >
                Save profile
              </Button>
            </div>
          </Section>

          <Section id="inventory" icon={<Boxes />} title="Inventory Preferences" description="Defaults used by the forecasting engine.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="cov" hint="days">
                  Coverage target after delivery
                </Label>
                <Input id="cov" type="number" min={1} max={90} value={coverage} onChange={(e) => setCoverage(e.target.value)} />
                <p className="mt-1.5 text-[12px] text-muted">Suggested quantities cover the lead time plus this many days of demand.</p>
              </div>
              <div>
                <Label>Forecast method</Label>
                <div className="flex h-10 items-center rounded-xl border border-line bg-subtle px-3.5 text-sm text-muted">14-day moving average (deterministic)</div>
                <p className="mt-1.5 text-[12px] text-muted">Seasonal and ML models can be connected via the forecasting service later.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                disabled={!(parseInt(coverage) > 0)}
                onClick={() => {
                  updateSettings({ coverageDays: parseInt(coverage) })
                  toast.success('Inventory preferences saved', { description: 'Forecasts and suggested quantities recalculated.' })
                }}
              >
                Save preferences
              </Button>
            </div>
          </Section>

          <Section id="scoring" icon={<Scale />} title="Supplier Scoring Weights" description="Weights used for the Balanced priority. Other priorities use fixed presets.">
            <div className="space-y-4">
              {(Object.keys(weights) as (keyof ScoringWeights)[]).map((k) => (
                <div key={k} className="grid grid-cols-[110px_1fr_56px] items-center gap-4">
                  <span className="text-[13.5px] font-medium text-ink">{criterionLabels[k]}</span>
                  <input type="range" min={0} max={60} step={5} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} className="accent-primary" aria-label={`${criterionLabels[k]} weight`} />
                  <span className="text-right text-[14px] font-semibold text-ink tabular">{weights[k]}%</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <span className={cn('text-[13px]', total === 100 ? 'text-muted' : 'font-medium text-[#c23f48]')}>Total {total}% {total !== 100 && '— weights must add up to 100%'}</span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setWeights(defaultSettings.balancedWeights)}>
                  Restore defaults
                </Button>
                <Button
                  disabled={total !== 100}
                  onClick={() => {
                    updateSettings({ balancedWeights: weights })
                    toast.success('Scoring weights saved', { description: 'Compatibility scores are recalculated everywhere.' })
                  }}
                >
                  Save weights
                </Button>
              </div>
            </div>
          </Section>

          <Section id="notifications" icon={<Bell />} title="Notification Settings" description="Choose which events create in-app notifications.">
            <div className="divide-y divide-line">
              {(
                [
                  ['stockAlerts', 'Stock risk alerts', 'When a product becomes critical or out of stock.'],
                  ['approvalRequests', 'Approval requests', 'When a purchase needs your decision.'],
                  ['supplierResponses', 'Supplier responses', 'When a supplier confirms, declines or requests changes.'],
                  ['dailyDigest', 'Daily digest email', 'Morning summary of risks and pending actions (demo only).'],
                ] as const
              ).map(([k, label, desc]) => (
                <div key={k} className="py-3.5 first:pt-0 last:pb-0">
                  <Toggle
                    checked={settings.notifications[k]}
                    onChange={(v) => {
                      updateSettings({ notifications: { ...settings.notifications, [k]: v } })
                      toast.success(`${label} ${v ? 'enabled' : 'disabled'}`)
                    }}
                    label={label}
                    description={desc}
                  />
                </div>
              ))}
            </div>
          </Section>

          <Section id="approval" icon={<ShieldCheck />} title="Approval Rules" description="Purchasing commitments always require a manager decision.">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-subtle/50 p-4">
                <div>
                  <div className="text-sm font-medium text-ink">Manager approval required for every purchase order</div>
                  <div className="text-[13px] text-muted">Recommendations and automatic reorder rules can only draft requests.</div>
                </div>
                <Badge tone="success">Always on</Badge>
              </div>
              <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-subtle/50 p-4">
                <div>
                  <div className="text-sm font-medium text-ink">Re-approval when suppliers change terms</div>
                  <div className="text-[13px] text-muted">Price, quantity or lead-time changes return to the approval inbox.</div>
                </div>
                <Badge tone="success">Always on</Badge>
              </div>
              <Toggle
                checked={settings.approval.requireRejectionReason}
                onChange={(v) => updateSettings({ approval: { ...settings.approval, requireRejectionReason: v } })}
                label="Require a reason when rejecting"
                description="Keeps the audit trail clear for owners and auditors."
              />
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-[220px]">
                  <Label htmlFor="thr" hint="RM">
                    Flag for owner review above
                  </Label>
                  <Input id="thr" type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
                </div>
                <Button
                  variant="outline"
                  disabled={!(parseFloat(threshold) >= 0)}
                  onClick={() => {
                    updateSettings({ approval: { ...settings.approval, dualApprovalThreshold: parseFloat(threshold) } })
                    toast.success('Approval threshold saved')
                  }}
                >
                  Save threshold
                </Button>
              </div>
            </div>
          </Section>

          <Section id="integrations" icon={<Plug />} title="Communication Integrations" description="Live integrations are not connected in this prototype.">
            <div className="grid gap-3 sm:grid-cols-2">
              {integrations.map((i) => (
                <div key={i.name} className="flex items-start gap-3 rounded-xl border border-line p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted">{i.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium text-ink">{i.name}</span>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-muted">{i.desc}</p>
                    <Badge tone="neutral" className="mt-2">
                      Demo Mode — Not Connected
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              Sending, supplier replies and quotation requests are simulated so the full workflow can be demonstrated safely. The communication service (<code className="rounded bg-subtle px-1 text-[12px]">src/services/communication.ts</code>) is the integration point for real email, WhatsApp Business, MCP tools and Orbyte.
            </p>
          </Section>

          <Section id="demo" icon={<Database />} title="Demo Data Management" description="Demo changes are saved in this browser (localStorage).">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-lg text-[13.5px] text-muted">Reset to restore Brew & Co. Café's starting scenario: coffee beans at safety stock, one pending milk approval and three historical purchase orders.</p>
              <Button variant="danger" onClick={() => setResetOpen(true)}>
                <RotateCcw className="h-4 w-4" /> Reset Demo
              </Button>
            </div>
          </Section>
        </div>
      </div>
      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        tone="danger"
        title="Reset all demo data?"
        description="Inventory, approvals, purchase orders, messages and activity return to the starting scenario."
        confirmLabel="Reset Demo"
        onConfirm={() => {
          reset()
          toast.success('Demo data reset')
          navigate('/app')
        }}
      />
    </div>
  )
}
