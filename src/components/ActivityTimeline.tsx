import { Link } from 'react-router-dom'
import {
  BellRing,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  FilePlus2,
  GitCompareArrows,
  Lightbulb,
  PackageCheck,
  Pencil,
  RefreshCw,
  Send,
  Settings2,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import type { ActivityLog, ActivityType } from '@/types'
import { formatTime, relativeTime } from '@/utils/date'
import { cn } from '@/utils/format'

export const activityMeta: Record<ActivityType, { icon: LucideIcon; label: string }> = {
  risk_detected: { icon: TriangleAlert, label: 'Risk detected' },
  recommendation_created: { icon: Lightbulb, label: 'Recommendation' },
  quotations_compared: { icon: GitCompareArrows, label: 'Comparison' },
  approval_requested: { icon: BellRing, label: 'Approval requested' },
  approval_approved: { icon: ClipboardCheck, label: 'Approved' },
  approval_rejected: { icon: CircleX, label: 'Rejected' },
  approval_modified: { icon: Pencil, label: 'Modified' },
  po_generated: { icon: FilePlus2, label: 'PO generated' },
  po_sent: { icon: Send, label: 'PO sent' },
  supplier_confirmed: { icon: CircleCheck, label: 'Supplier confirmed' },
  supplier_changes: { icon: RefreshCw, label: 'Changes requested' },
  supplier_declined: { icon: CircleX, label: 'Supplier declined' },
  goods_received: { icon: Truck, label: 'Goods received' },
  inventory_updated: { icon: PackageCheck, label: 'Inventory updated' },
  stock_adjusted: { icon: Pencil, label: 'Stock adjusted' },
  settings_updated: { icon: Settings2, label: 'Settings' },
  recommendation_dismissed: { icon: CircleX, label: 'Dismissed' },
}

const toneStyles = {
  info: 'bg-lavender text-primary',
  success: 'bg-success-soft text-[#17794f]',
  warning: 'bg-warning-soft text-warning-ink',
  critical: 'bg-critical-soft text-[#c23f48]',
}

export function activityLink(a: ActivityLog): string | undefined {
  if (a.poId) return `/app/purchase-orders?po=${a.poId}`
  if (a.approvalId) return '/app/approvals'
  if (a.productId) return `/app/inventory/${a.productId}`
  return undefined
}

export function ActivityTimeline({ items, compact = false }: { items: ActivityLog[]; compact?: boolean }) {
  return (
    <ol className="relative">
      {items.map((a, i) => {
        const meta = activityMeta[a.type]
        const Icon = meta.icon
        const link = activityLink(a)
        const last = i === items.length - 1
        return (
          <li key={a.id} className="relative flex gap-3.5 pb-5 last:pb-0">
            {!last && <span className="absolute top-9 bottom-1 left-[15px] w-px bg-line" aria-hidden />}
            <span className={cn('relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white', toneStyles[a.tone])}>
              <Icon className="h-[15px] w-[15px]" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-[13.5px] font-semibold text-ink">{a.title}</span>
                <span className="text-[12px] whitespace-nowrap text-muted tabular">{compact ? relativeTime(a.date) : formatTime(a.date)}</span>
              </div>
              <p className={cn('mt-0.5 text-[13px] leading-relaxed text-muted', compact && 'line-clamp-2')}>{a.detail}</p>
              {!compact && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#9aa1b5]">
                  <span>by {a.user}</span>
                  {link && (
                    <Link to={link} className="font-medium text-primary hover:underline">
                      View related →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
