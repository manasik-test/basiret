// My Posts screen — AI insights + example posts + engagement by type

const POSTS_DATA = {
  winner: {
    topic: 'ما الذي نجح',
    subtitle: 'أفضل منشور أدّى — ولماذا تفوّق',
    type: 'video',
    impressions: 23,
    comments: 0,
    likes: 187,
    reach: '4.2K',
    body: 'استخدم المنشور الأعلى أداءً صيغة فيديو، وهي أكثر جاذبية من الصور أو الكاروسيل. كانت التسمية مباشرة في دعوتها للعمل وأبرزت جودة الخدمة، مما أسهم في تفاعل أقوى مع الجمهور.',
    postTopic: 'تعرّف على الخدمة من الناس الصح 💧 تواصل معنا وخلِّ هذي البطولة لك نسبتك 💪',
    hashtags: '#مسقط #عمان #سارت_بولز #مسبح #صيف #muscat #pooldesign #oman #كسيلور #تواصل_سياحة',
    caption: 'Sparkling clean pools are our specialty! ✨ Let us bring the shine to your backyard. Ready for a dip? 🏊',
    captionTags: '#PoolCleaning #PoolMaintenance #SummerVibes #DreamPool',
  },
  loser: {
    topic: 'ما الذي ينبغي تغييره',
    subtitle: 'نمط يتكرر في منشوراتك الأقل أداءً',
    body: 'الاعتماد على صور ثابتة أو كاروسيل بتسميات طويلة دون دعوة واضحة للعمل. كثير من هذه المنشورات ركّزت على جانب "الفكرة" بدلاً من إظهار الفائدة أو الحل الفوري.',
    recommendation: 'اجعل الفيديو أولوية، واضمن أن كل تسمية تحتوي على دعوة عمل قصيرة ومباشرة في الجملة الأولى — مثل "تواصل الآن" أو "احجز موعدك اليوم".',
  },
  chart: [
    { type: 'video',    engagement: 4.8, posts: 12 },
    { type: 'carousel', engagement: 3.2, posts: 8 },
    { type: 'image',    engagement: 1.9, posts: 15 },
  ],
};

