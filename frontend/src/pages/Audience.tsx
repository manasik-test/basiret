import { useTranslation } from 'react-i18next'
import { RefreshCw, Image, Video, Layers, Sun, Sunrise, Sunset, ArrowRight } from 'lucide-react'
import { useSegments, useRegenerateSegments } from '../hooks/useAnalytics'
import { useIsFeatureLocked } from '../hooks/useBilling'
import LockedFeature from '../components/LockedFeature'
import type { SegmentCharacteristics } from '../api/analytics'

const contentTypeIcons: Record<string, React.ReactNode> = {
  IMAGE: <Image className="w-4 h-4" />,
  VIDEO: <Video className="w-4 h-4" />,
  CAROUSEL_ALBUM: <Layers className="w-4 h-4" />,
}

const timeIcons: Record<string, React.ReactNode> = {
  Morning: <Sunrise className="w-4 h-4" />,
  Afternoon: <Sun className="w-4 h-4" />,
  Evening: <Sunset className="w-4 h-4" />,
}

const sentimentColors: Record<string, string> = {
  positive: '#664FA1',
  neutral: '#A5DDEC',
  negative: '#BF499B',
}

function SegmentCard({
  label,
  size,
  characteristics,
}: {
  label: string
  size: number
  characteristics?: SegmentCharacteristics
}) {
  const { t } = useTranslation()
  const ct = characteristics?.dominant_content_type || 'IMAGE'
  const time = characteristics?.typical_posting_time || 'Morning'
  const sent = characteristics?.dominant_sentiment || 'neutral'
  const rawEng = Number(characteristics?.avg_engagement)
  const avgEng = !isNaN(rawEng) ? rawEng.toFixed(1) : '—'
  const timeKey = time.toLowerCase() as 'morning' | 'afternoon' | 'evening'

  return (
    <div className="glass rounded-2xl p-6 flex flex-col gap-4 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold text-foreground leading-tight">{label}</h3>
        <span className="shrink-0 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          {size} {t('audience.segmentSize')}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 text-sm text-foreground/80">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {contentTypeIcons[ct] || contentTypeIcons.IMAGE}
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">{t('audience.contentType')}</p>
            <p className="text-xs font-semibold">{t(`analytics.${ct === 'CAROUSEL_ALBUM' ? 'carousel' : ct.toLowerCase()}`)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-foreground/80">
          <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center text-primary">
            {timeIcons[time] || timeIcons.Morning}
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">{t('audience.postingTime')}</p>
            <p className="text-xs font-semibold">{t(`audience.${timeKey}`)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-foreground/80">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${sentimentColors[sent]}20` }}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sentimentColors[sent] }} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">{t('audience.sentiment')}</p>
            <p className="text-xs font-semibold capitalize">{t(`dashboard.${sent}`)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-foreground/80">
          <div className="w-7 h-7 rounded-lg bg-cta/10 flex items-center justify-center text-cta text-xs font-bold">
            {avgEng}
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">{t('audience.avgEngagement')}</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <button className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors">
        {t('audience.createContent')}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function AudienceContent() {
  const { t } = useTranslation()
  const segments = useSegments()
  const regenerate = useRegenerateSegments()

  return (
    <div className="space-y-6">
      {/* Header with regenerate */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {segments.data ? `${segments.data.segment_count} segments` : ''}
        </p>
        <button
          onClick={() => regenerate.mutate()}
          disabled={regenerate.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg glass text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${regenerate.isPending ? 'animate-spin' : ''}`} />
          {regenerate.isPending ? t('audience.regenerating') : t('audience.regenerate')}
        </button>
      </div>

      {/* Segment Cards */}
      {segments.data && segments.data.segments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.data.segments.map((seg) => (
            <SegmentCard
              key={seg.id}
              label={seg.label}
              size={seg.size}
              characteristics={seg.characteristics}
            />
          ))}
        </div>
      ) : (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-muted-foreground">{t('audience.noSegments')}</p>
        </div>
      )}
    </div>
  )
}

export default function Audience() {
  const { t } = useTranslation()
  const isLocked = useIsFeatureLocked('audience_segmentation')

  return (
    <LockedFeature locked={isLocked} featureName={t('nav.myAudience')}>
      <AudienceContent />
    </LockedFeature>
  )
}
