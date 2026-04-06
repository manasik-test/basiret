import { useTranslation } from 'react-i18next'
import { useSentiment } from '../../hooks/useAnalytics'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

const COLORS = {
  positive: '#664FA1',
  neutral: '#A5DDEC',
  negative: '#BF499B',
}

export default function SentimentDonut() {
  const { t } = useTranslation()
  const { data: sentiment, isLoading } = useSentiment()

  const chartData = sentiment
    ? [
        { name: t('dashboard.positive'), value: sentiment.positive, key: 'positive' },
        { name: t('dashboard.neutral'), value: sentiment.neutral, key: 'neutral' },
        { name: t('dashboard.negative'), value: sentiment.negative, key: 'negative' },
      ].filter((d) => d.value > 0)
    : []

  return (
    <div className="glass rounded-2xl p-6">
      <h2 dir="auto" className="text-lg font-semibold text-foreground mb-4">
        {t('dashboard.sentimentBreakdown')}
      </h2>
      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          {t('dashboard.loading')}
        </div>
      ) : (
        <div dir="ltr">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={100}
              paddingAngle={4}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={COLORS[entry.key as keyof typeof COLORS]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(102,79,161,0.15)',
                borderRadius: '0.75rem',
              }}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              formatter={(value) => (
                <span className="text-sm text-foreground/80">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
