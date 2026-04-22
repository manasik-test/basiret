import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Sparkles, TrendingUp, AlertTriangle, ArrowRight, Image, Video, Layers, Film,
  Wand2, Check, Copy, ExternalLink, Loader2,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { usePostsBreakdown, usePostsInsights, useGenerateCaption } from '../hooks/useAnalytics'
import TopPostsTable from '../components/dashboard/TopPostsTable'

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

/* ── AI hero: What worked + What to change ──────────────────────────────── */

function PageHeader() {
  const { t } = useTranslation()
  return (
    <div>
      <p className="text-sm text-muted-foreground" dir="auto">
        {t('myPostsPage.question')}
      </p>
    </div>
  )
}

function AIHero() {
  const { t, i18n } = useTranslation()
  const { data, isLoading } = usePostsInsights()
  const generate = useGenerateCaption()
  const [generated, setGenerated] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
        {t('myPostsPage.loadingInsights')}
      </div>
    )
  }

  const best = data?.best_post
  const why = (data?.why_it_worked || '').trim()
  const pattern = (data?.low_performers_pattern || '').trim()
  const change = (data?.what_to_change || '').trim()

  function onGenerateCaption() {
    if (!best) return
    setGenerated(null)
    setCopied(false)
    const lang: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en'
    generate.mutate(
      { post_id: best.id, content_type: best.content_type, language: lang },
      { onSuccess: (res) => setGenerated(res.caption || '') },
    )
  }

  function copyCaption() {
    if (!generated) return
    navigator.clipboard.writeText(generated)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── What worked ── */}
      <div className="glass rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t('myPostsPage.whatWorked')}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {t('myPostsPage.whatWorkedSubtitle')}
            </p>
          </div>
        </div>

        {best ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-white/40 p-3 border border-emerald-100">
              <div className="flex items-center gap-2 text-xs text-foreground/70">
                <span className="text-emerald-700">{typeIcons[best.content_type] || typeIcons.image}</span>
                <span className="font-semibold capitalize">
                  {typeLabels[best.content_type] || best.content_type}
                </span>
                <span className="text-muted-foreground">·</span>
                <span>{best.likes} {t('dashboard.likes').toLowerCase()}</span>
                <span className="text-muted-foreground">·</span>
                <span>{best.comments} {t('dashboard.comments').toLowerCase()}</span>
              </div>
              {best.caption ? (
                <p dir="auto" className="text-sm text-foreground/85 mt-2 line-clamp-2 leading-relaxed">
                  {best.caption}
                </p>
              ) : null}
            </div>

            <p dir="auto" className="text-sm text-foreground/85 leading-relaxed">
              {why || t('myPostsPage.whyFallback')}
            </p>

            {/* Generate similar caption */}
            <div className="space-y-2">
              <button
                onClick={onGenerateCaption}
                disabled={generate.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cta text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {generate.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                {generate.isPending
                  ? t('myPostsPage.generating')
                  : t('myPostsPage.generateSimilarCaption')}
              </button>

              {generated ? (
                <div className="rounded-xl bg-cta/5 border border-cta/20 p-3 flex flex-col gap-2">
                  <p
                    dir="auto"
                    className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap"
                  >
                    {generated}
                  </p>
                  <button
                    onClick={copyCaption}
                    className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? t('myPostsPage.copied') : t('myPostsPage.copyCaption')}
                  </button>
                </div>
              ) : null}

              {best.permalink ? (
                <a
                  href={best.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {t('myPostsPage.openOnInstagram')} <ExternalLink className="w-3 h-3" />
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('myPostsPage.bestEmpty')}</p>
        )}
      </div>

      {/* ── What to change ── */}
      <div className="glass rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t('myPostsPage.whatToChange')}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {t('myPostsPage.whatToChangeSubtitle')}
            </p>
          </div>
        </div>

        {pattern || change ? (
          <div className="space-y-3">
            {pattern ? (
              <div className="rounded-xl bg-amber-50/60 p-3 border border-amber-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                  {t('myPostsPage.patternLabel')}
                </p>
                <p dir="auto" className="text-sm text-foreground/85 mt-1 leading-relaxed">
                  {pattern}
                </p>
              </div>
            ) : null}
            {change ? (
              <div className="rounded-xl bg-primary/5 p-3 border border-primary/15">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {t('myPostsPage.actionLabel')}
                </p>
                <p
                  dir="auto"
                  className="text-sm text-foreground/90 mt-1 leading-relaxed font-medium"
                >
                  {change}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('myPostsPage.changeFallback')}</p>
        )}
      </div>
    </div>
  )
}

/* ── Content type bar chart (supporting evidence) ───────────────────────── */

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
      <h2 className="text-lg font-bold text-foreground mb-1">{t('myPostsPage.evidenceTitle')}</h2>
      <p className="text-xs text-muted-foreground mb-4">
        {t('myPostsPage.evidenceSubtitle')}
      </p>
      <div dir="ltr" className="w-full h-[280px]">
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

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function Analytics() {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <PageHeader />

      {/* AI hero — actions before charts */}
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-cta" />
        <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">
          {t('myPostsPage.aiHeroLabel')}
        </h2>
      </div>
      <AIHero />

      {/* Supporting evidence: chart + table */}
      <div className="flex items-center gap-2 mt-2">
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">
          {t('myPostsPage.evidenceLabel')}
        </h2>
      </div>
      <ContentTypeChart />
      <TopPostsTable />
    </div>
  )
}
