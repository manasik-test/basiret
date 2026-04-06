import { useTranslation } from 'react-i18next'
import { useOverview } from '../../hooks/useAnalytics'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// Generate mock trend data from overview totals to show the chart shape.
// In a future sprint this will come from a dedicated time-series endpoint.
function generateTrendData(totalLikes: number, totalComments: number) {
  const days = 14
  const data = []
  for (let i = days; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const jitter = 0.6 + Math.random() * 0.8
    data.push({
      date: date.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      likes: Math.round((totalLikes / days) * jitter),
      comments: Math.round((totalComments / days) * jitter),
    })
  }
  return data
}

export default function EngagementChart() {
  const { t } = useTranslation()
  const { data: overview, isLoading } = useOverview()

  const trendData = overview
    ? generateTrendData(overview.total_likes, overview.total_comments)
    : []

  return (
    <div className="glass rounded-2xl p-6">
      <h2 dir="auto" className="text-lg font-semibold text-foreground mb-4">
        {t('dashboard.engagementTrend')}
      </h2>
      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          {t('dashboard.loading')}
        </div>
      ) : (
        <div dir="ltr">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="likesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#664FA1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#664FA1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="commentsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#A5DDEC" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#A5DDEC" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(102,79,161,0.1)" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
            <Tooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(102,79,161,0.15)',
                borderRadius: '0.75rem',
              }}
            />
            <Area
              type="monotone"
              dataKey="likes"
              name={t('dashboard.likes')}
              stroke="#664FA1"
              strokeWidth={2}
              fill="url(#likesGrad)"
            />
            <Area
              type="monotone"
              dataKey="comments"
              name={t('dashboard.comments')}
              stroke="#A5DDEC"
              strokeWidth={2}
              fill="url(#commentsGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
