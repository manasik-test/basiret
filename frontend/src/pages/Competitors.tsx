import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, I } from '../components/redesign/icons'
import { useIsFeatureLocked } from '../hooks/useBilling'
import LockedFeature from '../components/LockedFeature'
import { useCompetitorLeaderboard, useCompetitorTopPosts } from '../hooks/useAnalytics'

/* ------------------------------------------------------------------ */
/* Mock data                                                          */
/* ------------------------------------------------------------------ */

interface FeedItem {
  who: string
  whenKey: string
  kindKey: 'kindVideo' | 'kindImage' | 'kindCarousel' | 'kindReel'
  titleKey: string
  engKey: string
  whyKey: string
  mood: 'pos' | 'neu' | 'neg'
  tagKey:
    | 'tagOpportunity'
    | 'tagTrending'
    | 'tagOutperform'
    | 'tagStyle'
    | 'tagWarning'
}

const FEED: FeedItem[] = [
  {
    who: '@raid_co',
    whenKey: 'ago2h',
    kindKey: 'kindVideo',
    titleKey: 'feed.post1Title',
    engKey: 'feed.post1Eng',
    whyKey: 'feed.post1Why',
    mood: 'pos',
    tagKey: 'tagOpportunity',
  },
  {
    who: '@noor_brand',
    whenKey: 'ago4h',
    kindKey: 'kindCarousel',
    titleKey: 'feed.post2Title',
    engKey: 'feed.post2Eng',
    whyKey: 'feed.post2Why',
    mood: 'pos',
    tagKey: 'tagTrending',
  },
  {
    who: '@nour_design',
    whenKey: 'ago1d',
    kindKey: 'kindImage',
    titleKey: 'feed.post3Title',
    engKey: 'feed.post3Eng',
    whyKey: 'feed.post3Why',
    mood: 'neu',
    tagKey: 'tagOutperform',
  },
  {
    who: '@sahab_studio',
    whenKey: 'ago2d',
    kindKey: 'kindVideo',
    titleKey: 'feed.post4Title',
    engKey: 'feed.post4Eng',
    whyKey: 'feed.post4Why',
    mood: 'pos',
    tagKey: 'tagStyle',
  },
  {
    who: '@raid_co',
    whenKey: 'ago3d',
    kindKey: 'kindImage',
    titleKey: 'feed.post5Title',
    engKey: 'feed.post5Eng',
    whyKey: 'feed.post5Why',
    mood: 'neg',
    tagKey: 'tagWarning',
  },
]

interface HashtagRow {
  tagKey: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  used: number
  vsYou: string
  mood: 'pos' | 'neu' | 'neg'
}

const HASHTAGS: HashtagRow[] = [
  { tagKey: 'h1', used: 14, vsYou: '+12', mood: 'pos' },
  { tagKey: 'h2', used: 22, vsYou: '+8', mood: 'pos' },
  { tagKey: 'h3', used: 18, vsYou: '+4', mood: 'neu' },
  { tagKey: 'h4', used: 9, vsYou: '-3', mood: 'neg' },
  { tagKey: 'h5', used: 7, vsYou: '+7', mood: 'pos' },
  { tagKey: 'h6', used: 11, vsYou: '+5', mood: 'pos' },
]

const HEATMAP = [
  [0, 0, 1, 2, 1, 3, 2, 1, 0, 0],
  [1, 2, 3, 5, 3, 4, 2, 1, 0, 0],
  [0, 1, 2, 3, 4, 5, 4, 3, 1, 0],
  [1, 1, 2, 4, 5, 6, 4, 2, 1, 0],
  [0, 1, 3, 4, 5, 7, 5, 3, 2, 1],
  [2, 3, 4, 5, 6, 7, 6, 4, 3, 2],
  [1, 2, 3, 4, 4, 5, 3, 2, 1, 0],
]

const HOUR_LABELS = ['6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p', '12a']

