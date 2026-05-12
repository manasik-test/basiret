// Audience (جمهوري) redesign — two directions on a canvas
// Consistent purple system. Focus: content preferences per segment.
// Human persona names. Single hero AI takeaway.

const AUDIENCE_DATA = {
  aiTake: {
    headline: 'جمهورك ينقسم إلى ٤ شخصيات واضحة',
    body: 'أكبر مجموعة (٢٢ شخص) هي "هواة الفيديو بعد الظهر" — يتفاعلون أكثر مع الفيديوهات القصيرة بين ٢ و ٥ مساءً. ركّز محتوى هذا الأسبوع عليهم.',
    metric: '٤٢ شخص',
    metricLbl: 'إجمالي الجمهور النشط',
  },
  segments: [
    {
      id: 's1',
      size: 22,
      pct: 52,
      name: 'سالم — هاوي الفيديو',
      persona: 'متابع نشط يفضّل الفيديوهات القصيرة بعد الظهر',
      palette: 'violet',
      emoji: '🎥',
      time: 'الثلاثاء ٤م',
      prefers: [
        { type: 'video', pct: 78 },
        { type: 'carousel', pct: 15 },
        { type: 'image', pct: 7 },
      ],
      topics: ['نصائح سريعة', 'قبل/بعد', 'وراء الكواليس'],
      engagement: 'عالي',
      trend: 'up',
      delta: '+٨',
      mood: 'positive',
    },
    {
      id: 's2',
      size: 14,
      pct: 33,
      name: 'ليلى — مشاهدة الصور الصباحية',
      persona: 'تتصفّح الصور الملهمة قبل الدوام — ردود فعل قصيرة',
      palette: 'sky',
      emoji: '☀️',
      time: 'الأحد ٨ص',
      prefers: [
        { type: 'image', pct: 62 },
        { type: 'carousel', pct: 28 },
        { type: 'video', pct: 10 },
      ],
      topics: ['اقتباسات', 'لحظات يومية', 'جمال بصري'],
      engagement: 'متوسط',
      trend: 'flat',
      delta: '±٠',
      mood: 'neutral',
    },
    {
      id: 's3',
      size: 4,
      pct: 10,
      name: 'خالد — باحث الفيديو الصباحي',
      persona: 'شريحة صغيرة تفتح الفيديو صباحاً بحثاً عن معلومة',
      palette: 'mint',
      emoji: '☕',
      time: 'الإثنين ٧ص',
      prefers: [
        { type: 'video', pct: 70 },
        { type: 'image', pct: 20 },
        { type: 'carousel', pct: 10 },
      ],
      topics: ['شرح خطوة بخطوة', 'ملخصات', 'تحديثات'],
      engagement: 'منخفض',
      trend: 'down',
      delta: '-٣',
      mood: 'warn',
    },
    {
      id: 's4',
      size: 2,
      pct: 5,
      name: 'نورة — متابعة الكاروسيل',
      persona: 'تتعمّق في المحتوى المتعدد الصفحات — قراء طويلة النفس',
      palette: 'peach',
      emoji: '📚',
      time: 'الجمعة ٧م',
      prefers: [
        { type: 'carousel', pct: 80 },
        { type: 'image', pct: 15 },
        { type: 'video', pct: 5 },
      ],
      topics: ['دروس مفصّلة', 'قصص عملاء', 'قوائم'],
      engagement: 'متوسط',
      trend: 'up',
      delta: '+١',
      mood: 'positive',
    },
  ],
};

const PALETTE = {
  violet: { bg: 'oklch(0.95 0.04 285)',  fg: 'var(--purple-700)', solid: 'var(--purple-500)' },
  sky:    { bg: 'oklch(0.95 0.04 230)',  fg: 'oklch(0.45 0.15 230)', solid: 'oklch(0.68 0.14 230)' },
  mint:   { bg: 'oklch(0.95 0.04 170)',  fg: 'oklch(0.42 0.13 170)', solid: 'oklch(0.65 0.13 170)' },
  peach:  { bg: 'oklch(0.95 0.04 50)',   fg: 'oklch(0.48 0.14 45)',  solid: 'oklch(0.72 0.14 55)' },
};

