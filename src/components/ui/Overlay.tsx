import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './Button'
import { Label, Textarea } from './primitives'
import { cn } from '@/utils/format'

let activeOverlaysCount = 0

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    activeOverlaysCount++
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', h)
      activeOverlaysCount = Math.max(0, activeOverlaysCount - 1)
      if (activeOverlaysCount === 0) {
        document.body.style.overflow = ''
      }
    }
  }, [open, onClose])
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  icon,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: ReactNode
}) {
  useEscape(open, onClose)
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#11142d]/35 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn('relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-pop sm:rounded-3xl', widths[size])}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.12 }}
          >
            <div className="flex items-start gap-3 border-b border-line px-6 py-5">
              {icon && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lavender text-primary">{icon}</div>}
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-ink">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
              </div>
              <button onClick={onClose} className="-mt-1 -mr-2 rounded-lg p-2 text-muted transition hover:bg-subtle hover:text-ink" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5 scrollbar-thin">{children}</div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-[#fbfbfe] px-6 py-4">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function Drawer({ open, onClose, children, width = 'max-w-2xl' }: { open: boolean; onClose: () => void; children: ReactNode; width?: string }) {
  useEscape(open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#11142d]/30 backdrop-blur-[2px]" onClick={onClose} />
          <motion.aside
            className={cn('absolute top-0 right-0 flex h-full w-full flex-col bg-page shadow-pop', width)}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', duration: 0.45, bounce: 0.08 }}
          >
            {children}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'primary',
  children,
  reasonLabel,
  reasonRequired,
  icon,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void | Promise<void>
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  tone?: 'primary' | 'danger' | 'success'
  children?: ReactNode
  reasonLabel?: string
  reasonRequired?: boolean
  icon?: ReactNode
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => void (mounted.current = false)
  }, [])
  useEffect(() => {
    if (open) setReason('')
  }, [open])

  const go = async () => {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 450))
    await onConfirm(reason.trim())
    if (mounted.current) setBusy(false)
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      description={description}
      icon={icon ?? (tone === 'danger' ? <AlertTriangle className="h-5 w-5" /> : undefined)}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone} onClick={go} loading={busy} disabled={reasonRequired && !reason.trim()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {reasonLabel && (
        <div className={children ? 'mt-4' : ''}>
          <Label hint={reasonRequired ? 'Required' : 'Optional'}>{reasonLabel}</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add a short note for the audit trail…" autoFocus />
        </div>
      )}
      {!children && !reasonLabel && <p className="text-sm text-muted">This action will be recorded in the activity log.</p>}
    </Modal>
  )
}
