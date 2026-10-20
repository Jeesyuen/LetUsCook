import { useMemo, useState } from 'react'
import { History, Search } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import type { ActivityType } from '@/types'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { Card, EmptyState, Input, PageHeader, Select } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { formatWeekday, startOfToday } from '@/utils/date'

const groups: Record<string, { label: string; types: ActivityType[] }> = {
  all: { label: 'All events', types: [] },
  inventory: { label: 'Inventory & forecasts', types: ['risk_detected', 'stock_adjusted', 'inventory_updated', 'goods_received', 'settings_updated'] },
  recommendations: { label: 'Recommendations & comparisons', types: ['recommendation_created', 'recommendation_dismissed', 'quotations_compared'] },
  approvals: { label: 'Approvals', types: ['approval_requested', 'approval_approved', 'approval_rejected', 'approval_modified'] },
  orders: { label: 'Purchase orders', types: ['po_generated', 'po_sent', 'goods_received'] },
  suppliers: { label: 'Supplier responses', types: ['supplier_confirmed', 'supplier_changes', 'supplier_declined'] },
}

export default function Activity() {
  const activity = useAppStore((s) => s.activity)
  const [group, setGroup] = useState('all')
  const [range, setRange] = useState('all')
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    const today = startOfToday().getTime()
    const since = range === 'today' ? today : range === '7d' ? today - 6 * 86_400_000 : range === '30d' ? today - 29 * 86_400_000 : 0
    return activity
      .filter((a) => (group === 'all' || groups[group].types.includes(a.type)) && new Date(a.date).getTime() >= since && (!t || a.title.toLowerCase().includes(t) || a.detail.toLowerCase().includes(t) || a.user.toLowerCase().includes(t)))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [activity, group, range, q])

  const byDay = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    filtered.forEach((a) => {
      const d = new Date(a.date)
      d.setHours(0, 0, 0, 0)
      const k = d.toISOString()
      map.set(k, [...(map.get(k) ?? []), a])
    })
    return [...map.entries()]
  }, [filtered])

  const dayLabel = (iso: string) => {
    const diff = Math.round((startOfToday().getTime() - new Date(iso).getTime()) / 86_400_000)
    return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : formatWeekday(iso)
  }

  return (
    <div>
      <PageHeader title="Activity Log" subtitle="A complete audit trail of inventory and procurement decisions." />
      <div className="mb-5 flex flex-wrap gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events, products, POs or people" className="pl-10" />
        </div>
        <Select value={group} onChange={(e) => setGroup(e.target.value)} className="w-full sm:w-[240px]" aria-label="Event type">
          {Object.entries(groups).map(([k, g]) => (
            <option key={k} value={k}>
              {g.label}
            </option>
          ))}
        </Select>
        <Select value={range} onChange={(e) => setRange(e.target.value)} className="w-full sm:w-[160px]" aria-label="Date range">
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </Select>
      </div>

      {byDay.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History className="h-7 w-7" />}
            title="No matching activity"
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setGroup('all')
                  setRange('all')
                  setQ('')
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {byDay.map(([day, items]) => (
            <div key={day} className="grid gap-3 lg:grid-cols-[160px_1fr]">
              <div className="pt-5 lg:sticky lg:top-20 lg:self-start">
                <div className="text-[15px] font-semibold text-ink">{dayLabel(day)}</div>
                <div className="text-[12.5px] text-muted">
                  {items.length} event{items.length > 1 ? 's' : ''}
                </div>
              </div>
              <Card className="p-5 sm:p-6">
                <ActivityTimeline items={items} />
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