const MyPostsApp = () => {
  const [tweaksOn, setTweaksOn] = React.useState(false);
  const [lang, setLang] = React.useState('ar'); // ar | en

  React.useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__activate_edit_mode') setTweaksOn(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksOn(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <div dir="rtl" className="mp">
      <Sidebar active="posts" />

      <main className="mp-main">
        <header className="mp-head">
          <div>
            <div className="mp-crumb">
              <span>لوحة التحكم</span>
              <Icon path={I.chevL} size={10}/>
              <span>منشوراتي</span>
            </div>
            <div className="mp-titlerow">
              <h1 className="mp-title">منشوراتي</h1>
              <span className="mp-badge">
                <span className="mp-dot"/>
                آخر ٣٠ يوم
              </span>
            </div>
            <p className="mp-sub">أي منشور نجح، ولماذا، وما الذي ينبغي تغييره في القادم؟</p>
          </div>

          <div className="mp-head-act">
            <div className="mp-range">
              <button>٧ أيام</button>
              <button className="is-on">٣٠ يوم</button>
              <button>٩٠ يوم</button>
            </div>
            <button className="mp-export">
              <Icon path={I.pencil} size={13}/>
              تصدير التقرير
            </button>
          </div>
        </header>

        {/* AI Insights row removed */}

        <div className="mp-grid">
          {/* LOSER card */}
          <article className="mp-card mp-card--warn">
            <div className="mp-card-head">
              <div className="mp-card-icon mp-card-icon--warn">
                <Icon path={<><path d="M10.3 3.86l-8.14 13.5A2 2 0 003.86 20h16.28a2 2 0 001.71-2.64L13.7 3.86a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></>} size={16}/>
              </div>
              <div>
                <h3>{POSTS_DATA.loser.topic}</h3>
                <div className="mp-card-sub">{POSTS_DATA.loser.subtitle}</div>
              </div>
            </div>

            <div className="mp-quote mp-quote--warn">
              <div className="mp-quote-label">نمط في الأداء الضعيف</div>
              <p>{POSTS_DATA.loser.body}</p>
            </div>

            <div className="mp-quote mp-quote--tip">
              <div className="mp-quote-label">ما الذي ينبغي فعله</div>
              <p>{POSTS_DATA.loser.recommendation}</p>
            </div>
          </article>

          {/* WINNER card */}
          <article className="mp-card mp-card--good">
            <div className="mp-card-head">
              <div className="mp-card-icon mp-card-icon--good">
                <Icon path={I.trend} size={16}/>
              </div>
              <div>
                <h3>{POSTS_DATA.winner.topic}</h3>
                <div className="mp-card-sub">{POSTS_DATA.winner.subtitle}</div>
              </div>
            </div>

            <div className="mp-post-preview">
              <div className="mp-post-meta">
                <TypePill type="video" size="sm"/>
                <span className="mp-post-stat num"><Icon path={I.trend} size={11}/> {POSTS_DATA.winner.impressions}٪ تفاعل</span>
                <span className="mp-post-stat num">{POSTS_DATA.winner.likes} إعجاب</span>
                <span className="mp-post-stat num">{POSTS_DATA.winner.reach} وصول</span>
              </div>
              <div className="mp-post-body">{POSTS_DATA.winner.postTopic}</div>
              <div className="mp-post-tags">{POSTS_DATA.winner.hashtags}</div>
            </div>

            <div className="mp-quote mp-quote--good">
              <div className="mp-quote-label">السبب</div>
              <p>{POSTS_DATA.winner.body}</p>
            </div>

            <button className="mp-cta">
              <Icon path={I.wand} size={14}/>
              أنشئ تسمية توضيحية مشابهة
            </button>

            <div className="mp-cap-block">
              <div className="mp-cap-head">
                <span>تسمية مقترحة (English)</span>
                <button className="mp-cap-lang">
                  <Icon path={<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></>} size={10}/>
                  نسخ
                </button>
              </div>
              <div className="mp-cap-text">
                {POSTS_DATA.winner.caption}
                <div className="mp-cap-tags">{POSTS_DATA.winner.captionTags}</div>
              </div>
              <button className="mp-cap-share">
                <span>فتح على إنستغرام</span>
                <Icon path={<><path d="M7 17L17 7M17 7H8M17 7v9"/></>} size={11}/>
              </button>
            </div>
          </article>
        </div>

        {/* Supporting data banner */}
        <div className="mp-data-divider">
          <span className="mp-data-label">
            <Icon path={<><rect x="3" y="10" width="4" height="11" rx="1"/><rect x="10" y="5" width="4" height="16" rx="1"/><rect x="17" y="13" width="4" height="8" rx="1"/></>} size={12}/>
            بيانات داعمة
          </span>
          <div className="mp-data-line"/>
        </div>

        {/* Chart */}
        <section className="mp-chart-card">
          <div className="mp-chart-head">
            <div>
              <h2 className="mp-chart-title">التفاعل حسب نوع المحتوى</h2>
              <p className="mp-chart-sub">متوسط الإعجابات والتعليقات لكل نوع محتوى</p>
            </div>
            <div className="mp-chart-legend">
              {POSTS_DATA.chart.map(c => (
                <span key={c.type} className="mp-leg">
                  <span className="mp-leg-dot" style={{background: TYPE_META[c.type].color}}/>
                  {TYPE_META[c.type].ar} <span className="num">·</span> <span className="num mp-leg-n">{c.posts}</span>
                </span>
              ))}
            </div>
          </div>

          <EngagementChart data={POSTS_DATA.chart}/>
        </section>
      </main>

      {tweaksOn && <MPTweaks lang={lang} setLang={setLang}/>}

      <style>{`
        .mp { display: flex; min-height: 100vh; background: var(--canvas); }
        .mp-main { flex: 1; padding: 32px 40px 48px; display: flex; flex-direction: column; gap: 22px; max-width: 1480px; }

        .mp-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
        .mp-crumb { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-500); margin-bottom: 10px; font-weight: 500; }
        .mp-crumb > :nth-child(2) { color: var(--ink-300); }
        .mp-titlerow { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .mp-title { font-size: 30px; font-weight: 700; color: var(--ink-950); letter-spacing: -0.02em; margin: 0; line-height: 1.15; }
        .mp-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 99px; background: var(--purple-50); color: var(--purple-700); font-size: 12px; font-weight: 600; }
        .mp-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--purple-500); box-shadow: 0 0 0 3px rgba(124,92,239,.2); }
        .mp-sub { font-size: 13.5px; color: var(--ink-500); margin: 0; max-width: 560px; line-height: 1.55; }

        .mp-head-act { display: flex; gap: 10px; align-items: center; }
        .mp-range { display: flex; background: var(--ink-100); border-radius: 10px; padding: 3px; }
        .mp-range button { padding: 7px 14px; font-size: 12.5px; font-weight: 500; border-radius: 7px; color: var(--ink-600); }
        .mp-range button.is-on { background: var(--surface); color: var(--ink-900); box-shadow: var(--shadow-sm); font-weight: 600; }
        .mp-export { display: flex; align-items: center; gap: 7px; padding: 10px 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; font-size: 13px; font-weight: 500; color: var(--ink-800); }
        .mp-export:hover { border-color: var(--line-strong); }

        .mp-insights-head { display: flex; justify-content: space-between; align-items: center; }
        .mp-in-label { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: var(--ink-800); }
        .mp-spark { width: 24px; height: 24px; border-radius: 8px; background: linear-gradient(135deg, var(--purple-400), var(--purple-600)); color: #fff; display: grid; place-items: center; }
        .mp-pill-live { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; color: var(--purple-700); font-weight: 600; background: var(--purple-50); padding: 3px 8px; border-radius: 99px; }
        .mp-pill-live span { width: 6px; height: 6px; border-radius: 50%; background: var(--purple-500); animation: mp-pulse 1.8s ease-in-out infinite; }
        @keyframes mp-pulse { 50% { opacity: 0.4; } }
        .mp-in-refresh { font-size: 12px; color: var(--ink-600); padding: 6px 12px; border-radius: 8px; }
        .mp-in-refresh:hover { background: var(--ink-100); color: var(--ink-900); }

        /* CARDS */
        .mp-grid { display: grid; grid-template-columns: 1fr 1.1fr; gap: 18px; }
        .mp-card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 24px;
          display: flex; flex-direction: column;
          gap: 16px;
          position: relative;
          overflow: hidden;
        }
        .mp-card::before {
          content: '';
          position: absolute; top: 0; inset-inline: 0;
          height: 3px;
        }
        .mp-card--good::before { background: linear-gradient(90deg, oklch(0.7 0.16 155), oklch(0.6 0.18 160)); }
        .mp-card--warn::before { background: linear-gradient(90deg, oklch(0.75 0.12 85), oklch(0.7 0.14 55)); }

        .mp-card-head { display: flex; gap: 12px; align-items: center; }
        .mp-card-icon { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; }
        .mp-card-icon--good { background: oklch(0.95 0.05 155); color: oklch(0.45 0.15 155); }
        .mp-card-icon--warn { background: oklch(0.96 0.05 85); color: oklch(0.55 0.15 60); }
        .mp-card-head h3 { font-size: 17px; font-weight: 700; color: var(--ink-950); margin: 0 0 3px; letter-spacing: -0.01em; }
        .mp-card-sub { font-size: 12px; color: var(--ink-500); font-weight: 500; }

        .mp-quote { padding: 14px 16px; border-radius: 12px; font-size: 13.5px; line-height: 1.7; color: var(--ink-800); text-wrap: pretty; }
        .mp-quote p { margin: 0; }
        .mp-quote-label { font-size: 10.5px; font-weight: 700; text-transform: none; letter-spacing: 0.02em; margin-bottom: 6px; }
        .mp-quote--good { background: oklch(0.97 0.025 155); }
        .mp-quote--good .mp-quote-label { color: oklch(0.45 0.15 155); }
        .mp-quote--warn { background: oklch(0.97 0.025 85); }
        .mp-quote--warn .mp-quote-label { color: oklch(0.55 0.15 60); }
        .mp-quote--tip { background: var(--ink-50); }
        .mp-quote--tip .mp-quote-label { color: var(--ink-700); }

        /* Winner post preview */
        .mp-post-preview { background: var(--ink-50); border: 1px solid var(--line); border-radius: 12px; padding: 14px; }
        .mp-post-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
        .mp-post-stat { font-size: 11px; color: var(--ink-500); font-weight: 500; display: inline-flex; align-items: center; gap: 4px; }
        .mp-post-body { font-size: 13.5px; color: var(--ink-900); line-height: 1.7; font-weight: 500; margin-bottom: 8px; }
        .mp-post-tags { font-size: 11.5px; color: var(--purple-700); line-height: 1.7; font-weight: 500; letter-spacing: -0.005em; word-break: break-word; }

        .mp-cta {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px; width: 100%;
          background: var(--purple-600); color: #fff;
          border-radius: 10px; font-size: 13.5px; font-weight: 600;
          box-shadow: 0 6px 16px -6px rgba(99,65,224,.55), inset 0 1px 0 rgba(255,255,255,.15);
          transition: background 0.12s, transform 0.12s;
        }
        .mp-cta:hover { background: var(--purple-700); transform: translateY(-1px); }

        .mp-cap-block { background: var(--purple-50); border: 1px solid var(--purple-200); border-radius: 12px; padding: 14px; }
        .mp-cap-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 11px; font-weight: 700; color: var(--purple-800); }
        .mp-cap-lang { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 500; color: var(--purple-700); padding: 3px 8px; border-radius: 6px; }
        .mp-cap-lang:hover { background: var(--purple-100); }
        .mp-cap-text { font-size: 13.5px; color: var(--ink-900); line-height: 1.65; font-weight: 500; direction: ltr; text-align: left; }
        .mp-cap-tags { margin-top: 8px; font-size: 12.5px; color: var(--purple-700); font-weight: 500; }
        .mp-cap-share { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; color: var(--purple-700); margin-top: 10px; padding: 4px 0; }
        .mp-cap-share:hover { color: var(--purple-900); }

        /* Data divider */
        .mp-data-divider { display: flex; align-items: center; gap: 14px; margin-top: 10px; }
        .mp-data-label { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: var(--ink-600); }
        .mp-data-line { flex: 1; height: 1px; background: var(--line); }

        /* Chart card */
        .mp-chart-card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 24px 28px 28px; }
        .mp-chart-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-bottom: 20px; flex-wrap: wrap; }
        .mp-chart-title { font-size: 18px; font-weight: 700; color: var(--ink-950); letter-spacing: -0.01em; margin: 0 0 4px; }
        .mp-chart-sub { font-size: 12.5px; color: var(--ink-500); margin: 0; }
        .mp-chart-legend { display: flex; gap: 18px; flex-wrap: wrap; }
        .mp-leg { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--ink-700); font-weight: 500; }
        .mp-leg-dot { width: 10px; height: 10px; border-radius: 3px; }
        .mp-leg-n { color: var(--ink-900); font-weight: 700; }
      `}</style>
    </div>
  );
};

