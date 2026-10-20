import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts'
import type { ForecastPoint } from '@/services/forecasting'
import { formatQty } from '@/utils/format'

export const CHART = {
  historical: '#3154DF',
  projected: '#9B5CFF',
  restock: '#151DA4',
  safety: '#E5A23B',
}

interface Props {
  points: ForecastPoint[]
  unit: string
  safety: number
  replenishDay?: number
  replenishQty?: number
  replenishFromPO?: boolean
  height?: number
  showRestock?: boolean
}

function ChartTooltip({ active, payload, unit }: TooltipProps<number, string> & { unit: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as ForecastPoint
  const rows = [
    { key: 'historical', label: p.day <= 0 ? 'Stock level' : '', color: CHART.historical, value: p.historical },
    { key: 'projected', label: 'Projected (no order)', color: CHART.projected, value: p.day > 0 ? p.projected : undefined },
    { key: 'withRestock', label: 'With replenishment', color: CHART.restock, value: p.day > 0 ? p.withRestock : undefined },
  ].filter((r) => r.value !== undefined && r.label)
  return (
    <div className="min-w-[190px] rounded-xl border border-line bg-white px-3.5 py-3 shadow-lift">
      <div className="mb-2 text-xs font-semibold text-ink">
        {p.label}
        {p.day > 0 && <span className="ml-1.5 font-normal text-muted">· forecast</span>}
      </div>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-4 py-0.5 text-[12.5px]">
          <span className="flex items-center gap-2 text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
            {r.label}
          </span>
          <span className="font-semibold text-ink tabular">{formatQty(r.value!, unit)}</span>
        </div>
      ))}
      <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-line pt-1.5 text-[12px]">
        <span className="text-muted">Safety stock</span>
        <span className="font-medium text-ink tabular">{formatQty(p.safety, unit)}</span>
      </div>
    </div>
  )
}

export function ChartLegend({ showRestock = true, replenishLabel }: { showRestock?: boolean; replenishLabel?: string }) {
  const items = [
    { label: 'Historical stock', swatch: <span className="h-[3px] w-5 rounded-full" style={{ background: CHART.historical }} /> },
    { label: 'Projected (no order)', swatch: <span className="w-5 border-t-2 border-dashed" style={{ borderColor: CHART.projected }} /> },
    ...(showRestock ? [{ label: replenishLabel ?? 'With replenishment', swatch: <span className="w-5 border-t-2 border-dotted" style={{ borderColor: CHART.restock }} /> }] : []),
    { label: 'Safety stock', swatch: <span className="w-5 border-t-2 border-dashed" style={{ borderColor: CHART.safety }} /> },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-2 text-[12.5px] text-muted">
          {it.swatch}
          {it.label}
        </span>
      ))}
    </div>
  )
}

export function ForecastChart({ points, unit, safety, replenishDay, replenishQty, replenishFromPO, height = 300, showRestock = true }: Props) {
  const replenishPoint = replenishDay !== undefined ? points.find((p) => p.day === replenishDay) : undefined
  const maxY = Math.max(...points.map((p) => Math.max(p.historical ?? 0, p.projected ?? 0, showRestock ? p.withRestock ?? 0 : 0, p.safety)))
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 16, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="hist-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.historical} stopOpacity={0.16} />
              <stop offset="100%" stopColor={CHART.historical} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="proj-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.projected} stopOpacity={0.1} />
              <stop offset="100%" stopColor={CHART.projected} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} tickMargin={10} />
          <YAxis tickLine={false} axisLine={false} width={52} domain={[0, Math.ceil(maxY * 1.12)]} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: '#c9cfe2', strokeWidth: 1 }} />
          <ReferenceLine x="Today" stroke="#11142d" strokeOpacity={0.22} strokeDasharray="3 3" label={{ value: 'Today', position: 'top', fill: '#737B92', fontSize: 11 }} />
          <ReferenceLine y={safety} stroke={CHART.safety} strokeDasharray="5 4" strokeWidth={1.5} />
          <Area type="monotone" dataKey="historical" stroke={CHART.historical} strokeWidth={2} fill="url(#hist-fill)" connectNulls={false} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} isAnimationActive animationDuration={700} />
          <Area type="linear" dataKey="projected" stroke={CHART.projected} strokeWidth={2} strokeDasharray="6 5" fill="url(#proj-fill)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} isAnimationActive animationDuration={700} />
          {showRestock && <Line type="linear" dataKey="withRestock" stroke={CHART.restock} strokeWidth={2} strokeDasharray="2 4" strokeLinecap="round" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} isAnimationActive animationDuration={700} />}
          {showRestock && replenishPoint && (
            <ReferenceDot
              x={replenishPoint.label}
              y={replenishPoint.withRestock}
              r={6}
              fill={CHART.restock}
              stroke="#fff"
              strokeWidth={2}
              label={{ value: `${replenishFromPO ? 'PO arrives' : 'Restock'} +${formatQty(replenishQty ?? 0)}`, position: 'top', fill: '#11142d', fontSize: 11, fontWeight: 600 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
