import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, ChevronRight, CircleHelp, Menu as MenuIcon, Search } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useSuppliers } from '@/hooks/useDerived'
import { ProductThumb, SupplierLogo } from '@/components/common'
import { Modal } from '@/components/ui/Overlay'
import { Button } from '@/components/ui/Button'
import { relativeTime } from '@/utils/date'
import { cn } from '@/utils/format'

function useClickAway<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, close])
  return ref
}

const sectionNames: Record<string, string> = {
  inventory: 'Inventory',
  forecasting: 'Forecasting',
  suppliers: 'Suppliers',
  quotations: 'Supplier Comparison',
  recommendations: 'AI Recommendations',
  approvals: 'Approvals',
  'purchase-orders': 'Purchase Orders',
  activity: 'Activity Log',
  settings: 'Settings',
}

function Breadcrumbs() {
  const { pathname } = useLocation()
  const products = useAppStore((s) => s.products)
  const suppliers = useSuppliers()
  const parts = pathname.replace(/^\/app\/?/, '').split('/').filter(Boolean)
  const crumbs: { label: string; to?: string }[] = [{ label: 'Workspace', to: '/app' }]
  if (parts.length === 0) crumbs.push({ label: 'Overview' })
  else {
    crumbs.push({ label: sectionNames[parts[0]] ?? parts[0], to: parts.length > 1 ? `/app/${parts[0]}` : undefined })
    if (parts[1]) {
      const name = parts[0] === 'inventory' ? products.find((p) => p.id === parts[1])?.name : suppliers.find((s) => s.id === parts[1])?.name
      crumbs.push({ label: name ?? 'Details' })
    }
  }
  return (
    <nav className="flex min-w-0 items-center gap-1.5 text-[13.5px]" aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#b3b9cb]" />}
          {c.to ? (
            <Link to={c.to} className="truncate text-muted transition hover:text-ink">
              {c.label}
            </Link>
          ) : (
            <span className="truncate font-medium text-ink">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

function GlobalSearch() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const products = useAppStore((s) => s.products)
  const pos = useAppStore((s) => s.purchaseOrders)
  const suppliers = useSuppliers()
  const navigate = useNavigate()
  const ref = useClickAway<HTMLDivElement>(open, () => setOpen(false))

  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return null
    return {
      products: products.filter((p) => p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)).slice(0, 4),
      suppliers: suppliers.filter((s) => s.name.toLowerCase().includes(t) || s.location.toLowerCase().includes(t)).slice(0, 3),
      pos: pos.filter((p) => p.number.toLowerCase().includes(t)).slice(0, 3),
    }
  }, [q, products, pos, suppliers])

  const go = (to: string) => {
    navigate(to)
    setQ('')
    setOpen(false)
  }
  const empty = results && !results.products.length && !results.suppliers.length && !results.pos.length

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ref.current?.querySelector('input')?.focus()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [ref])

  const row = 'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-subtle'
  return (
    <div ref={ref} className="relative w-full max-w-[420px]">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="Search products, suppliers, POs…"
        className="h-9 w-full rounded-[10px] border border-line bg-[#f7f8fc] pr-14 pl-10 text-[13.5px] transition placeholder:text-[#a3a9bb] focus:border-primary/50 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:outline-none"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded-md border border-line bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-muted md:block">Ctrl K</kbd>
      <AnimatePresence>
        {open && results && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="absolute top-11 right-0 left-0 z-50 rounded-2xl border border-line bg-white p-2 shadow-lift">
            {empty && <p className="px-3 py-4 text-center text-sm text-muted">No results for “{q}”</p>}
            {!!results.products.length && <p className="px-3 pt-1 pb-1 text-xs font-medium text-muted">Products</p>}
            {results.products.map((p) => (
              <button key={p.id} onClick={() => go(`/app/inventory/${p.id}`)} className={row}>
                <ProductThumb product={p} size="sm" />
                <span className="flex-1 text-sm font-medium">{p.name}</span>
                <span className="text-xs text-muted">{p.sku}</span>
              </button>
            ))}
            {!!results.suppliers.length && <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted">Suppliers</p>}
            {results.suppliers.map((s) => (
              <button key={s.id} onClick={() => go(`/app/suppliers/${s.id}`)} className={row}>
                <SupplierLogo supplier={s} size="sm" />
                <span className="flex-1 text-sm font-medium">{s.name}</span>
                <span className="text-xs text-muted">{s.location}</span>
              </button>
            ))}
            {!!results.pos.length && <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted">Purchase orders</p>}
            {results.pos.map((p) => (
              <button key={p.id} onClick={() => go(`/app/purchase-orders?po=${p.id}`)} className={cn(row, 'text-sm font-medium')}>
                {p.number}
                <span className="ml-auto text-xs font-normal text-muted">{p.status}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Notifications() {
  const [open, setOpen] = useState(false)
  const notifications = useAppStore((s) => s.notifications)
  const markRead = useAppStore((s) => s.markNotificationRead)
  const markAll = useAppStore((s) => s.markAllNotificationsRead)
  const navigate = useNavigate()
  const ref = useClickAway<HTMLDivElement>(open, () => setOpen(false))
  const unread = notifications.filter((n) => !n.read).length
  const toneDot = { info: 'bg-primary', success: 'bg-success', warning: 'bg-warning', critical: 'bg-critical' }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative flex h-9 w-9 items-center justify-center rounded-[10px] text-[#4d5470] transition hover:bg-subtle hover:text-ink" aria-label={`Notifications (${unread} unread)`}>
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white ring-2 ring-white">{unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="absolute top-11 right-0 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white shadow-lift">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-semibold">Notifications</span>
              <button onClick={markAll} className="text-xs font-medium text-primary hover:underline disabled:opacity-40" disabled={!unread}>
                Mark all as read
              </button>
            </div>
            <div className="max-h-[380px] overflow-y-auto p-1.5 scrollbar-thin">
              {notifications.length === 0 && <p className="py-8 text-center text-sm text-muted">You're all caught up.</p>}
              {notifications.slice(0, 12).map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    markRead(n.id)
                    setOpen(false)
                    if (n.link) navigate(n.link)
                  }}
                  className={cn('flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-subtle', !n.read && 'bg-[#f7f8ff]')}
                >
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', toneDot[n.tone], n.read && 'opacity-30')} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-ink">{n.title}</span>
                    <span className="block text-[12.5px] text-muted">{n.body}</span>
                    <span className="mt-0.5 block text-[11.5px] text-[#a3a9bb]">{relativeTime(n.date)}</span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const demoSteps = [
  'On Overview, find the Arabica Coffee Beans alert and click Review Restock.',
  'Review the forecast, then click Find Best Supplier.',
  'Compare the three quotations, try different priorities, and click Request Manager Approval.',
  'In Approvals, approve the request — a purchase order is generated.',
  'Open the PO, choose Send via WhatsApp or Email, and confirm the simulated send.',
  'Click Simulate Acceptance, then Record Delivery to receive the goods.',
  'Check Inventory, Forecasting and the Activity Log — everything updates.',
]

function HelpGuide() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#4d5470] transition hover:bg-subtle hover:text-ink" aria-label="Help and demo guide">
        <CircleHelp className="h-[18px] w-[18px]" />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Demo walkthrough"
        description="The complete procurement journey, end to end. All supplier communication is simulated."
        icon={<CircleHelp className="h-5 w-5" />}
        footer={
          <Button
            onClick={() => {
              setOpen(false)
              navigate('/app')
            }}
          >
            Start from Overview
          </Button>
        }
      >
        <ol className="space-y-3">
          {demoSteps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-ink">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lavender text-xs font-semibold text-primary">{i + 1}</span>
              <span className="pt-0.5 leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      </Modal>
    </>
  )
}

export function AppHeader({ onMenu }: { onMenu: () => void }) {
  const user = useAppStore((s) => s.user)
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <button onClick={onMenu} className="-ml-1 rounded-[10px] p-2 text-[#4d5470] hover:bg-subtle lg:hidden" aria-label="Open menu">
        <MenuIcon className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>
      <div className="hidden w-[300px] md:block lg:w-[400px]">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-1">
        <Notifications />
        <HelpGuide />
        <button onClick={() => navigate('/app/settings')} className="ml-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#3154DF] to-[#9B5CFF] text-[12px] font-semibold text-white ring-2 ring-white transition hover:ring-lavender" aria-label="Account settings" title={`${user.name} · ${user.role}`}>
          {user.initials}
        </button>
      </div>
    </header>
  )
}
