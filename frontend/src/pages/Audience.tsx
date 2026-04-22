import { useTranslation } from 'react-i18next'
import {
  RefreshCw, Image, Video, Layers, Sun, Sunrise, Sunset,
  Sparkles, Lightbulb, Clock, Users,
} from 'lucide-react'
import {
  useSegments, useRegenerateSegments, useAudienceInsights,
} from '../hooks/useAnalytics'
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

/* ── AI hero — behaviour summary, what they want, best time ─────────────── */

function PageHeader() {
  const { t } = useTranslation()
  return (
    <p className="text-sm text-muted-foreground" dir="auto">
      {t('myAudiencePage.question')}
    </p>
  )
}

function BehaviorSummary({ text }: { text: string }) {
  const { t } = useTranslation()
  const isEmpty = !text || text.length === 0
  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t('myAudiencePage.behaviorTitle')}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {t('myAudiencePage.behaviorSubtitle')}
          </p>
        </div>
      </div>
      <p dir="auto" className="text-sm text-foreground/85 leading-relaxed">
        {isEmpty ? t('myAudiencePage.behaviorFallback') : text}
      </p>
    </div>
  )
}

function WhatTheyWant({ items }: { items: { topic: string; reason: string }[] }) {
  const { t } = useTranslation()
  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-cta/10 flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-cta" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t('myAudiencePage.wantsTitle')}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {t('myAudiencePage.wantsSubtitle')}
          </p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('myAudiencePage.wantsEmpty')}</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-cta/15 text-cta flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p dir="auto" className="text-sm font-semibold text-foreground leading-snug">
                  {item.topic}
                </p>
                <p dir="auto" className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {item.reason}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BestTime({ day, time, reason }: { day: string; time: string; reason: string }) {
  const { t } = useTranslation()
  const hasSlot = day && time
  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-accent/30 flex items-center justify-center">
          <Clock className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t('myAudiencePage.bestTimeTitle')}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {t('myAudiencePage.bestTimeSubtitle')}
          </p>
        </div>
      </div>

      {hasSlot ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary">{day}</span>
            <span className="text-lg font-semibold text-foreground/70">{time}</span>
          </div>
          <p dir="auto" className="text-sm text-foreground/80 leading-relaxed">
            {reason || t('myAudiencePage.bestTimeFallback')}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t('myAudiencePage.bestTimeEmpty')}</p>
      )}
    </div>
  )
}

function AIHero() {
  const { t } = useTranslation()
  const { data, isLoading } = useAudienceInsights()

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
        {t('myAudiencePage.loadingInsights')}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <BehaviorSummary text={data?.behavior_summary || ''} />
      <WhatTheyWant items={data?.what_they_want || []} />
      <BestTime
        day={data?.best_time?.day || ''}
        time={data?.best_time?.time || ''}
        reason={data?.best_time?.reason || ''}
      />
    </div>
  )
}

/* ── Segment cards (supporting evidence below) ──────────────────────────── */

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
    <div className="glass rounded-2xl p-5 flex flex-col gap-3 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-foreground leading-tight">{label}</h3>
        <span className="shrink-0 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          {size} {t('audience.segmentSize')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 text-sm text-foreground/80">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {contentTypeIcons[ct] || contentTypeIcons.IMAGE}
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">{t('audience.contentType')}</p>
            <p className="text-xs font-semibold">
              {t(`analytics.${ct === 'CAROUSEL_ALBUM' ? 'carousel' : ct.toLowerCase()}`)}
            </p>
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
    </div>
  )
}

function AudienceContent() {
  const { t } = useTranslation()
  const segments = useSegments()
  const regenerate = useRegenerateSegments()

  return (
    <div className="space-y-6">
      <PageHeader />

      {/* AI hero */}
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-cta" />
        <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">
          {t('myAudiencePage.heroLabel')}
        </h2>
      </div>
      <AIHero />

      {/* Supporting evidence: segment detail cards */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">
            {t('myAudiencePage.segmentsLabel')}
          </h2>
          <span className="text-xs text-muted-foreground">
            {segments.data ? `· ${segments.data.segment_count}` : ''}
          </span>
        </div>
        <button
          onClick={() => regenerate.mutate()}
          disabled={regenerate.isPending}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${regenerate.isPending ? 'animate-spin' : ''}`} />
          {regenerate.isPending ? t('audience.regenerating') : t('audience.regenerate')}
        </button>
      </div>

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
