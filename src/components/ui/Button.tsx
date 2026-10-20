import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/format'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success' | 'dark'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white shadow-[0_6px_16px_-6px_rgba(49,84,223,0.6)] hover:bg-primary-hover',
  secondary: 'bg-lavender text-primary hover:bg-[#dde3ff]',
  outline: 'border border-line bg-white text-ink hover:border-[#cfd5e6] hover:bg-subtle',
  ghost: 'text-muted hover:bg-subtle hover:text-ink',
  danger: 'bg-critical text-white hover:bg-[#cf4850]',
  success: 'bg-success text-white hover:bg-[#1c8a5b]',
  dark: 'bg-ink text-white hover:bg-[#23274a]',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-xl',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={cn(
      'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all duration-150 select-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
      variants[variant],
      sizes[size],
      className,
    )}
    {...props}
  >
    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    {children}
  </button>
))
Button.displayName = 'Button'
