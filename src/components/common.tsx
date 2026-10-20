import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Candy, CircleAlert, CircleCheck, CircleX, Coffee, CupSoda, Droplets, Leaf, LeafyGreen, Milk, TriangleAlert, Wheat, type LucideIcon } from 'lucide-react'
import type { ApprovalStatus, POStatus, Product, ProductIcon, RiskLevel, Supplier } from '@/types'
import type { StockStatus } from '@/services/forecasting'
import { Badge, Card } from './ui/primitives'
import { cn } from '@/utils/format'

const productIcons: Record<ProductIcon, { icon: LucideIcon; bg: string; fg: string }> = {
  coffee: { icon: Coffee, bg: 'from-[#f3ebe4] to-[#e8dbcf]', fg: 'text-[#7a4a2a]' },
  milk: { icon: Milk, bg: 'from-[#eef3ff] to-[#dfe7ff]', fg: 'text-primary' },
  sugar: { icon: Candy, bg: 'from-[#fbf1e3] to-[#f3e1c6]', fg: 'text-[#a8671c]' },
  cup: { icon: CupSoda, bg: 'from-[#f1f2f7] to-[#e4e7f1]', fg: 'text-[#4b5270]' },
  matcha: { icon: Leaf, bg: 'from-[#ecf7ec] to-[#d8eed8]', fg: 'text-[#3a8a43]' },
  syrup: { icon: Droplets, bg: 'from-[#f6ece8] to-[#ecd8d0]', fg: 'text-[#6b3a2a]' },
  oat: { icon: Wheat, bg: 'from-[#fbf6e8] to-[#f1e7c9]', fg: 'text-[#9a7a1f]' },
  tea: { icon: LeafyGreen, bg: 'from-[#eef6f0] to-[#dbece0]', fg: 'text-[#2e6b4a]' },
}

export function ProductThumb({ product, size = 'md' }: { product: Pick<Product, 'icon' | 'name'>; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const cfg = productIcons[product.icon]
  const Icon = cfg.icon
  const sizes = { sm: 'h-8 w-8 rounded-lg [&>svg]:h-4 [&>svg]:w-4', md: 'h-10 w-10 rounded-xl [&>svg]:h-5 [&>svg]:w-5', lg: 'h-14 w-14 rounded-2xl [&>svg]:h-7 [&>svg]:w-7', xl: 'h-28 w-28 rounded-3xl [&>svg]:h-12 [&>svg]:w-12' }
  return (
    <div className={cn('flex shrink-0 items-center justify-center border border-white bg-gradient-to-br shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]', cfg.bg, cfg.fg, sizes[size])} aria-hidden>
      <Icon strokeWidth={1.8} />
    </div>
  )
}

export function SupplierLogo({ supplier, size = 'md' }: { supplier: Pick<Supplier, 'initials' | 'brandColor'>; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-8 w-8 text-[11px] rounded-lg', md: 'h-11 w-11 text-sm rounded-xl', lg: 'h-16 w-16 text-xl rounded-2xl' }
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center font-bold tracking-tight text-white', sizes[size])}
      style={{ background: `linear-gradient(135deg, ${supplier.brandColor}, ${supplier.brandColor}cc)`, boxShadow: `0 6px 14px -6px ${supplier.brandColor}90` }}
      aria-hidden
    >
      {supplier.initials}
    </div>
  )
}

const stockTone: Record<StockStatus, { tone: 'success' | 'warning' | 'critical' | 'dark'; icon: LucideIcon }> = {
  Healthy: { tone: 'success', icon: CircleCheck },
  'Reorder Soon': { tone: 'warning', icon: TriangleAlert },
  Critical: { tone: 'critical', icon: CircleAlert },
  'Out of Stock': { tone: 'dark', icon: CircleX },
}

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const { tone, icon: Icon } = stockTone[status]
  return (
    <Badge tone={tone}>
      <Icon className="h-3.5 w-3.5" />
      {status}
    </Badge>
  )
}

export const stockBarTone = (s: StockStatus) => (s === 'Healthy' ? 'success' : s === 'Reorder Soon' ? 'warning' : 'critical') as 'success' | 'warning' | 'critical'

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const tone = risk === 'High' ? 'critical' : risk === 'Medium' ? 'warning' : 'success'
  return (
    <Badge tone={tone} dot>
      {risk} Risk
    </Badge>
  )
}

const poTones: Record<POStatus, 'neutral' | 'primary' | 'violet' | 'success' | 'warning' | 'critical'> = {
  Draft: 'neutral',
  Approved: 'primary',
  Sent: 'violet',
  'Awaiting Confirmation': 'violet',
  Confirmed: 'success',
  'Changes Requested': 'warning',
  Delivered: 'success',
  Cancelled: 'critical',
}

export function POStatusBadge({ status }: { status: POStatus }) {
  return (
    <Badge tone={poTones[status]} dot>
      {status}
    </Badge>
  )
}

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  return (
    <Badge tone={status === 'Approved' ? 'success' : status === 'Rejected' ? 'critical' : 'warning'} dot>
      {status}
    </Badge>
  )
}

/** Circular compatibility score. Score is decision support, not a probability. */
export function CompatibilityScore({ score, size = 64, highlight = false, label = true }: { score: number; size?: number; highlight?: boolean; label?: boolean }) {
  const stroke = size > 56 ? 6 : 4.5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const id = `cs-${size}-${highlight ? 'h' : 'n'}`
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`Compatibility score ${score}% (weighted decision-support score)`}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={highlight ? '#4169FF' : '#8f9bc4'} />
            <stop offset="100%" stopColor={highlight ? '#9B5CFF' : '#b9c1dc'} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f7" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-semibold text-ink tabular', size >= 64 ? 'text-base' : 'text-xs')}>
            {Math.round(score)}
            <span className="text-[0.7em] text-muted">%</span>
          </span>
        </div>
      )}
    </div>
  )
}

export function StatCard({ label, value, icon, hint, accent = false, onClick }: { label: string; value: ReactNode; icon: ReactNode; hint?: ReactNode; accent?: boolean; onClick?: () => void }) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden p-5 transition-all duration-200',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lift',
        accent && 'border-transparent bg-gradient-to-br from-[#3154DF] to-[#5b4ff0] text-white',
      )}
    >
      {accent && <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-violet/50 blur-2xl" />}
      <div className="relative flex items-start justify-between gap-3">
        <span className={cn('text-[13px] font-medium', accent ? 'text-white/80' : 'text-muted')}>{label}</span>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl [&>svg]:h-[18px] [&>svg]:w-[18px]', accent ? 'bg-white/15 text-white' : 'bg-lavender text-primary')}>{icon}</span>
      </div>
      <div className={cn('relative mt-3 text-[28px] leading-none font-semibold tracking-tight tabular', accent ? 'text-white' : 'text-ink')}>{value}</div>
      {hint && <div className={cn('relative mt-2 text-[12.5px]', accent ? 'text-white/75' : 'text-muted')}>{hint}</div>}
    </Card>
  )
}
