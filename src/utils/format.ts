import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const rm = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const rm0 = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 })

/** RM1,234.50 */
export const formatRM = (n: number) => rm.format(n).replace(/^MYR\s?/, 'RM').replace(/ /g, '')
/** RM1,235 */
export const formatRM0 = (n: number) => rm0.format(n).replace(/^MYR\s?/, 'RM').replace(/ /g, '')

export function formatQty(n: number, unit?: string): string {
  const v = Number.isInteger(n) ? n.toLocaleString('en-MY') : n.toLocaleString('en-MY', { maximumFractionDigits: 1 })
  return unit ? `${v} ${unit}` : v
}

export function round(n: number, dp = 1): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

let counter = 0
export function uid(prefix: string): string {
  counter = (counter + 1) % 1000
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}`
}
