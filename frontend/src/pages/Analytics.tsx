import { useTranslation } from 'react-i18next'
import { Video, Clock, ArrowRight, Image, Layers, Film } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { usePostsBreakdown } from '../hooks/useAnalytics'
import TopPostsTable from '../components/dashboard/TopPostsTable'

/* ── Content Type Breakdown Bar Chart ───────────────────── */

const typeLabels: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  carousel: 'Carousel',
  reel: 'Reel',
  story: 'Story',
  text: 'Text',
  unknown: 'Other',
}

const typeIcons: Record<string, React.ReactNode> = {
  image: <Image className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
  carousel: <Layers className="w-4 h-4" />,
  reel: <Film className="w-4 h-4" />,
}

function ContentTypeChart() {
  const { t } = useTranslation()
  const { data } = usePostsBreakdown()

  if (!data || data.by_type.length === 0) return null

  const chartData = data.by_type.map((item) => ({
    name: typeLabels[item.content_type] || item.content_type,
    [t('dashboard.likes')]: item.avg_likes,
    [t('dashboard.comments')]: item.avg_comments,
    count: item.count,
  }))

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-bold text-foreground mb-1">{t('analytics.topPostsByType')}</h2>
      <p className="text-xs text-muted-foreground mb-4">Average engagement per content type</p>
      <div dir="ltr" className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(102,79,161,0.08)" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
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
            <Bar dataKey={t('dashboard.likes')} fill="#664FA1" radius={[4, 4, 0, 0]} />
            <Bar dataKey={t('dashboard.comments')} fill="#A5DDEC" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Post count badges */}
      <div className="flex flex-wrap gap-3 mt-4">
        {data.by_type.map((item) => (
          <div key={item.content_type} className="flex items-center gap-2 glass rounded-lg px-3 py-2">
            <div className="text-primary">
              {typeIcons[item.content_type] || <Image className="w-4 h-4" />}
            </div>
            <span className="text-xs font-medium text-foreground">
              {typeLabels[item.content_type] || item.content_type}
            </span>
            <span className="text-xs text-muted-foreground">({item.count})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Posting Frequency Calendar Heatmap ─────────────────── */

function PostingCalendar() {
  const { data } = usePostsBreakdown()

  if (!data || data.posting_dates.length === 0) return null

  // Build a map of date -> count
  const dateMap = new Map<string, number>()
  for (const d of data.posting_dates) {
    dateMap.set(d.date, d.count)
  }

  // Find date range
  const dates = data.posting_dates.map((d) => new Date(d.date))
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

  // Pad to full weeks
  const startDate = new Date(minDate)
  startDate.setDate(startDate.getDate() - startDate.getDay()) // Start on Sunday
  const endDate = new Date(maxDate)
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay())) // End on Saturday

  // Build week columns
  const weeks: Array<Array<{ date: string; count: number; inRange: boolean }>> = []
  const cursor = new Date(startDate)
  while (cursor <= endDate) {
    const week: Array<{ date: string; count: number; inRange: boolean }> = []
    for (let d = 0; d < 7; d++) {
      const iso = cursor.toISOString().slice(0, 10)
      const inRange = cursor >= minDate && cursor <= maxDate
      week.push({ date: iso, count: dateMap.get(iso) || 0, inRange })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }

  const maxCount = Math.max(...data.posting_dates.map((d) => d.count), 1)
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-bold text-foreground mb-1">Posting Frequency</h2>
      <p className="text-xs text-muted-foreground mb-4">
        {data.posting_dates.length} days with posts
      </p>
      <div dir="ltr" className="overflow-x-auto">
        <div className="flex gap-0.5">
          {/* Day labels column */}
          <div className="flex flex-col gap-0.5 pe-1">
            {dayLabels.map((d, i) => (
              <div key={i} className="h-[14px] text-[9px] text-muted-foreground flex items-center">
                {i % 2 === 1 ? d : ''}
              </div>
            ))}
          </div>
          {/* Week columns */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => {
                const intensity = day.count / maxCount
                return (
                  <div
                    key={di}
                    className="w-[14px] h-[14px] rounded-[2px] transition-colors"
                    title={`${day.date}: ${day.count} post${day.count !== 1 ? 's' : ''}`}
                    style={{
                      backgroundColor: !day.inRange
                        ? 'transparent'
                        : day.count > 0
                          ? `rgba(102, 79, 161, ${0.2 + intensity * 0.7})`
                          : 'rgba(102, 79, 161, 0.06)',
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Month labels */}
        <div className="flex mt-1 ps-5">
          {weeks.map((week, wi) => {
            const firstDay = new Date(week[0].date)
            const showLabel = firstDay.getDate() <= 7
            return (
              <div key={wi} className="w-[14px] me-0.5 text-[9px] text-muted-foreground">
                {showLabel ? firstDay.toLocaleDateString('en-US', { month: 'short' }) : ''}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Insight Card ───────────────────────────────────────── */

function InsightCard({
  icon,
  color,
  title,
  description,
}: {
  icon: React.ReactNode
  color: string
  title: string
  description: string
}) {
  return (
    <div className="glass rounded-2xl p-6 flex gap-4 hover:shadow-lg transition-shadow">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
      <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 self-center" />
    </div>
  )
}

/* ── Analytics Page ─────────────────────────────────────── */

export default function Analytics() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      {/* Content Type Breakdown */}
      <ContentTypeChart />

      {/* Posting Calendar */}
      <PostingCalendar />

      {/* Action Insights */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-3">{t('analytics.actionInsights')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InsightCard
            icon={<Video className="w-6 h-6" />}
            color="#BF499B"
            title={t('analytics.insightReels')}
            description={t('analytics.insightReelsDesc')}
          />
          <InsightCard
            icon={<Clock className="w-6 h-6" />}
            color="#664FA1"
            title={t('analytics.insightTiming')}
            description={t('analytics.insightTimingDesc')}
          />
        </div>
      </div>

      {/* Top Posts */}
      <TopPostsTable />
    </div>
  )
}
