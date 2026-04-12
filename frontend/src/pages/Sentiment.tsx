import { useTranslation } from 'react-i18next'
import { ThumbsUp, Minus, ThumbsDown, Lightbulb } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useSentiment, useSentimentTimeline } from '../hooks/useAnalytics'
import { useIsFeatureLocked } from '../hooks/useBilling'
import LockedFeature from '../components/LockedFeature'
import SentimentDonut from '../components/dashboard/SentimentDonut'

function ScoreCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="glass rounded-2xl p-5 flex items-center gap-4 hover:shadow-lg transition-shadow">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function SentimentTrendChart() {
  const { t } = useTranslation()
  const { data } = useSentimentTimeline()

  if (!data || data.timeline.length === 0) return null

  const chartData = data.timeline.map((entry) => ({
    date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    [t('dashboard.positive')]: entry.positive,
    [t('dashboard.neutral')]: entry.neutral,
    [t('dashboard.negative')]: entry.negative,
  }))

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-bold text-foreground mb-4">{t('sentiment.trendTitle')}</h2>
      <div dir="ltr" className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="gradPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#664FA1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#664FA1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradNeutral" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#A5DDEC" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#A5DDEC" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#BF499B" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#BF499B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(102,79,161,0.08)" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '12px',
                fontSize: '12px',
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey={t('dashboard.positive')}
              stroke="#664FA1"
              fill="url(#gradPositive)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey={t('dashboard.neutral')}
              stroke="#A5DDEC"
              fill="url(#gradNeutral)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey={t('dashboard.negative')}
              stroke="#BF499B"
              fill="url(#gradNegative)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ActionCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="glass rounded-2xl p-5 flex gap-4 hover:shadow-lg transition-shadow">
      <div className="w-10 h-10 rounded-xl bg-cta/10 flex items-center justify-center shrink-0">
        <Lightbulb className="w-5 h-5 text-cta" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

function SentimentContent() {
  const { t } = useTranslation()
  const { data } = useSentiment()

  const total = data ? data.positive + data.neutral + data.negative : 0
  const posPercent = total > 0 ? Math.round((data!.positive / total) * 100) : 0
  const neuPercent = total > 0 ? Math.round((data!.neutral / total) * 100) : 0
  const negPercent = total > 0 ? Math.round((data!.negative / total) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ScoreCard
          label={t('sentiment.positivePercent')}
          value={data ? `${posPercent}%` : '—'}
          icon={<ThumbsUp className="w-6 h-6" />}
          color="#664FA1"
        />
        <ScoreCard
          label={t('sentiment.neutralPercent')}
          value={data ? `${neuPercent}%` : '—'}
          icon={<Minus className="w-6 h-6" />}
          color="#A5DDEC"
        />
        <ScoreCard
          label={t('sentiment.negativePercent')}
          value={data ? `${negPercent}%` : '—'}
          icon={<ThumbsDown className="w-6 h-6" />}
          color="#BF499B"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <SentimentTrendChart />
        </div>
        <div className="lg:col-span-2">
          <SentimentDonut />
        </div>
      </div>

      {/* Conditional Action Cards */}
      {data && total > 0 && (
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">{t('sentiment.actionsTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posPercent > 60 && (
              <ActionCard
                title={t('sentiment.insightGreat')}
                description={t('sentiment.insightGreatDesc')}
              />
            )}
            {neuPercent > 50 && (
              <ActionCard
                title={t('sentiment.insightCta')}
                description={t('sentiment.insightCtaDesc')}
              />
            )}
            {negPercent > 30 && (
              <ActionCard
                title={t('sentiment.insightConcern')}
                description={t('sentiment.insightConcernDesc')}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Sentiment() {
  const { t } = useTranslation()
  const isLocked = useIsFeatureLocked('sentiment_analysis')

  return (
    <LockedFeature locked={isLocked} featureName={t('nav.sentiment')}>
      <SentimentContent />
    </LockedFeature>
  )
}