// Horizontal bar chart — cleaner than bars, reads left-to-right in RTL
const EngagementChart = ({ data }) => {
  const max = Math.max(...data.map(d => d.engagement));
  return (
    <div className="mp-chart">
      {data.map((d, i) => {
        const pct = (d.engagement / max) * 100;
        const m = TYPE_META[d.type];
        return (
          <div key={i} className="mp-bar-row">
            <div className="mp-bar-label">
              <TypeIcon type={d.type} size={13}/>
              <span>{m.ar}</span>
            </div>
            <div className="mp-bar-track">
              <div
                className="mp-bar-fill"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(to left, ${m.color}, color-mix(in oklch, ${m.color} 70%, white))`,
                }}
              />
              <span className="mp-bar-val num">{d.engagement}٪</span>
            </div>
            <div className="mp-bar-posts num">{d.posts} منشور</div>
          </div>
        );
      })}
      <style>{`
        .mp-chart { display: flex; flex-direction: column; gap: 14px; }
        .mp-bar-row { display: grid; grid-template-columns: 100px 1fr 90px; align-items: center; gap: 16px; }
        .mp-bar-label { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--ink-800); }
        .mp-bar-label svg { color: var(--ink-600); }
        .mp-bar-track { position: relative; height: 32px; background: var(--ink-50); border-radius: 10px; overflow: hidden; }
        .mp-bar-fill { position: absolute; inset: 0 0 0 auto; height: 100%; border-radius: 10px; transition: width 0.4s cubic-bezier(.2,.8,.2,1); }
        .mp-bar-val { position: absolute; inset-inline-start: 12px; top: 50%; transform: translateY(-50%); font-size: 12.5px; font-weight: 700; color: var(--ink-900); letter-spacing: -0.01em; }
        .mp-bar-posts { font-size: 11.5px; color: var(--ink-500); font-weight: 500; text-align: start; }
      `}</style>
    </div>
  );
};

const MPTweaks = ({ lang, setLang }) => (
  <div dir="rtl" className="tw">
    <div className="tw-head">
      <div>
        <div className="tw-title">Tweaks</div>
        <div className="tw-sub">إعدادات الشاشة</div>
      </div>
    </div>

    <div className="tw-row">
      <label>لغة التسميات المقترحة</label>
      <div className="tw-seg">
        <button className={lang==='ar'?'is-on':''} onClick={() => setLang('ar')}>العربية</button>
        <button className={lang==='en'?'is-on':''} onClick={() => setLang('en')}>English</button>
      </div>
    </div>

    <div className="tw-row" style={{fontSize: 11, color: 'var(--ink-500)'}}>
      تلميح: استخدم شاشة <strong style={{color: 'var(--ink-800)'}}>خطة المحتوى</strong> لمزيد من الخيارات (الكثافة، لون العلامة، نبرة الكتابة).
    </div>

    <style>{`
      .tw { position: fixed; bottom: 20px; inset-inline-start: 20px; width: 280px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 18px; box-shadow: var(--shadow-lg); z-index: 1000; display: flex; flex-direction: column; gap: 16px; }
      .tw-title { font-size: 14px; font-weight: 700; color: var(--ink-950); }
      .tw-sub { font-size: 11px; color: var(--ink-500); margin-top: 2px; }
      .tw-row label { display: block; font-size: 11px; font-weight: 600; color: var(--ink-700); margin-bottom: 8px; }
      .tw-seg { display: flex; background: var(--ink-100); border-radius: 9px; padding: 3px; }
      .tw-seg button { flex: 1; padding: 7px; font-size: 12px; font-weight: 500; border-radius: 6px; color: var(--ink-600); }
      .tw-seg button.is-on { background: var(--surface); color: var(--ink-900); box-shadow: var(--shadow-sm); font-weight: 600; }
    `}</style>
  </div>
);

window.MyPostsApp = MyPostsApp;