// Shared: AI hero card
const AudHero = () => (
  <section className="aud-hero">
    <div className="aud-hero-l">
      <div className="aud-hero-k">✦ خلاصة بصيرة</div>
      <h2>{AUDIENCE_DATA.aiTake.headline}</h2>
      <p>{AUDIENCE_DATA.aiTake.body}</p>
      <div className="aud-hero-acts">
        <button className="aud-hero-btn primary">
          <Icon path={I.wand} size={13}/>
          أنشئ لهذه الشريحة
        </button>
        <button className="aud-hero-btn ghost">استكشف التفاصيل ↩</button>
      </div>
    </div>
    <div className="aud-hero-r">
      <div className="aud-hero-num">
        <div className="num">{AUDIENCE_DATA.aiTake.metric}</div>
        <div>{AUDIENCE_DATA.aiTake.metricLbl}</div>
      </div>
      <div className="aud-hero-segs">
        {AUDIENCE_DATA.segments.map(s => (
          <div key={s.id} className="aud-hero-seg" style={{width:`${s.pct}%`, background:PALETTE[s.palette].solid}} title={s.name}/>
        ))}
      </div>
      <div className="aud-hero-legend">
        {AUDIENCE_DATA.segments.map(s => (
          <div key={s.id} className="aud-hero-l-i">
            <span style={{background:PALETTE[s.palette].solid}}/>
            <span className="num">{s.pct}٪</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// =========================================================
// A — Persona cards (grid)
// =========================================================
const AudienceA = () => (
  <div dir="rtl" className="aud">
    <Sidebar active="audience"/>
    <main className="aud-main">
      <header className="aud-head">
        <div>
          <h1>جمهوري</h1>
          <p>من يتابعك، ماذا يحبّون، ومتى يتفاعلون — آخر ٣٠ يوم</p>
        </div>
        <div className="aud-seg">
          <button>٧ أيام</button>
          <button className="is-on">٣٠ يوم</button>
          <button>٩٠ يوم</button>
        </div>
      </header>

      <AudHero/>

      <div className="aud-sec-head">
        <h3>الشخصيات الأربع</h3>
        <span className="aud-sec-s">مرتّبة حسب الحجم</span>
      </div>

      <section className="aud-grid">
        {AUDIENCE_DATA.segments.map(s => {
          const p = PALETTE[s.palette];
          return (
            <article key={s.id} className="aud-card" style={{'--acc-bg':p.bg, '--acc-fg':p.fg, '--acc':p.solid}}>
              <div className="aud-card-top">
                <div className="aud-avatar" style={{background:p.bg, color:p.fg}}>{s.emoji}</div>
                <div className="aud-card-t">
                  <div className="aud-card-n">{s.name}</div>
                  <div className="aud-card-p">{s.persona}</div>
                </div>
                <div className="aud-card-size">
                  <div className="num">{s.size}</div>
                  <em>{s.pct}٪</em>
                </div>
              </div>

              <div className="aud-card-row">
                <div className="aud-card-k">يفضّلون</div>
                <div className="aud-card-bars">
                  {s.prefers.map((pr,i) => {
                    const m = TYPE_META[pr.type];
                    return (
                      <div key={i} className="aud-pref">
                        <div className="aud-pref-lbl"><TypeIcon type={pr.type} size={11}/> {m.ar}</div>
                        <div className="aud-pref-bar"><div style={{width:`${pr.pct}%`, background:m.color}}/></div>
                        <div className="num aud-pref-p">{pr.pct}٪</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="aud-card-row aud-card-row--grid">
                <div>
                  <div className="aud-card-k">أفضل وقت</div>
                  <div className="aud-card-v num">{s.time}</div>
                </div>
                <div>
                  <div className="aud-card-k">تفاعل</div>
                  <div className="aud-card-v">
                    {s.engagement}
                    <span className={`aud-delta ${s.mood}`}>
                      {s.trend==='up'?'↑':s.trend==='down'?'↓':'→'} <span className="num">{s.delta}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="aud-card-topics">
                <div className="aud-card-k">يحبّون قراءة عن</div>
                <div className="aud-topics">
                  {s.topics.map(t => <span key={t}>{t}</span>)}
                </div>
              </div>

              <button className="aud-card-cta">
                <Icon path={I.wand} size={12}/>
                أنشئ محتوى لـ{s.name.split(' — ')[0]}
              </button>
            </article>
          );
        })}
      </section>
      <MPGAskFab />
    </main>

    <style>{styles}</style>
  </div>
);

// =========================================================
// B — Editorial ranked list
// =========================================================
const AudienceB = () => {
  const [open, setOpen] = React.useState(null);
  const [range, setRange] = React.useState('30');
  return (
  <div dir="rtl" className="aud aud--b">
    <Sidebar active="audience"/>
    <main className="aud-main">
      <header className="aud-head">
        <div>
          <h1>جمهوري</h1>
          <p>من يتابعك، ماذا يحبّون، ومتى يتفاعلون — آخر {range==='7'?'٧ أيام':range==='30'?'٣٠ يوم':'٩٠ يوم'}</p>
        </div>
        <div className="aud-seg">
          {[['7','٧ أيام'],['30','٣٠ يوم'],['90','٩٠ يوم']].map(([v,l]) => (
            <button key={v} className={range===v?'is-on':''} onClick={()=>setRange(v)}>{l}</button>
          ))}
        </div>
      </header>

      <AudHero/>

      <div className="aud-sec-head">
        <h3>الشخصيات مرتّبة حسب الحجم</h3>
        <span className="aud-sec-s">انقر لرؤية المواضيع المفضّلة</span>
      </div>

      <section className="aud-list">
        {AUDIENCE_DATA.segments.map((s, i) => {
          const p = PALETTE[s.palette];
          const isOpen = open === s.id;
          return (
            <article
              key={s.id}
              className="aud-row"
              data-open={isOpen ? '' : undefined}
              onClick={() => setOpen(isOpen ? null : s.id)}
              style={{'--acc-bg':p.bg, '--acc-fg':p.fg, '--acc':p.solid}}
            >
              <div className="aud-row-rank num">{['١','٢','٣','٤'][i]}</div>
              <div className="aud-row-avatar" style={{background:p.bg, color:p.fg}}>{s.emoji}</div>
              <div className="aud-row-ident">
                <div className="aud-row-n">{s.name}</div>
                <div className="aud-row-p">{s.persona}</div>
              </div>
              <div className="aud-row-size">
                <div className="aud-row-sv num">{s.size}</div>
                <div className="aud-row-sp">
                  <div className="aud-row-sb"><div style={{width:`${s.pct}%`, background:p.solid}}/></div>
                  <span className="num">{s.pct}٪</span>
                </div>
              </div>
              <div className="aud-row-prefs">
                <div className="aud-row-k">يفضّلون</div>
                <div className="aud-row-pf">
                  {s.prefers.map((pr,j)=>{
                    const m = TYPE_META[pr.type];
                    return (
                      <div key={j} className="aud-row-pi">
                        <TypeIcon type={pr.type} size={10}/>
                        <span>{m.ar}</span>
                        <b className="num">{pr.pct}٪</b>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="aud-row-when">
                <div className="aud-row-k">أفضل وقت</div>
                <div className="aud-row-wv num">{s.time}</div>
              </div>
              <div className="aud-row-eng">
                <div className="aud-row-k">تفاعل</div>
                <div className="aud-row-ev">
                  {s.engagement}
                  <span className={`aud-delta ${s.mood}`}>
                    {s.trend==='up'?'↑':s.trend==='down'?'↓':'→'} <span className="num">{s.delta}</span>
                  </span>
                </div>
              </div>
              <button className="aud-row-cta" onClick={(e)=>e.stopPropagation()}>أنشئ لهم <Icon path={I.wand} size={11}/></button>
              {isOpen && (
                <div className="aud-row-ex">
                  <div className="aud-row-k">يحبّون قراءة عن</div>
                  <div className="aud-topics">
                    {s.topics.map(t => <span key={t}>{t}</span>)}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
      <MPGAskFab />
    </main>
    <style>{styles}</style>
  </div>
  );
};

const styles = `
.aud { display:flex; min-height:100vh; background:var(--canvas); }
.aud-main { flex:1; padding:28px 36px 40px; display:flex; flex-direction:column; gap:22px; max-width:1480px; }
.aud-head { display:flex; justify-content:space-between; align-items:flex-end; }
.aud-head h1 { font-size:26px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; margin:0 0 3px; }
.aud-head p { font-size:12.5px; color:var(--ink-500); margin:0; }
.aud-seg { display:flex; background:var(--ink-100); border-radius:10px; padding:3px; }
.aud-seg button { padding:7px 14px; font-size:12.5px; border-radius:7px; color:var(--ink-600); font-weight:500; }
.aud-seg button.is-on { background:var(--surface); color:var(--ink-900); font-weight:600; box-shadow:var(--shadow-sm); }

/* Hero */
.aud-hero { display:grid; grid-template-columns:1.3fr 1fr; gap:28px; background:linear-gradient(135deg, var(--purple-50), oklch(0.97 0.03 280)); border:1px solid var(--purple-200); border-radius:20px; padding:26px 30px; align-items:center; }
.aud-hero-k { font-size:11px; font-weight:700; color:var(--purple-700); letter-spacing:0.04em; text-transform:uppercase; margin-bottom:10px; }
.aud-hero h2 { font-size:22px; font-weight:700; color:var(--ink-950); margin:0 0 10px; letter-spacing:-0.015em; line-height:1.35; text-wrap:balance; }
.aud-hero p { font-size:13.5px; color:var(--ink-700); line-height:1.7; margin:0 0 16px; max-width:540px; text-wrap:pretty; }
.aud-hero-acts { display:flex; gap:8px; }
.aud-hero-btn { padding:9px 14px; border-radius:10px; font-size:12.5px; font-weight:600; display:inline-flex; align-items:center; gap:5px; }
.aud-hero-btn.primary { background:var(--purple-600); color:#fff; }
.aud-hero-btn.ghost { background:transparent; color:var(--purple-800); }
.aud-hero-r { background:var(--surface); border-radius:14px; padding:18px; }
.aud-hero-num { text-align:start; margin-bottom:14px; }
.aud-hero-num .num { font-size:28px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; line-height:1; }
.aud-hero-num > div:last-child { font-size:11.5px; color:var(--ink-500); font-weight:500; margin-top:4px; }
.aud-hero-segs { display:flex; gap:3px; height:14px; margin-bottom:10px; }
.aud-hero-seg { border-radius:3px; transition:opacity .15s; }
.aud-hero-seg:hover { opacity:.8; }
.aud-hero-legend { display:flex; gap:12px; justify-content:space-between; }
.aud-hero-l-i { display:flex; gap:5px; align-items:center; font-size:11px; color:var(--ink-600); font-weight:500; }
.aud-hero-l-i span:first-child { width:8px; height:8px; border-radius:2px; }

/* Section header */
.aud-sec-head { display:flex; justify-content:space-between; align-items:baseline; margin-top:6px; }
.aud-sec-head h3 { font-size:16px; font-weight:700; color:var(--ink-950); margin:0; letter-spacing:-0.01em; }
.aud-sec-s { font-size:12px; color:var(--ink-500); font-weight:500; }

/* === A — Cards === */
.aud-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:16px; }
.aud-card { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:22px; display:flex; flex-direction:column; gap:16px; position:relative; overflow:hidden; }
.aud-card::before { content:''; position:absolute; top:0; inset-inline-start:0; height:3px; width:100%; background:var(--acc); }
.aud-card-top { display:flex; gap:14px; align-items:center; }
.aud-avatar { width:52px; height:52px; border-radius:14px; display:grid; place-items:center; font-size:22px; flex-shrink:0; }
.aud-card-t { flex:1; }
.aud-card-n { font-size:15px; font-weight:700; color:var(--ink-950); margin-bottom:2px; letter-spacing:-0.005em; }
.aud-card-p { font-size:12px; color:var(--ink-600); line-height:1.45; text-wrap:pretty; }
.aud-card-size { text-align:center; flex-shrink:0; padding-inline-start:12px; border-inline-start:1px solid var(--line); }
.aud-card-size .num { font-size:24px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; line-height:1; }
.aud-card-size em { font-style:normal; font-size:11px; color:var(--ink-500); font-weight:500; display:block; margin-top:4px; font-family:var(--mono); }

.aud-card-row { display:flex; flex-direction:column; gap:8px; }
.aud-card-row--grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.aud-card-k { font-size:11px; font-weight:600; color:var(--ink-500); letter-spacing:0.02em; }
.aud-card-v { font-size:13.5px; font-weight:600; color:var(--ink-950); display:flex; align-items:center; gap:8px; }

.aud-card-bars { display:flex; flex-direction:column; gap:6px; }
.aud-pref { display:grid; grid-template-columns:80px 1fr 36px; align-items:center; gap:10px; font-size:11.5px; color:var(--ink-700); }
.aud-pref-lbl { display:inline-flex; align-items:center; gap:5px; font-weight:500; }
.aud-pref-bar { height:6px; background:var(--ink-100); border-radius:99px; overflow:hidden; }
.aud-pref-bar > div { height:100%; border-radius:99px; transition:width .5s; }
.aud-pref-p { font-weight:700; color:var(--ink-900); text-align:start; letter-spacing:-0.005em; }

.aud-delta { font-size:11px; font-weight:700; padding:2px 7px; border-radius:99px; }
.aud-delta.positive { color:oklch(0.45 0.15 155); background:oklch(0.96 0.05 155); }
.aud-delta.warn { color:oklch(0.55 0.18 30); background:oklch(0.97 0.04 30); }
.aud-delta.neutral { color:var(--ink-600); background:var(--ink-100); }

.aud-card-topics { display:flex; flex-direction:column; gap:8px; }
.aud-topics { display:flex; flex-wrap:wrap; gap:6px; }
.aud-topics span { padding:4px 10px; background:var(--acc-bg); color:var(--acc-fg); border-radius:99px; font-size:11.5px; font-weight:500; }

.aud-card-cta { padding:11px; background:var(--ink-900); color:#fff; border-radius:10px; font-size:12.5px; font-weight:600; display:inline-flex; align-items:center; justify-content:center; gap:6px; margin-top:auto; }
.aud-card-cta:hover { background:var(--ink-800); }

/* === B — List === */
.aud-list { display:flex; flex-direction:column; gap:10px; }
.aud-row { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:18px 22px; display:grid; grid-template-columns:28px 52px 1.4fr 1fr 1.3fr 0.9fr 0.8fr auto; gap:22px; align-items:center; position:relative; overflow:hidden; cursor:pointer; transition:border-color .15s, box-shadow .15s; }
.aud-row:hover { border-color:var(--acc); box-shadow:0 2px 12px -6px var(--acc); }
.aud-row[data-open] { border-color:var(--acc); box-shadow:0 4px 20px -10px var(--acc); }
.aud-row-ex { grid-column:1 / -1; border-top:1px dashed var(--line); padding-top:14px; margin-top:4px; display:flex; flex-direction:column; gap:8px; animation:audfade .2s ease-out; }
@keyframes audfade { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
.aud-topics { display:flex; flex-wrap:wrap; gap:6px; }
.aud-topics span { padding:4px 10px; background:var(--acc-bg); color:var(--acc-fg); border-radius:99px; font-size:11.5px; font-weight:500; }
.aud-row::before { content:''; position:absolute; top:0; bottom:0; inset-inline-start:0; width:3px; background:var(--acc); }
.aud-row-rank { font-size:15px; font-weight:700; color:var(--ink-400); text-align:center; letter-spacing:-0.01em; }
.aud-row-avatar { width:48px; height:48px; border-radius:12px; display:grid; place-items:center; font-size:20px; flex-shrink:0; }
.aud-row-ident { min-width:0; }
.aud-row-n { font-size:14px; font-weight:700; color:var(--ink-950); letter-spacing:-0.005em; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.aud-row-p { font-size:11.5px; color:var(--ink-600); line-height:1.4; text-wrap:pretty; }

.aud-row-size { display:flex; flex-direction:column; gap:6px; }
.aud-row-sv { font-size:20px; font-weight:700; color:var(--ink-950); letter-spacing:-0.015em; line-height:1; }
.aud-row-sp { display:flex; align-items:center; gap:8px; }
.aud-row-sb { flex:1; height:5px; background:var(--ink-100); border-radius:99px; overflow:hidden; }
.aud-row-sb > div { height:100%; border-radius:99px; }
.aud-row-sp .num { font-size:11px; color:var(--ink-600); font-weight:600; }

.aud-row-k { font-size:10.5px; font-weight:600; color:var(--ink-500); letter-spacing:0.02em; margin-bottom:6px; }
.aud-row-pf { display:flex; flex-direction:column; gap:4px; }
.aud-row-pi { display:flex; align-items:center; gap:5px; font-size:11px; color:var(--ink-700); }
.aud-row-pi b { color:var(--ink-950); font-weight:700; margin-inline-start:auto; font-size:11.5px; }

.aud-row-wv { font-size:13px; font-weight:600; color:var(--ink-950); letter-spacing:-0.005em; font-family:var(--mono); }
.aud-row-ev { font-size:12.5px; font-weight:600; color:var(--ink-950); display:flex; align-items:center; gap:6px; flex-wrap:wrap; }

.aud-row-cta { padding:9px 14px; background:var(--ink-900); color:#fff; border-radius:9px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:5px; white-space:nowrap; }
.aud-row-cta:hover { background:var(--ink-800); }
`;

window.AudienceA = AudienceA;
window.AudienceB = AudienceB;
