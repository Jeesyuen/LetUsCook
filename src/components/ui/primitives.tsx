import { forwardRef, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/format'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[18px] border border-line bg-card shadow-card', className)} {...props} />
}

export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6', className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

type BadgeTone = 'neutral' | 'primary' | 'violet' | 'success' | 'warning' | 'critical' | 'dark'
const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-subtle text-muted border-line',
  primary: 'bg-lavender text-primary border-[#d6ddff]',
  violet: 'bg-[#f3ecff] text-[#7a3fe0] border-[#e6d8ff]',
  success: 'bg-success-soft text-[#17794f] border-[#cdebdc]',
  warning: 'bg-warning-soft text-warning-ink border-[#f6e1b9]',
  critical: 'bg-critical-soft text-[#c23f48] border-[#f8d3d6]',
  dark: 'bg-ink text-white border-ink',
}

export function Badge({ tone = 'neutral', dot, className, children }: { tone?: BadgeTone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', badgeTones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink">
      <span>{children}</span>
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  )
}

const fieldBase =
  'w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink placeholder:text-[#a3a9bb] transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10 focus:outline-none disabled:bg-subtle disabled:text-muted'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, 'h-10', className)} {...props} />
))
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'min-h-[84px] resize-none py-2.5', className)} {...props} />
))
Textarea.displayName = 'Textarea'

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('relative', className)}>
      <select className={cn(fieldBase, 'h-10 cursor-pointer appearance-none pr-9')} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  )
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      {(label || description) && (
        <span>
          {label && <span className="block text-sm font-medium text-ink">{label}</span>}
          {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-[#d8dcea]')}
      >
        <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </button>
    </label>
  )
}

export function ProgressBar({ value, tone = 'primary', className }: { value: number; tone?: 'primary' | 'success' | 'warning' | 'critical' | 'violet'; className?: string }) {
  const colors = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', critical: 'bg-critical', violet: 'bg-violet' }
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-[#eef0f7]', className)}>
      <motion.div
        className={cn('h-full rounded-full', colors[tone])}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  )
}

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  count?: number
}

export function SegmentedTabs<T extends string>({ items, value, onChange, className, size = 'md' }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div className={cn('inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-subtle p-1 scrollbar-thin', className)} role="tablist">
      {items.map((it) => {
        const active = it.value === value
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              'relative flex items-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-[13px]',
              active ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {active && <motion.span layoutId={`seg-${items.map((i) => i.value).join('')}`} className="absolute inset-0 rounded-lg bg-white shadow-[0_1px_3px_rgba(17,20,45,0.1)]" transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }} />}
            <span className="relative">{it.label}</span>
            {it.count !== undefined && <span className={cn('relative rounded-md px-1.5 text-[11px] tabular', active ? 'bg-lavender text-primary' : 'bg-white/70 text-muted')}>{it.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="relative mb-5 h-20 w-20">
        <div className="orb absolute inset-2 rounded-full opacity-80" />
        <div className="absolute inset-0 flex items-center justify-center text-white">{icon}</div>
      </div>
      <h4 className="text-base font-semibold text-ink">{title}</h4>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-ink sm:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Stat({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className="mt-0.5 truncate text-[15px] font-semibold text-ink tabular">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  )
}

export function DemoTag({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border border-dashed border-violet/50 bg-[#f6f0ff] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#7a3fe0]', className)}>
      Demo Simulation
    </span>
  )
}

/** Small hover/focus tooltip for explanations (e.g. how a score is calculated). */
export function InfoTip({ children, className, side = 'top' }: { children: ReactNode; className?: string; side?: 'top' | 'bottom' }) {
  return (
    <span className={cn('group/tip relative inline-flex align-middle', className)}>
      <button type="button" className="flex h-4 w-4 items-center justify-center rounded-full border border-[#c9cfe2] text-[10px] font-semibold text-muted transition group-hover/tip:border-primary group-hover/tip:text-primary focus-visible:outline-none" aria-label="More information">
        i
      </button>
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none invisible absolute left-1/2 z-50 w-64 -translate-x-1/2 rounded-xl bg-ink px-3.5 py-2.5 text-left text-[12px] leading-relaxed font-normal text-white/90 opacity-0 shadow-lift transition duration-150 group-focus-within/tip:visible group-focus-within/tip:opacity-100 group-hover/tip:visible group-hover/tip:opacity-100',
          side === 'top' ? 'bottom-6' : 'top-6',
        )}
      >
        {children}
      </span>
    </span>
  )
}
