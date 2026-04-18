import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Video, TrendingUp, Copy, Check, ArrowRight } from 'lucide-react'
import { useSegments } from '../hooks/useAnalytics'
import { useIsFeatureLocked } from '../hooks/useBilling'
import LockedFeature from '../components/LockedFeature'

/* ── Recommendation Card ────────────────────────────────── */

function RecCard({
  icon,
  color,
  category,
  title,
  description,
  supportingData,
  confidence,
}: {
  icon: React.ReactNode
  color: string
  category: string
  title: string
  description: string
  supportingData: string
  confidence: 'high' | 'medium'
}) {
  const { t } = useTranslation()
  const confPercent = confidence === 'high' ? 85 : 60

  return (
    <div className="glass rounded-2xl p-6 flex flex-col gap-4 hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}20` }}
        >
          <div style={{ color }}>{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {category}
          </span>
          <h3 className="text-sm font-bold text-foreground mt-2">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
        </div>
      </div>

      <div className="glass rounded-lg px-3 py-2 text-xs text-foreground/70">{supportingData}</div>

      {/* Confidence bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">{t('recommendations.confidence')}</span>
          <span className="font-semibold" style={{ color }}>
            {t(`recommendations.${confidence}`)} ({confPercent}%)
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${confPercent}%`, backgroundColor: color }}
          />
        </div>
      </div>

      <button className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors">
        {t('recommendations.apply')}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

/* ── Best Time Heatmap ──────────────────────────────────── */

function BestTimeHeatmap() {
  const { t } = useTranslation()
  const segments = useSegments()

  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  const times = ['morning', 'afternoon', 'evening', 'night'] as const

  // Build intensity map from segment data
  const heatData: number[][] = days.map(() => times.map(() => 0))

  if (segments.data) {
    for (const seg of segments.data.segments) {
      const tp = seg.characteristics?.typical_posting_time?.toLowerCase() || 'morning'
      const timeIdx = times.indexOf(tp as typeof times[number])
      if (timeIdx >= 0) {
        // Spread across weekdays with some weight
        for (let d = 0; d < 5; d++) heatData[d][timeIdx] += seg.size
      }
    }
  }

  // Fallback mock data if no segments
  const hasSome = heatData.flat().some((v) => v > 0)
  if (!hasSome) {
    heatData[1][0] = 8; heatData[0][0] = 5; heatData[2][1] = 6
    heatData[3][0] = 4; heatData[4][2] = 3; heatData[5][1] = 2
  }

  const maxVal = Math.max(...heatData.flat(), 1)

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-bold text-foreground mb-4">{t('recommendations.bestTime')}</h2>
      <div dir="ltr" className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-xs text-muted-foreground font-medium pb-2 text-start w-16" />
              {times.map((time) => (
                <th key={time} className="text-xs text-muted-foreground font-medium pb-2 text-center">
                  {t(`recommendations.${time}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, di) => (
              <tr key={day}>
                <td className="text-xs text-muted-foreground font-medium py-1 pe-2">
                  {t(`recommendations.${day}`)}
                </td>
                {times.map((_, ti) => {
                  const val = heatData[di][ti]
                  const intensity = val / maxVal
                  return (
                    <td key={ti} className="p-1">
                      <div
                        className="w-full h-8 rounded-md transition-colors"
                        style={{
                          backgroundColor: intensity > 0
                            ? `rgba(102, 79, 161, ${0.1 + intensity * 0.7})`
                            : 'rgba(102, 79, 161, 0.04)',
                        }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Hashtag Suggestions ────────────────────────────────── */

function HashtagCard({ hashtag, reach }: { hashtag: string; reach: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(hashtag)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="glass rounded-xl px-4 py-3 flex items-center justify-between">
      <div>
        <p className="text-sm font-bold text-primary">{hashtag}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{reach}</p>
      </div>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? t('recommendations.copied') : t('recommendations.copyHashtag')}
      </button>
    </div>
  )
}

/* ── Main Content ───────────────────────────────────────── */

function RecommendationsContent() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      {/* Recommendation Cards */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-3">{t('recommendations.contentRecs')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RecCard
            icon={<Clock className="w-5 h-5" />}
            color="#664FA1"
            category={t('recommendations.timing')}
            title={t('recommendations.rec1Title')}
            description={t('recommendations.rec1Desc')}
            supportingData={t('recommendations.rec1Data')}
            confidence="high"
          />
          <RecCard
            icon={<TrendingUp className="w-5 h-5" />}
            color="#BF499B"
            category={t('recommendations.engagement')}
            title={t('recommendations.rec2Title')}
            description={t('recommendations.rec2Desc')}
            supportingData={t('recommendations.rec2Data')}
            confidence="high"
          />
          <RecCard
            icon={<Video className="w-5 h-5" />}
            color="#A5DDEC"
            category={t('recommendations.format')}
            title={t('recommendations.rec3Title')}
            description={t('recommendations.rec3Desc')}
            supportingData={t('recommendations.rec3Data')}
            confidence="medium"
          />
        </div>
      </div>

      {/* Heatmap */}
      <BestTimeHeatmap />

      {/* Hashtag Suggestions */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-3">{t('recommendations.hashtagTitle')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <HashtagCard hashtag={t('recommendations.hashtag1')} reach={t('recommendations.hashtag1Reach')} />
          <HashtagCard hashtag={t('recommendations.hashtag2')} reach={t('recommendations.hashtag2Reach')} />
          <HashtagCard hashtag={t('recommendations.hashtag3')} reach={t('recommendations.hashtag3Reach')} />
        </div>
      </div>
    </div>
  )
}

export default function Recommendations() {
  const { t } = useTranslation()
  const isLocked = useIsFeatureLocked('content_recommendations')

  return (
    <LockedFeature locked={isLocked} featureName={t('nav.contentPlan')}>
      <RecommendationsContent />
    </LockedFeature>
  )
}