const C_MOOD = {
  pos: { fg: 'oklch(0.5 0.15 155)', bg: 'oklch(0.96 0.05 155)' },
  neu: { fg: 'var(--ink-600)', bg: 'var(--ink-100)' },
  neg: { fg: 'oklch(0.55 0.17 30)', bg: 'oklch(0.96 0.05 30)' },
}

const C_TAG = {
  tagOpportunity: { bg: 'oklch(0.95 0.07 155)', fg: 'oklch(0.42 0.13 155)' },
  tagTrending: { bg: 'oklch(0.95 0.07 285)', fg: 'var(--purple-700)' },
  tagOutperform: { bg: 'oklch(0.95 0.07 200)', fg: 'oklch(0.45 0.13 200)' },
  tagStyle: { bg: 'var(--ink-100)', fg: 'var(--ink-700)' },
  tagWarning: { bg: 'oklch(0.95 0.07 30)', fg: 'oklch(0.5 0.17 30)' },
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

function CompetitorsContent() {
  const { t } = useTranslation()
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d')
  const leaderboard = useCompetitorLeaderboard()
  const topPosts = useCompetitorTopPosts()

  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
  const me = {
    handle: '@you',
    name: t('competitorsPage.youLabel'),
    avatar: 'Y',
    followers: '12.4K',
    growth: '+2.1%',
    engagement: '9.6%',
    cadence: '4/week',
    isMe: true,
  }
  const competitors = leaderboard.data?.competitors ?? []
  const topPostsList = topPosts.data?.posts ?? []

  return (
    <div className="rd-canvas">
      <div className="cmp-main">
        <header className="cmp-head">
          <div>
            <h1 dir="auto">{t('competitorsPage.headerTitle')}</h1>
            <p dir="auto">{t('competitorsPage.headerSubtitle')}</p>
          </div>
          <div className="cmp-head-r">
            <div className="cmp-seg">
              {(['today', '7d', '30d'] as const).map((r) => (
                <button key={r} className={range === r ? 'is-on' : ''} onClick={() => setRange(r)}>
                  {t(`competitorsPage.range${r === 'today' ? 'Today' : r === '7d' ? '7d' : '30d'}` as never)}
                </button>
              ))}
            </div>
            <button className="cmp-add">{t('competitorsPage.addCompetitor')}</button>
          </div>
        </header>

        {/* AI hero */}
        <section className="cmp-hero">
          <div className="cmp-hero-l">
            <div className="cmp-hero-k">{t('competitorsPage.heroEyebrow')}</div>
            <h2 dir="auto">{t('competitorsPage.heroHeadline')}</h2>
            <p dir="auto">{t('competitorsPage.heroBody')}</p>
            <div className="cmp-hero-acts">
              <button className="cmp-hero-btn primary">{t('competitorsPage.heroCta1')}</button>
              <button className="cmp-hero-btn ghost">{t('competitorsPage.heroCta2')}</button>
            </div>
          </div>
          <div className="cmp-hero-stats">
            <div className="cmp-hero-stat">
              <div className="cmp-hero-stat-k">{t('competitorsPage.stat1Label')}</div>
              <div className="cmp-hero-stat-v num">19</div>
              <div className="cmp-hero-stat-d">{t('competitorsPage.stat1Sub', { value: '4' })}</div>
            </div>
            <div className="cmp-hero-stat">
              <div className="cmp-hero-stat-k">{t('competitorsPage.stat2Label')}</div>
              <div className="cmp-hero-stat-v num">9.1%</div>
              <div className="cmp-hero-stat-d">{t('competitorsPage.stat2Sub', { value: '9.6%' })}</div>
            </div>
            <div className="cmp-hero-stat">
              <div className="cmp-hero-stat-k">{t('competitorsPage.stat3Label')}</div>
              <div className="cmp-hero-stat-v num">3</div>
              <div className="cmp-hero-stat-d">{t('competitorsPage.stat3Sub')}</div>
            </div>
          </div>
        </section>

        {/* Leaderboard — you vs competitors on the four KPI columns */}
        <section className="cmp-card">
          <div className="cmp-card-head">
            <div>
              <h3>{t('competitorsPage.leaderboardTitle')}</h3>
              <p>{t('competitorsPage.leaderboardSubtitle')}</p>
            </div>
          </div>
          <div className="cmp-board">
            <div className="cmp-board-h">
              <span>{t('competitorsPage.colAccount')}</span>
              <span>{t('competitorsPage.colFollowers')}</span>
              <span>{t('competitorsPage.colGrowth')}</span>
              <span>{t('competitorsPage.colEngagement')}</span>
              <span>{t('competitorsPage.colCadence')}</span>
            </div>
            {[me, ...competitors].map((row, i) => {
              const isMe = (row as { isMe?: boolean }).isMe
              return (
                <div key={`${row.handle}-${i}`} className={`cmp-board-r ${isMe ? 'is-me' : ''}`}>
                  <div className="cmp-board-acc">
                    <span className="cmp-board-rank num">{i + 1}</span>
                    <span className="cmp-av">{row.avatar}</span>
                    <div>
                      <div className="cmp-board-n">
                        {row.name}
                        {isMe && <span className="cmp-me">{t('competitorsPage.youBadge')}</span>}
                      </div>
                      <div className="cmp-board-h2">{row.handle}</div>
                    </div>
                  </div>
                  <span className="cmp-board-num num">{row.followers}</span>
                  <span className="cmp-board-up num">{row.growth}</span>
                  <span className="cmp-board-eng num">{row.engagement}</span>
                  <span className="cmp-board-cad num">{row.cadence}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Top posts grid — 4 cards of best-performing competitor posts */}
        {topPostsList.length > 0 && (
          <section className="cmp-card">
            <div className="cmp-card-head">
              <div>
                <h3>{t('competitorsPage.topPostsTitle')}</h3>
                <p>{t('competitorsPage.topPostsSubtitle')}</p>
              </div>
            </div>
            <div className="cmp-top">
              {topPostsList.map((p, i) => (
                <article key={i} className="cmp-top-c">
                  <div
                    className="cmp-top-thumb"
                    style={{
                      background: i % 2 ? 'oklch(0.75 0.12 60)' : 'oklch(0.7 0.15 30)',
                    }}
                  >
                    <span className="cmp-top-fmt">
                      {t(`competitorsPage.kind${p.format.charAt(0).toUpperCase()}${p.format.slice(1)}` as never)}
                    </span>
                    <span className="cmp-top-eng">{p.engagement_pct}</span>
                  </div>
                  <div className="cmp-top-meta">
                    <div className="cmp-top-tag">
                      {t(`competitorsPage.topTag.${p.tag_key}` as never)}
                    </div>
                    <div className="cmp-top-who">{p.who}</div>
                    <div className="cmp-top-m num">{p.metric}</div>
                  </div>
                  <button className="cmp-top-btn">
                    {t('competitorsPage.actionGenerate')}
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="cmp-grid">
          <div className="cmp-col">
            <section className="cmp-card">
              <div className="cmp-card-head">
                <div>
                  <h3>{t('competitorsPage.activityTitle')}</h3>
                  <p>{t('competitorsPage.activitySubtitle')}</p>
                </div>
              </div>
              <div className="cmp-feed">
                {FEED.map((f, i) => {
                  const m = C_MOOD[f.mood]
                  const tagMeta = C_TAG[f.tagKey]
                  return (
                    <article key={i} className="cmp-feed-i">
                      <div
                        className="cmp-feed-thumb"
                        style={{ background: `linear-gradient(135deg, ${m.bg}, ${m.fg})` }}
                      >
                        <span className="cmp-feed-format">
                          {t(`competitorsPage.${f.kindKey}`)}
                        </span>
                      </div>
                      <div className="cmp-feed-body">
                        <div className="cmp-feed-meta">
                          <span className="cmp-feed-who">{f.who}</span>
                          <span className="cmp-feed-dot">·</span>
                          <span className="cmp-feed-when">
                            {t(`competitorsPage.${f.whenKey}`)}
                          </span>
                          <span
                            className="cmp-feed-tag"
                            style={{ background: tagMeta.bg, color: tagMeta.fg }}
                          >
                            {t(`competitorsPage.${f.tagKey}`)}
                          </span>
                        </div>
                        <div className="cmp-feed-title" dir="auto">
                          {t(`competitorsPage.${f.titleKey}`)}
                        </div>
                        <div className="cmp-feed-eng" dir="auto">
                          <span className="num">{t(`competitorsPage.${f.engKey}`)}</span>
                          <span className="cmp-feed-why">— {t(`competitorsPage.${f.whyKey}`)}</span>
                        </div>
                      </div>
                      <div className="cmp-feed-acts">
                        <button className="cmp-feed-btn primary">
                          <Icon path={I.wand} size={11} />
                          {t('competitorsPage.actionGenerate')}
                        </button>
                        <button className="cmp-feed-btn ghost">{t('competitorsPage.actionSave')}</button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          </div>

          <div className="cmp-col">
            <section className="cmp-card">
              <h3>{t('competitorsPage.hashtagsTitle')}</h3>
              <p className="cmp-sub">{t('competitorsPage.hashtagsSubtitle')}</p>
              <div className="cmp-tags">
                <div className="cmp-tag-r cmp-tag-r--head">
                  <span>{t('competitorsPage.hashtagCol')}</span>
                  <span>{t('competitorsPage.usesCol')}</span>
                  <span>{t('competitorsPage.vsYouCol')}</span>
                  <span>{t('competitorsPage.sentimentCol')}</span>
                </div>
                {HASHTAGS.map((h) => {
                  const m = C_MOOD[h.mood]
                  const positive = !h.vsYou.startsWith('-')
                  const moodLabel =
                    h.mood === 'pos'
                      ? t('competitorsPage.moodPositive')
                      : h.mood === 'neg'
                        ? t('competitorsPage.moodNegative')
                        : t('competitorsPage.moodNeutral')
                  return (
                    <div key={h.tagKey} className="cmp-tag-r">
                      <span className="cmp-tag-t">{t(`competitorsPage.hashtags.${h.tagKey}`)}</span>
                      <span className="cmp-tag-u num">{h.used}×</span>
                      <span
                        className="cmp-tag-d num"
                        style={{
                          color: positive ? 'oklch(0.5 0.15 155)' : 'oklch(0.55 0.17 30)',
                        }}
                      >
                        {h.vsYou}
                      </span>
                      <span className="cmp-tag-mood" style={{ background: m.bg, color: m.fg }}>
                        {moodLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="cmp-card">
              <h3>{t('competitorsPage.heatmapTitle')}</h3>
              <p className="cmp-sub">{t('competitorsPage.heatmapSubtitle')}</p>
              <div className="cmp-heat" dir="ltr">
                <div className="cmp-heat-cols">
                  <span />
                  {HOUR_LABELS.map((h) => (
                    <span key={h}>{h}</span>
                  ))}
                </div>
                <div className="cmp-heat-grid">
                  {HEATMAP.map((row, r) => (
                    <div key={r} className="cmp-heat-row">
                      <span className="cmp-heat-day">
                        {t(`competitorsPage.dayLabels.${dayKeys[r]}`)}
                      </span>
                      {row.map((v, c) => (
                        <div
                          key={c}
                          className="cmp-heat-cell"
                          style={{
                            background:
                              v === 0
                                ? 'var(--ink-100)'
                                : `oklch(0.62 0.18 285 / ${0.18 + v * 0.11})`,
                            borderColor: v >= 5 ? 'var(--purple-700)' : 'transparent',
                          }}
                          title={String(v)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <p className="cmp-heat-hint">
                  {t('competitorsPage.heatmapPeak', { slot: t('competitorsPage.heatmapPeakSlot') })}
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>

      <style>{CMP_STYLES}</style>
    </div>
  )
}

export default function Competitors() {
  const { t } = useTranslation()
  const isLocked = useIsFeatureLocked('content_recommendations')
  return (
    <LockedFeature locked={isLocked} featureName={t('nav.competitors')}>
      <CompetitorsContent />
    </LockedFeature>
  )
}

/* ------------------------------------------------------------------ */
/* Styles                                                             */
/* ------------------------------------------------------------------ */

const CMP_STYLES = `
.cmp-main { display:flex; flex-direction:column; gap:18px; max-width:1520px; margin:0 auto; }
.cmp-head { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; flex-wrap:wrap; }
.cmp-head h1 { font-size:26px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; margin-bottom:3px; }
.cmp-head p { font-size:12.5px; color:var(--ink-500); }
.cmp-head-r { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.cmp-seg { display:flex; background:var(--ink-100); border-radius:10px; padding:3px; }
.cmp-seg button { padding:7px 14px; font-size:12.5px; border-radius:7px; color:var(--ink-600); font-weight:500; }
.cmp-seg button.is-on { background:var(--surface); color:var(--ink-900); font-weight:600; box-shadow:0 1px 3px rgba(0,0,0,.04); }
.cmp-add { padding:8px 14px; font-size:12.5px; border-radius:10px; background:transparent; color:var(--purple-700); font-weight:600; border:1px solid var(--purple-200); }

/* Hero */
.cmp-hero { display:grid; grid-template-columns:1.6fr 1fr; gap:18px; background:linear-gradient(135deg, var(--purple-50), oklch(0.97 0.03 280)); border:1px solid var(--purple-200); border-radius:16px; padding:18px 22px; align-items:center; }
@media (max-width:1024px) { .cmp-hero { grid-template-columns:1fr; } }
.cmp-hero-k { font-size:10px; font-weight:700; color:var(--purple-700); letter-spacing:0.04em; text-transform:uppercase; margin-bottom:6px; }
.cmp-hero h2 { font-size:16px; font-weight:700; color:var(--ink-950); margin-bottom:6px; letter-spacing:-0.01em; line-height:1.4; }
.cmp-hero p { font-size:12.5px; color:var(--ink-700); line-height:1.6; margin-bottom:10px; max-width:580px; }
.cmp-hero-acts { display:flex; gap:6px; flex-wrap:wrap; }
.cmp-hero-btn { padding:7px 11px; border-radius:8px; font-size:11.5px; font-weight:600; }
.cmp-hero-btn.primary { background:var(--purple-600); color:#fff; }
.cmp-hero-btn.primary:hover { background:var(--purple-700); }
.cmp-hero-btn.ghost { background:transparent; color:var(--purple-800); }
.cmp-hero-stats { display:flex; flex-direction:column; gap:6px; }
.cmp-hero-stat { background:var(--surface); border-radius:10px; padding:8px 11px; display:grid; grid-template-columns:1fr auto; align-items:center; gap:8px; }
.cmp-hero-stat-k { font-size:10.5px; color:var(--ink-500); font-weight:500; grid-row:1; grid-column:1; }
.cmp-hero-stat-v { font-size:16px; font-weight:700; color:var(--ink-950); letter-spacing:-0.01em; line-height:1; grid-row:1 / span 2; grid-column:2; }
.cmp-hero-stat-d { font-size:10.5px; color:var(--ink-600); font-weight:500; grid-row:2; grid-column:1; }

/* Leaderboard */
.cmp-board { display:flex; flex-direction:column; gap:1px; background:var(--line); border-radius:12px; overflow:hidden; }
.cmp-board-h, .cmp-board-r { display:grid; grid-template-columns:2fr .9fr .8fr .9fr 1fr; gap:14px; padding:11px 14px; align-items:center; background:var(--surface); }
@media (max-width:768px) { .cmp-board-h, .cmp-board-r { grid-template-columns:2fr 1fr 1fr; } .cmp-board-h > :nth-child(n+4), .cmp-board-r > :nth-child(n+4) { display:none; } }
.cmp-board-h { background:var(--ink-50); font-size:11px; color:var(--ink-500); font-weight:600; text-transform:uppercase; letter-spacing:0.03em; }
.cmp-board-r { font-size:12.5px; }
.cmp-board-r:hover { background:var(--ink-50); }
.cmp-board-r.is-me { background:var(--purple-50); }
.cmp-board-r.is-me:hover { background:oklch(0.96 0.04 285); }
.cmp-board-acc { display:flex; align-items:center; gap:10px; min-width:0; }
.cmp-board-rank { color:var(--ink-400); font-size:11px; font-weight:600; min-width:14px; }
.cmp-board-n { font-weight:600; color:var(--ink-950); font-size:12.5px; display:flex; align-items:center; gap:6px; }
.cmp-board-h2 { font-size:11px; color:var(--ink-500); }
.cmp-me { display:inline-block; font-size:9.5px; padding:1px 6px; border-radius:99px; background:var(--purple-200); color:var(--purple-800); font-weight:700; }
.cmp-board-num { color:var(--ink-900); font-weight:600; }
.cmp-board-up { color:oklch(0.5 0.15 155); font-weight:600; }
.cmp-board-eng { color:var(--ink-950); font-weight:700; }
.cmp-board-cad { color:var(--ink-700); font-size:11.5px; }
.cmp-av { width:28px; height:28px; border-radius:50%; display:grid; place-items:center; color:#fff; font-weight:700; font-size:11px; flex-shrink:0; background:var(--purple-500); }

/* Top posts grid */
.cmp-top { display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; }
@media (min-width:1280px) { .cmp-top { grid-template-columns:repeat(4, 1fr); } }
.cmp-top-c { display:flex; flex-direction:column; gap:8px; padding:10px; border-radius:12px; border:1px solid var(--line); background:var(--surface); }
.cmp-top-thumb { aspect-ratio:1.4; border-radius:10px; display:flex; justify-content:space-between; align-items:flex-start; padding:8px; }
.cmp-top-fmt { font-size:10px; padding:3px 8px; background:rgba(0,0,0,.45); color:#fff; border-radius:99px; font-weight:700; }
.cmp-top-eng { font-size:11px; padding:3px 8px; background:#fff; color:oklch(0.5 0.15 155); border-radius:99px; font-weight:700; }
.cmp-top-meta { padding:0 4px; }
.cmp-top-tag { font-size:11px; color:var(--ink-500); font-weight:500; }
.cmp-top-who { font-size:12.5px; font-weight:600; color:var(--ink-900); margin:2px 0; }
.cmp-top-m { font-size:11px; color:var(--ink-700); font-weight:600; }
.cmp-top-btn { padding:8px; border-radius:8px; font-size:11.5px; font-weight:600; background:var(--ink-50); color:var(--ink-800); border:1px solid var(--line); }
.cmp-top-btn:hover { background:var(--purple-50); color:var(--purple-700); border-color:var(--purple-200); }

/* Cards */
.cmp-card { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:20px 22px; }
.cmp-card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:14px; }
.cmp-card-head h3 { font-size:15px; font-weight:700; color:var(--ink-950); margin-bottom:3px; letter-spacing:-0.005em; }
.cmp-card-head p { font-size:12px; color:var(--ink-500); }
.cmp-card h3 { font-size:14px; font-weight:700; color:var(--ink-950); }
.cmp-card p.cmp-sub { font-size:11.5px; color:var(--ink-500); font-weight:500; margin:2px 0 14px; }

/* Grid */
.cmp-grid { display:grid; grid-template-columns:1.4fr 1fr; gap:18px; align-items:flex-start; }
@media (max-width:1024px) { .cmp-grid { grid-template-columns:1fr; } }
.cmp-col { display:flex; flex-direction:column; gap:14px; }

/* Feed */
.cmp-feed { display:flex; flex-direction:column; gap:8px; }
.cmp-feed-i { display:grid; grid-template-columns:64px 1fr auto; gap:14px; padding:12px; border-radius:12px; border:1px solid var(--line); background:var(--surface); align-items:center; transition:border-color .15s; }
@media (max-width:768px) { .cmp-feed-i { grid-template-columns:1fr; } }
.cmp-feed-i:hover { border-color:var(--purple-300); }
.cmp-feed-thumb { width:64px; height:64px; border-radius:10px; display:grid; place-items:center; position:relative; overflow:hidden; }
.cmp-feed-format { font-size:10px; font-weight:700; color:#fff; padding:2px 8px; background:rgba(0,0,0,.4); border-radius:99px; }
.cmp-feed-meta { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--ink-500); margin-bottom:4px; flex-wrap:wrap; }
.cmp-feed-who { font-weight:700; color:var(--ink-900); font-size:12px; }
.cmp-feed-dot { color:var(--ink-300); }
.cmp-feed-tag { padding:2px 8px; border-radius:99px; font-size:10.5px; font-weight:600; margin-inline-start:4px; }
.cmp-feed-title { font-size:13px; font-weight:600; color:var(--ink-950); margin-bottom:4px; }
.cmp-feed-eng { font-size:11.5px; color:var(--ink-700); }
.cmp-feed-eng .num { font-weight:700; color:var(--ink-950); }
.cmp-feed-why { color:var(--ink-500); margin-inline-start:6px; font-weight:500; }
.cmp-feed-acts { display:flex; flex-direction:column; gap:4px; }
.cmp-feed-btn { padding:7px 12px; border-radius:8px; font-size:11px; font-weight:600; white-space:nowrap; display:inline-flex; align-items:center; gap:4px; }
.cmp-feed-btn.primary { background:var(--ink-900); color:#fff; }
.cmp-feed-btn.primary:hover { background:var(--purple-700); }
.cmp-feed-btn.ghost { color:var(--ink-700); border:1px solid var(--line-strong); background:transparent; }
.cmp-feed-btn.ghost:hover { background:var(--ink-50); }

/* Hashtags */
.cmp-tags { display:flex; flex-direction:column; gap:1px; background:var(--line); border-radius:10px; overflow:hidden; }
.cmp-tag-r { display:grid; grid-template-columns:1.5fr .6fr .6fr 1fr; gap:10px; padding:10px 12px; background:var(--surface); align-items:center; font-size:12px; }
.cmp-tag-r--head { background:var(--ink-50); font-size:10.5px; color:var(--ink-500); font-weight:600; text-transform:uppercase; letter-spacing:0.03em; }
.cmp-tag-t { font-weight:600; color:var(--ink-900); }
.cmp-tag-u { color:var(--ink-700); font-weight:500; }
.cmp-tag-d { font-weight:700; }
.cmp-tag-mood { padding:3px 9px; border-radius:99px; font-size:10.5px; font-weight:600; justify-self:end; }

/* Heatmap */
.cmp-heat { display:flex; flex-direction:column; gap:3px; }
.cmp-heat-cols { display:grid; grid-template-columns:24px repeat(10,1fr); gap:3px; font-size:9.5px; color:var(--ink-400); margin-bottom:4px; padding-inline-start:3px; }
.cmp-heat-cols span { text-align:center; font-weight:500; }
.cmp-heat-grid { display:flex; flex-direction:column; gap:3px; }
.cmp-heat-row { display:grid; grid-template-columns:24px repeat(10,1fr); gap:3px; }
.cmp-heat-day { font-size:10px; color:var(--ink-500); display:grid; place-items:center; font-weight:600; }
.cmp-heat-cell { aspect-ratio:1; min-height:22px; border-radius:4px; border:1.5px solid; transition:transform .12s; }
.cmp-heat-cell:hover { transform:scale(1.15); }
.cmp-heat-hint { font-size:11px; color:var(--ink-600); margin-top:10px; }
.cmp-heat-hint b { color:var(--purple-700); font-weight:700; }
`
