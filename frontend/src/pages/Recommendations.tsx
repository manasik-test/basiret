import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Calendar, Clock, Image, Video, Layers, Film, Wand2, Copy, Check,
  TrendingUp, Sparkles, Loader2,
} from 'lucide-react'
import { useContentPlan, useGenerateCaption } from '../hooks/useAnalytics'
import { useIsFeatureLocked } from '../hooks/useBilling'
import LockedFeature from '../components/LockedFeature'
import type { ContentPlanDay } from '../api/analytics'

const typeIcons: Record<string, React.ReactNode> = {
  image: <Image className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
  carousel: <Layers className="w-4 h-4" />,
  reel: <Film className="w-4 h-4" />,
}

const typeBg: Record<string, string> = {
  image: 'bg-primary/10 text-primary',
  video: 'bg-cta/15 text-cta',
  carousel: 'bg-accent/30 text-primary',
  reel: 'bg-amber-100 text-amber-700',
}

/* ── Per-day plan card ──────────────────────────────────────────────────── */

function DayCard({
  day, isToday,
}: {
  day: ContentPlanDay
  isToday: boolean
}) {
  const { t, i18n } = useTranslation()
  const generate = useGenerateCaption()
  const [generated, setGenerated] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function onGenerate() {
    setGenerated(null)
    setCopied(false)
    const lang: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en'
    generate.mutate(
      { content_type: day.content_type, topic: day.topic, language: lang },
      { onSuccess: (res) => setGenerated(res.caption || '') },
    )
  }

  function copyCaption() {
    if (!generated) return
    navigator.clipboard.writeText(generated)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const dateObj = new Date(day.date + 'T00:00:00')
  const monthDay = dateObj.toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
    month: 'short',
    day: 'numeric',
  })
  const dayName = t(`contentPlanPage.day.${day.day_label.toLowerCase()}`)

  const ringColor = isToday ? 'ring-2 ring-cta/40' : ''

  return (
    <div className={`glass rounded-2xl p-4 flex flex-col gap-3 ${ringColor}`}>
      {/* Day header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {dayName}
          </p>
          <p className="text-sm font-bold text-foreground">{monthDay}</p>
        </div>
        {isToday ? (
          <span className="px-2 py-0.5 rounded-full bg-cta/15 text-cta text-[10px] font-bold uppercase tracking-wider">
            {t('contentPlanPage.today')}
          </span>
        ) : null}
      </div>

      {/* Content type pill */}
      <div className={`inline-flex self-start items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${typeBg[day.content_type] || typeBg.image}`}>
        {typeIcons[day.content_type] || typeIcons.image}
        <span className="capitalize">{day.content_type}</span>
      </div>

      {/* Topic */}
      <div className="min-h-[44px]">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {t('contentPlanPage.topicLabel')}
        </p>
        <p dir="auto" className="text-sm font-semibold text-foreground leading-snug">
          {day.topic || t('contentPlanPage.topicEmpty')}
        </p>
      </div>

      {/* Time + reach */}
      <div className="flex items-center justify-between text-xs text-foreground/70 border-t border-border/60 pt-2">
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="font-semibold">{day.best_time}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-muted-foreground">{t('contentPlanPage.estReach')}</span>
          <span className="font-semibold tabular-nums">{day.estimated_reach}</span>
        </span>
      </div>

      {/* Generate caption */}
      <button
        onClick={onGenerate}
        disabled={generate.isPending}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-60"
      >
        {generate.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Wand2 className="w-3.5 h-3.5" />
        )}
        {generate.isPending ? t('contentPlanPage.generating') : t('contentPlanPage.generateCaption')}
      </button>

      {generated ? (
        <div className="rounded-lg bg-cta/5 border border-cta/15 p-2.5 flex flex-col gap-1.5">
          <p
            dir="auto"
            className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap line-clamp-6"
          >
            {generated}
          </p>
          <button
            onClick={copyCaption}
            className="self-start inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? t('contentPlanPage.copied') : t('contentPlanPage.copy')}
          </button>
        </div>
      ) : null}
    </div>
  )
}

/* ── Main ──────────────────────────────────────────────────────────────── */

function ContentPlanContent() {
  const { t } = useTranslation()
  const { data, isLoading } = useContentPlan()
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), [])

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground" dir="auto">
        {t('contentPlanPage.question')}
      </p>

      {/* AI hero label */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-cta" />
          <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">
            {t('contentPlanPage.heroLabel')}
          </h2>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold text-foreground">{t('contentPlanPage.title')}</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {t('contentPlanPage.subtitle')}
        </p>
      </div>

      {isLoading ? (
        <div className="glass rounded-2xl p-12 text-center text-muted-foreground text-sm">
          {t('contentPlanPage.loading')}
        </div>
      ) : !data || data.days.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-muted-foreground text-sm">
          {t('contentPlanPage.empty')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data.days.map((day) => (
            <DayCard key={day.day_index} day={day} isToday={day.date === todayISO} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Recommendations() {
  const { t } = useTranslation()
  const isLocked = useIsFeatureLocked('content_recommendations')

  return (
    <LockedFeature locked={isLocked} featureName={t('nav.contentPlan')}>
      <ContentPlanContent />
    </LockedFeature>
  )
}
