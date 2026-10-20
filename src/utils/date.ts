const DAY = 86_400_000

export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY)
}

/** ISO timestamp `days` from now (negative for the past), at a given hour/minute. */
export function isoAt(days: number, hour = 9, minute = 0): string {
  const d = addDays(startOfToday(), days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/** ISO timestamp a number of minutes before now — keeps seeded "today" events in the past. */
export function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString()
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY)
}

const dateFmt = new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
const shortFmt = new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat('en-MY', { hour: 'numeric', minute: '2-digit' })
const weekdayFmt = new Intl.DateTimeFormat('en-MY', { weekday: 'short', day: 'numeric', month: 'short' })

export const formatDate = (d: Date | string) => dateFmt.format(new Date(d))
export const formatShortDate = (d: Date | string) => shortFmt.format(new Date(d))
export const formatTime = (d: Date | string) => timeFmt.format(new Date(d))
export const formatWeekday = (d: Date | string) => weekdayFmt.format(new Date(d))
export const formatDateTime = (d: Date | string) => `${formatDate(d)}, ${formatTime(d)}`

export function relativeTime(d: Date | string): string {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return formatDate(d)
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
