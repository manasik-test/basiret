import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  BarChart3,
  Users,
  MessageSquareText,
  Lightbulb,
  Building2,
  RefreshCw,
  Check,
  Lock,
  TrendingUp,
  Brain,
  Search,
} from 'lucide-react'

// ── Navbar ────────────────────────────────────────────────

function Navbar() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function toggleLang() {
    const next = isAr ? 'en' : 'ar'
    i18n.changeLanguage(next)
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
  }

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'shadow-sm' : ''
      }`}
      style={
        scrolled
          ? {
              background: 'rgba(255, 255, 255, 0.55)',
              backdropFilter: 'blur(16px) saturate(180%)',
              WebkitBackdropFilter: 'blur(16px) saturate(180%)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
            }
          : { background: 'transparent' }
      }
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        {/* Left nav links */}
        <div className="flex items-center gap-8">
          <span className="text-[15px] font-semibold text-[#484848]">{t('landing.navBrand')}</span>
          <a href="#pricing" className="hidden md:inline text-[15px] font-medium text-[#484848]/70 hover:text-[#484848] transition-colors">
            {t('landing.navPricing')}
          </a>
          <a href="#features" className="hidden md:inline text-[15px] font-medium text-[#484848]/70 hover:text-[#484848] transition-colors">
            {t('landing.navDocs')}
          </a>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleLang}
            className="text-[15px] font-medium text-[#484848]/70 hover:text-[#484848] transition-colors"
          >
            {isAr ? 'English' : 'العربية'}
          </button>
          <Link
            to="/login"
            className="rounded-full bg-[#2D1B33] text-white px-5 py-2 text-sm font-semibold hover:bg-[#3d2843] transition-colors"
          >
            {t('auth.signIn')}
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ── Hero ──────────────────────────────────────────────────

function Hero() {
  const { t } = useTranslation()

  return (
    <section className="relative pt-24 pb-8 px-6 overflow-hidden">

      <div className="relative max-w-5xl mx-auto text-center">
        {/* Sub-headline */}
        <p className="text-sm font-medium text-[#484848]/50 tracking-wide mb-3">
          {t('landing.heroSubheadline')}
        </p>

        {/* Main headline — single line */}
        <h1 className="text-[clamp(2rem,4vw,3.5rem)] font-bold tracking-tight leading-[1.1] text-[#1a0a2e] whitespace-nowrap">
          {t('landing.heroMainHeadline')}
        </h1>

        {/* CTA buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-full bg-cta text-cta-foreground px-7 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {t('landing.startFree')}
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold text-[#2D1B33] transition-all hover:bg-white/60"
            style={{ background: 'rgba(255,255,255,0.35)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)' }}
          >
            {t('landing.seeHow')}
          </a>
        </div>

        {/* Hero collage */}
        <div className="relative w-full max-w-5xl mx-auto h-[520px] flex justify-center mt-16">

          {/* ── MAIN CARD — center, tall to fill section ── */}
          <div className="relative z-20 w-[400px] md:w-[460px] h-full rounded-3xl overflow-hidden shadow-2xl glass p-1">
            <div className="flex justify-between items-center p-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-black rounded flex items-center justify-center">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                </div>
                <span className="text-[10px] font-bold text-[#2D1B33]">basiretai</span>
              </div>
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#c4b5fd] to-[#e8a2cf]" />
            </div>
            <div className="w-full h-full bg-gradient-to-b from-blue-100 via-purple-100 to-purple-200 flex items-center justify-center">
              <div className="relative w-32 h-48">
                <div className="w-12 h-12 rounded-full bg-[#2D1B33]/40 mx-auto" />
                <div className="w-20 h-28 bg-[#2D1B33]/25 mx-auto mt-1 rounded-t-xl rounded-b-3xl" />
                <div className="absolute top-10 -left-5 w-12 h-3 bg-[#2D1B33]/20 rounded-full rotate-[-35deg]" />
                <div className="absolute top-10 -right-5 w-12 h-3 bg-[#2D1B33]/20 rounded-full rotate-[35deg]" />
                <div className="absolute top-[75%] -left-2 w-10 h-3 bg-[#2D1B33]/15 rounded-full rotate-[20deg]" />
                <div className="absolute top-[75%] -right-2 w-10 h-3 bg-[#2D1B33]/15 rounded-full rotate-[-20deg]" />
                <div className="absolute -top-2 right-2 w-2 h-5 bg-[#2D1B33]/15 rounded-full rotate-45" />
                <div className="absolute top-4 -right-8 w-1.5 h-4 bg-[#2D1B33]/12 rounded-full rotate-[-20deg]" />
                <div className="absolute top-2 right-6 w-2 h-3 bg-[#2D1B33]/10 rounded-full rotate-[60deg]" />
              </div>
            </div>
          </div>

          {/* ── SEARCH INPUT — top-left ── */}
          <div className="absolute z-30 left-[15%] top-[10%] glass px-6 py-3 rounded-full flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600">{t('landing.collageSearch')}</span>
            <div className="w-6 h-6 bg-[#2D1B33] rounded-full flex items-center justify-center">
              <Search className="w-3 h-3 text-white" />
            </div>
          </div>

          {/* ── TASK BAR — bottom-right ── */}
          <div className="absolute z-40 bottom-[10px] right-[5%] glass px-8 py-5 rounded-3xl flex items-center gap-12">
            <div className="flex items-center gap-3">
              <div className="flex flex-wrap gap-0.5 w-3">
                <div className="w-1.5 h-1.5 bg-black rounded-full" />
                <div className="w-1.5 h-1.5 bg-black rounded-full" />
              </div>
              <span className="text-sm font-semibold text-[#2D1B33]">{t('landing.collageTask')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] opacity-60 uppercase tracking-wider">{t('landing.collageAdvertising')}</span>
              <div className="w-10 h-5 bg-purple-200 rounded-full p-1 flex items-center">
                <div className="w-3 h-3 bg-primary rounded-full ms-auto" />
              </div>
            </div>
          </div>

          {/* ── ADVERTISING TOGGLE — right of card ── */}
          <div className="absolute z-30 right-[20%] top-[40%] glass px-5 py-2.5 rounded-full flex items-center gap-3">
            <span className="text-xs font-medium text-[#2D1B33]">{t('landing.collageAdvertising')}</span>
            <div className="w-8 h-4 bg-green-100 rounded-full flex items-center px-0.5">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full ms-auto" />
            </div>
          </div>

          {/* ── LEFT AVATARS ── */}
          <div className="absolute left-[5%] bottom-[20%] w-24 h-24 rounded-full border-4 border-white overflow-hidden z-10" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.10)' }}>
            <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #ddd6fe, #c4b5fd, #a78bfa)' }}>
              <div className="w-8 h-8 rounded-full bg-[#2D1B33]/35 mx-auto mt-4" />
              <div className="w-12 h-8 bg-[#2D1B33]/20 mx-auto mt-0.5 rounded-t-lg" />
            </div>
          </div>
          <div className="absolute left-[10%] bottom-[40%] w-16 h-16 rounded-full border-2 border-white overflow-hidden z-0 opacity-50" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
            <div className="w-full h-full" style={{ background: 'linear-gradient(180deg, #fce7f3, #e8a2cf)' }}>
              <div className="w-5 h-5 rounded-full bg-[#2D1B33]/30 mx-auto mt-2.5" />
              <div className="w-8 h-5 bg-[#2D1B33]/15 mx-auto mt-0.5 rounded-t-md" />
            </div>
          </div>

          {/* ── RIGHT AVATARS ── */}
          <div className="absolute right-[10%] top-[10%] w-20 h-20 rounded-full border-4 border-white overflow-hidden z-10" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}>
            <div className="w-full h-full" style={{ background: 'linear-gradient(180deg, #f0d9b5, #d4a985, #c4956a)' }}>
              <div className="w-6 h-6 rounded-full bg-[#2D1B33]/30 mx-auto mt-3.5" />
              <div className="w-8 h-6 bg-[#2D1B33]/18 mx-auto mt-0.5 rounded-t-md" />
            </div>
          </div>
          <div className="absolute right-[15%] top-[30%] w-28 h-28 rounded-full border-4 border-white overflow-hidden z-20" style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}>
            <div className="w-full h-full" style={{ background: 'linear-gradient(180deg, #a8dadc, #7ec8c8, #5ba8a8)' }}>
              <div className="w-9 h-9 rounded-full bg-[#2D1B33]/30 mx-auto mt-5" />
              <div className="w-14 h-8 bg-[#2D1B33]/18 mx-auto mt-0.5 rounded-t-lg" />
            </div>
          </div>
          <div className="absolute right-[5%] bottom-[10%] w-12 h-12 rounded-full border-2 border-white overflow-hidden z-0 opacity-40" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
            <div className="w-full h-full" style={{ background: 'linear-gradient(180deg, #fde68a, #f59e0b)' }}>
              <div className="w-4 h-4 rounded-full bg-[#2D1B33]/25 mx-auto mt-2" />
              <div className="w-6 h-4 bg-[#2D1B33]/15 mx-auto mt-0.5 rounded-t-md" />
            </div>
          </div>

        </div>

        {/* Footer logos */}
        <div className="flex justify-between items-center px-12 pt-12 pb-4 opacity-50 text-[10px] font-bold tracking-widest uppercase max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <span>Kingdom Advisors</span>
            <div className="w-3 h-3 bg-[#2D1B33]" />
          </div>
          <div className="flex gap-12">
            <span>MAPHHA</span>
            <span>@dipiasthiv</span>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Glassmorphism style helper ────────────────────────────

const chipGlass: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.4)',
  backdropFilter: 'blur(12px) saturate(180%)',
  WebkitBackdropFilter: 'blur(12px) saturate(180%)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  boxShadow: '0 8px 32px rgba(31, 38, 135, 0.08)',
}

// ── Problem statement — connected to hero ─────────────────

function ProblemStatement() {
  const { t } = useTranslation()

  return (
    <section className="relative w-full pt-16 pb-0" style={{ minHeight: '700px' }}>

      {/* Headline */}
      <div className="text-center z-10 relative">
        <h2 className="text-[clamp(2.2rem,5vw,4.5rem)] font-bold tracking-tight leading-[1.05] text-[#1a0a2e]">
          {t('landing.problemHeading')}
        </h2>
        <p className="text-lg text-gray-400 mt-3 max-w-lg mx-auto">
          {t('landing.problemSubtext')}
        </p>
      </div>

      {/* Phone + rings + chips container */}
      <div className="relative mx-auto mt-8 max-w-[1100px] h-[500px]">

        {/* ── Concentric rings — centered on phone ── */}
        <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-[40%] z-[5] pointer-events-none" style={{ width: '820px', height: '820px' }}>
          {[220, 340, 460, 580, 700, 820].map((size, i) => (
            <div key={i} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{
              width: `${size}px`, height: `${size}px`,
              border: `0.5px solid rgba(140,110,210,${0.10 - i * 0.012})`,
            }} />
          ))}
        </div>

        {/* ── Phone SVG mockup — centered ── */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10 w-[320px] md:w-[560px] pointer-events-none">
          <img
            src="/phone_mockup.svg"
            alt=""
            className="w-full h-auto"
            draggable={false}
            style={{ filter: 'drop-shadow(0 30px 60px rgba(30,10,80,0.20))' }}
          />
        </div>

        {/* ── Chips — randomly scattered ── */}

        {/* Like point — top-left area */}
        <div className="absolute top-[2%] left-[7%] z-[15] flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] text-[#2e1d5a]" style={{ ...chipGlass, transform: 'rotate(-3deg)' }}>
          <div className="w-[22px] h-[22px] rounded-full bg-[#ede8f9] flex items-center justify-center">
            <Users className="w-3 h-3 text-primary" />
          </div>
          {t('landing.collageSearch')}
          <div className="w-[26px] h-[26px] rounded-full shrink-0" style={{ background: 'linear-gradient(135deg, #c94b9e, #664FA1)' }} />
        </div>

        {/* X analysis — left side */}
        <div className="absolute top-[38%] left-[-8%] z-[15] flex flex-col gap-[5px] rounded-[14px] px-[13px] py-[9px] max-w-[200px] text-[11px]" style={{ ...chipGlass, transform: 'rotate(2deg)' }}>
          <div className="flex items-center gap-[7px]">
            <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center shrink-0">
              <svg className="w-[10px] h-[10px]" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </div>
            <span className="font-medium text-[11px] text-[#2e1d5a]">{t('landing.pillAnalyzeShort')}</span>
          </div>
          <span className="text-[10.5px] text-[#888] leading-[1.5]">{t('landing.pillAnalyzeDesc')}</span>
        </div>

        {/* Report products — bottom-left, tucked low */}
        <div className="absolute top-[68%] left-[4%] z-[15] flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] text-[#2e1d5a]" style={{ ...chipGlass, transform: 'rotate(-5deg)' }}>
          <div className="w-[22px] h-[22px] rounded-full bg-[#ff8c42] flex items-center justify-center">
            <BarChart3 className="w-[10px] h-[10px] text-white" />
          </div>
          {t('landing.collageTask')}
        </div>

        {/* Promote viral — far top-right corner */}
        <div className="absolute top-[0%] right-[2%] z-[15] flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] text-[#2e1d5a]" style={{ ...chipGlass, transform: 'rotate(5deg)' }}>
          <div className="w-[22px] h-[22px] rounded-full bg-[#ef4444] flex items-center justify-center">
            <TrendingUp className="w-[10px] h-[10px] text-white" />
          </div>
          {t('landing.pillPromote')}
        </div>

        {/* Sentiment score — mid-right, lower */}
        <div className="absolute top-[28%] right-[12%] z-[15] flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] text-[#2e1d5a]" style={{ ...chipGlass, transform: 'rotate(-3deg)' }}>
          <div className="w-[22px] h-[22px] rounded-full bg-primary flex items-center justify-center">
            <Sparkles className="w-[10px] h-[10px] text-white" />
          </div>
          {t('landing.chipSentiment')}
        </div>

        {/* Smart scheduling — bottom-right, wide gap from sentiment */}
        <div className="absolute top-[75%] right-[18%] z-[15] flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] text-[#2e1d5a]" style={{ ...chipGlass, transform: 'rotate(2deg)' }}>
          <div className="w-[22px] h-[22px] rounded-full bg-[#1d9e75] flex items-center justify-center">
            <RefreshCw className="w-[10px] h-[10px] text-white" />
          </div>
          {t('landing.chipSchedule')}
        </div>

      </div>
    </section>
  )
}

// ── Feature highlights (bento grid) ───────────────────────

function Features() {
  const { t } = useTranslation()

  return (
    <section id="features" className="py-20 px-6">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            {t('landing.featuresHeading')}
          </h2>
          <p className="text-gray-400 mt-3 max-w-xl mx-auto">
            {t('landing.featuresSubheading')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Large card — Sentiment Analysis */}
          <div className="md:col-span-7 glass bento-card rounded-2xl p-8 flex flex-col justify-between min-h-[260px]">
            <div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">{t('landing.featureSentiment')}</h3>
              <p className="text-sm text-gray-400 mt-2 max-w-md">{t('landing.featureSentimentDesc')}</p>
            </div>
            <div className="flex gap-2 mt-6">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">English</span>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">العربية</span>
              <span className="px-3 py-1 rounded-full bg-accent/20 text-foreground text-xs font-medium">XLM-RoBERTa</span>
            </div>
          </div>

          {/* Audience Segmentation */}
          <div className="md:col-span-5 glass bento-card rounded-2xl p-6 flex flex-col justify-between min-h-[260px]">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{t('landing.featureSegmentation')}</h3>
              <p className="text-sm text-gray-400 mt-1">{t('landing.featureSegmentationDesc')}</p>
            </div>
          </div>

          {/* Post & Reel Analysis */}
          <div className="md:col-span-4 glass bento-card rounded-2xl p-6">
            <div className="w-10 h-10 rounded-xl bg-cta/10 flex items-center justify-center mb-3">
              <MessageSquareText className="w-5 h-5 text-cta" />
            </div>
            <h3 className="text-base font-bold text-foreground">{t('landing.featurePosts')}</h3>
            <p className="text-sm text-gray-400 mt-1">{t('landing.featurePostsDesc')}</p>
          </div>

          {/* Content Recommendations */}
          <div className="md:col-span-4 glass bento-card rounded-2xl p-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <Lightbulb className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-base font-bold text-foreground">{t('landing.featureRecommendations')}</h3>
            <p className="text-sm text-gray-400 mt-1">{t('landing.featureRecommendationsDesc')}</p>
          </div>

          {/* Multi-account + Real-time sync side by side */}
          <div className="md:col-span-4 grid grid-rows-2 gap-4">
            <div className="glass bento-card rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                  <Building2 className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{t('landing.featureMultiAccount')}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t('landing.featureMultiAccountDesc')}</p>
                </div>
              </div>
            </div>
            <div className="glass bento-card rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cta/10 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-4.5 h-4.5 text-cta" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{t('landing.featureSync')}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t('landing.featureSyncDesc')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Pricing ───────────────────────────────────────────────

function Pricing() {
  const { t } = useTranslation()

  const plans = [
    {
      name: t('landing.planStarter'),
      price: t('landing.planFree'),
      cta: t('landing.ctaFree'),
      href: '/register',
      highlight: false,
      features: [
        { text: t('landing.starterF1'), locked: false },
        { text: t('landing.starterF2'), locked: false },
        { text: t('landing.starterF3'), locked: false },
        { text: t('landing.starterF4'), locked: true },
        { text: t('landing.starterF5'), locked: true },
        { text: t('landing.starterF6'), locked: true },
      ],
    },
    {
      name: t('landing.planInsights'),
      price: '$29',
      period: t('landing.perMonth'),
      cta: t('landing.ctaUpgrade'),
      href: '/register',
      highlight: true,
      features: [
        { text: t('landing.insightsF1'), locked: false },
        { text: t('landing.insightsF2'), locked: false },
        { text: t('landing.insightsF3'), locked: false },
        { text: t('landing.insightsF4'), locked: false },
        { text: t('landing.insightsF5'), locked: false },
        { text: t('landing.insightsF6'), locked: false },
      ],
    },
    {
      name: t('landing.planEnterprise'),
      price: t('landing.planCustom'),
      cta: t('landing.ctaContact'),
      href: '#',
      highlight: false,
      features: [
        { text: t('landing.enterpriseF1'), locked: false },
        { text: t('landing.enterpriseF2'), locked: false },
        { text: t('landing.enterpriseF3'), locked: false },
        { text: t('landing.enterpriseF4'), locked: false },
        { text: t('landing.enterpriseF5'), locked: false },
        { text: t('landing.enterpriseF6'), locked: false },
      ],
    },
  ]

  return (
    <section id="pricing" className="py-20 px-6">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            {t('landing.pricingHeading')}
          </h2>
          <p className="text-gray-400 mt-3">{t('landing.pricingSubheading')}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`bento-card rounded-2xl p-6 flex flex-col transition-all duration-300 ${
                plan.highlight
                  ? 'ring-2 ring-cta -translate-y-3 !shadow-[0_16px_56px_rgba(191,73,155,0.18)]'
                  : ''
              }`}
            >
              <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                {plan.period && <span className="text-sm text-gray-400">{plan.period}</span>}
              </div>

              <ul className="mt-6 space-y-3 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    {f.locked ? (
                      <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                    <span className={f.locked ? 'text-muted-foreground' : 'text-foreground'}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                to={plan.href}
                className={`mt-6 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 ${
                  plan.highlight
                    ? 'bg-cta text-cta-foreground'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────

function Footer() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'

  function toggleLang() {
    const next = isAr ? 'en' : 'ar'
    i18n.changeLanguage(next)
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
  }

  return (
    <footer className="py-12 px-6 mt-8" style={{ borderTop: '1px solid rgba(102, 79, 161, 0.08)' }}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-primary tracking-tight">BASIRET</span>
        </div>

        <div className="flex items-center gap-6 text-sm text-foreground/60">
          <a href="#features" className="hover:text-foreground transition-colors">
            {t('landing.navSolutions')}
          </a>
          <a href="#pricing" className="hover:text-foreground transition-colors">
            {t('landing.navPricing')}
          </a>
          <button onClick={toggleLang} className="hover:text-foreground transition-colors">
            {isAr ? 'English' : 'العربية'}
          </button>
        </div>

        <p className="text-xs text-foreground/40">
          {t('landing.copyright')}
        </p>
      </div>
    </footer>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="landing-canvas min-h-screen relative" style={{
      background: '#FDF9F0',
    }}>
      {/* Infinite canvas — mesh gradient matching reference */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Warm peach/salmon — left side */}
        <div className="absolute" style={{ top: '5%', left: '-10%', width: '65vw', height: '80vh', borderRadius: '50%', background: 'rgba(245, 170, 140, 0.65)', filter: 'blur(100px)' }} />
        {/* Hot pink — center-left */}
        <div className="absolute" style={{ top: '-5%', left: '20%', width: '50vw', height: '60vh', borderRadius: '50%', background: 'rgba(232, 150, 200, 0.50)', filter: 'blur(110px)' }} />
        {/* Teal/mint — right side, merged with green */}
        <div className="absolute" style={{ top: '10%', right: '-5%', width: '55vw', height: '80vh', borderRadius: '50%', background: 'rgba(160, 220, 210, 0.60)', filter: 'blur(110px)' }} />
      </div>
      <div className="relative z-[1]">
        <Navbar />
        <Hero />
        <ProblemStatement />
        <Features />
        <Pricing />
        <Footer />
      </div>
    </div>
  )
}
