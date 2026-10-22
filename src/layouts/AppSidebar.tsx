import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Boxes, Building2, ChartLine, Check, ChevronsUpDown, ClipboardCheck, FileText, Globe, History, LayoutDashboard, LogOut, RotateCcw, Settings, ShoppingCart, Sparkles, Truck, Workflow, X, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Menu } from '@/components/ui/Menu'
import { ConfirmDialog } from '@/components/ui/Overlay'
import { useAppStore } from '@/store/useAppStore'
import { useRecommendations } from '@/hooks/useDerived'
import { cn } from '@/utils/format'

export function AppSidebar({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  const pendingApprovals = useAppStore((s) => s.approvals.filter((a) => a.status === 'Pending').length)
  const recs = useRecommendations().filter((r) => !r.pendingApproval && !r.openPO).length
  const business = useAppStore((s) => s.business)
  const user = useAppStore((s) => s.user)
  const reset = useAppStore((s) => s.resetDemo)
  const navigate = useNavigate()
  const [confirmReset, setConfirmReset] = useState(false)

  const groups: { label: string; items: { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: number }[] }[] = [
    {
      label: 'Workspace',
      items: [
        { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/app/inventory', label: 'Inventory', icon: Boxes },
        { to: '/app/forecasting', label: 'Forecasting', icon: ChartLine },
        { to: '/app/suppliers', label: 'Suppliers', icon: Truck },
      ],
    },
    {
      label: 'Procurement',
      items: [
        { to: '/app/quotations', label: 'Quotations', icon: FileText },
        { to: '/app/recommendations', label: 'AI Recommendations', icon: Sparkles, badge: recs },
        { to: '/app/approvals', label: 'Approvals', icon: ClipboardCheck, badge: pendingApprovals },
        { to: '/app/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
        { to: '/app/automation', label: 'Automation', icon: Workflow },
      ],
    },
    {
      label: 'System',
      items: [
        { to: '/app/activity', label: 'Activity Log', icon: History },
        { to: '/app/settings', label: 'Settings', icon: Settings },
      ],
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[68px] shrink-0 items-center justify-between px-5">
        <NavLink to="/" onClick={onNavigate} aria-label="SupplyWise AI home">
          <Logo />
        </NavLink>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-subtle lg:hidden" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="px-3 pb-2">
        <Menu
          className="block"
          align="left"
          trigger={() => (
            <button className="flex w-full items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5 text-left transition hover:border-[#d3d9ea] hover:bg-[#fbfbff]">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#11142d] text-[12px] font-bold text-white">B&C</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink">{business.name}</span>
                <span className="block truncate text-[11.5px] text-muted">{business.city} · Café</span>
              </span>
              <ChevronsUpDown className="h-4 w-4 text-muted" />
            </button>
          )}
          items={[
            { label: `${business.name} (active)`, icon: <Check />, onClick: () => toast.info(`${business.name} is your active workspace`) },
            { label: 'Business profile', icon: <Building2 />, onClick: () => (navigate('/app/settings'), onNavigate?.()) },
          ]}
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-3 scrollbar-thin">
        {groups.map((g) => (
          <div key={g.label} className="mb-4">
            <p className="px-3 pb-1.5 text-[11.5px] font-medium text-[#9aa1b5]">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map(({ to, label, icon: Icon, end, badge }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] font-medium whitespace-nowrap transition-colors duration-150',
                      isActive ? 'text-primary' : 'text-[#4d5470] hover:bg-[#f5f6fc] hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute inset-0 rounded-[10px] bg-lavender" />}
                      <Icon className={cn('relative h-[18px] w-[18px]', isActive ? 'text-primary' : 'text-[#8a91a8] group-hover:text-ink')} strokeWidth={1.9} />
                      <span className="relative flex-1">{label}</span>
                      {!!badge && <span className={cn('relative min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-semibold tabular', isActive ? 'bg-primary text-white' : 'bg-[#eef0f7] text-[#4d5470]')}>{badge}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <Menu
          className="block"
          align="left"
          side="top"
          trigger={() => (
            <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-subtle">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3154DF] to-[#9B5CFF] text-[13px] font-semibold text-white">{user.initials}</span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13.5px] font-semibold text-ink">{user.name}</span>
                <span className="block text-[12px] text-muted">{user.role}</span>
              </span>
              <ChevronsUpDown className="h-4 w-4 text-muted" />
            </button>
          )}
          items={[
            { label: 'Settings', icon: <Settings />, onClick: () => (navigate('/app/settings'), onNavigate?.()) },
            { label: 'Reset demo data', icon: <RotateCcw />, onClick: () => setConfirmReset(true) },
            { label: 'Back to website', icon: <Globe />, onClick: () => navigate('/') },
            { label: 'Sign out (demo)', icon: <LogOut />, onClick: () => navigate('/') },
          ]}
        />
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        tone="danger"
        title="Reset demo data?"
        description="Inventory, approvals, purchase orders and activity return to the starting scenario."
        confirmLabel="Reset demo"
        onConfirm={() => {
          reset()
          toast.success('Demo data reset')
          navigate('/app')
          onNavigate?.()
        }}
      />
    </div>
  )
}
