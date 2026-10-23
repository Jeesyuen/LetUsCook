import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Forecast, HistorySource } from '@/services/forecasting'
import type { Product } from '@/types'
import { addDays, formatShortDate, startOfToday } from '@/utils/date'
import { formatQty } from '@/utils/format'

interface UsagePoint {
  label: string
  historical?: number
  forecast?: number
}

const HISTORY_SERIES_LABEL: Record<HistorySource, string> = {
  simulated: 'Simulated usage history',
  recorded: 'Recorded usage history',
  baseline: 'Entered baseline',
  unverified: 'Unverified usage history',
}

export function UsageForecastChart({ product, forecast }: { product: Product; forecast: Forecast }) {
  const history = Array.isArray(product.usageHistory)
    ? product.usageHistory.map((value, index) => ({ value, index })).filter(({ value }) => Number.isFinite(value) && value >= 0)
    : []
  if (history.length === 0 && forecast.forecastDailyUsage <= 0) {
    return <p className="px-5 pb-5 text-[13px] text-muted">There is no usable usage history or forecast demand to chart.</p>
  }

  const today = startOfToday()
  const points: UsagePoint[] = history.map(({ value, index }) => {
    const dayOffset = index - product.usageHistory.length
    return { label: formatShortDate(addDays(today, dayOffset)), historical: value }
  })
  for (let day = 0; day <= 7; day++) {
    points.push({
      label: day === 0 ? 'Today' : formatShortDate(addDays(today, day)),
      forecast: forecast.forecastDailyUsage,
    })
  }

  const maxUsage = Math.max(1, ...points.map((point) => Math.max(point.historical ?? 0, point.forecast ?? 0)))
  return (
    <div className="px-3 pb-4 sm:px-4">
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} tickMargin={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              domain={[0, Math.ceil(maxUsage * 1.15)]}
              tickFormatter={(value: number) => String(value)}
            />
            <Tooltip formatter={(value, name) => [formatQty(Number(value), product.unit), String(name)]} />
            <ReferenceLine x="Today" stroke="#11142d" strokeOpacity={0.3} strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="historical"
              name={HISTORY_SERIES_LABEL[forecast.historySource]}
              stroke="#3154DF"
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="forecast"
              name="Forecast daily usage"
              stroke="#9B5CFF"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="px-2 text-[11.5px] text-muted">
        Forecast line uses {formatQty(forecast.forecastDailyUsage, product.unit)}/day based on the available history and recent-demand blend.
      </p>
    </div>
  )
}
