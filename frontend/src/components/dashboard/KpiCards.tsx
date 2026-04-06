import { useTranslation } from 'react-i18next'
import { useOverview, useSegments, useSentiment } from '../../hooks/useAnalytics'
import { Eye, TrendingUp, SmilePlus, Users } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string
  icon: React.ReactNode
  color: string
}

function KpiCard({ title, value, icon, color }: KpiCardProps) {
  return (
    <div className="glass rounded-2xl p-5 flex items-center gap-4 hover:shadow-lg transition-shadow">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground truncate">{title}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  )
}

export default function KpiCards() {
  const { t } = useTranslation()
  const overview = useOverview()
  const sentiment = useSentiment()
  const segments = useSegments()

  const totalReach = overview.data
    ? (overview.data.total_likes + overview.data.total_comments).toLocaleString()
    : '—'

  const engagementRate = overview.data
    ? `${overview.data.avg_engagement_per_post.toFixed(1)}`
    : '—'

  const sentimentScore = sentiment.data
    ? `${(sentiment.data.avg_score * 100).toFixed(0)}%`
    : '—'

  const activeSegments = segments.data
    ? String(segments.data.segment_count)
    : '—'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title={t('dashboard.totalReach')}
        value={totalReach}
        icon={<Eye className="w-6 h-6" />}
        color="#664FA1"
      />
      <KpiCard
        title={t('dashboard.avgEngagement')}
        value={engagementRate}
        icon={<TrendingUp className="w-6 h-6" />}
        color="#A5DDEC"
      />
      <KpiCard
        title={t('dashboard.sentimentScore')}
        value={sentimentScore}
        icon={<SmilePlus className="w-6 h-6" />}
        color="#BF499B"
      />
      <KpiCard
        title={t('dashboard.activeSegments')}
        value={activeSegments}
        icon={<Users className="w-6 h-6" />}
        color="#664FA1"
      />
    </div>
  )
}
