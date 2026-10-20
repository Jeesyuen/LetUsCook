import { cn } from '@/utils/format'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8', className)} aria-hidden>
      <defs>
        <linearGradient id="lm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4169FF" />
          <stop offset="1" stopColor="#9B5CFF" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#lm-g)" />
      <path d="M9 20.5c2.5 2 5.5 2.4 8 1.2 3.4-1.6 3.2-5.2-.4-6.2l-2.6-.7c-3.3-.9-3.4-4.4-.2-5.8 2.3-1 5-.6 7.2 1" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight text-ink">
        SupplyWise <span className="text-primary">AI</span>
      </span>
    </span>
  )
}
