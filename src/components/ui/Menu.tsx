import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/utils/format'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
}

export function Menu({ trigger, items, align = 'right', side = 'bottom', className }: { trigger: (open: boolean) => ReactNode; items: MenuItem[]; align?: 'left' | 'right'; side?: 'top' | 'bottom'; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => {
      document.removeEventListener('mousedown', h)
      document.removeEventListener('keydown', k)
    }
  }, [open])
  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      <div
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        {trigger(open)}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className={cn('absolute z-40 min-w-[200px] rounded-xl border border-line bg-white p-1.5 shadow-lift', align === 'right' ? 'right-0' : 'left-0', side === 'top' ? 'bottom-full mb-1.5' : 'mt-1.5')}
          >
            {items.map((it) => (
              <button
                key={it.label}
                disabled={it.disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  it.onClick()
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition disabled:opacity-40',
                  it.tone === 'danger' ? 'text-[#c23f48] hover:bg-critical-soft' : 'text-ink hover:bg-subtle',
                )}
              >
                {it.icon && <span className="text-muted [&>svg]:h-4 [&>svg]:w-4">{it.icon}</span>}
                {it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
