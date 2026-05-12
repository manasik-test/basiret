// Sentiment (المشاعر) — two directions on a canvas
// A — Triage inbox: comments needing attention up top + sentiment summary aside
// B — Editorial dashboard: AI takeaway hero + sentiment trend + themes + examples

const SENT_DATA = {
  totals: { positive: 64, neutral: 22, negative: 14 },
  trend7d: [
    { d: 'الأحد',    pos: 58, neu: 26, neg: 16 },
    { d: 'الإثنين',  pos: 62, neu: 24, neg: 14 },
    { d: 'الثلاثاء', pos: 70, neu: 18, neg: 12 },
    { d: 'الأربعاء', pos: 55, neu: 22, neg: 23 },
    { d: 'الخميس',   pos: 60, neu: 25, neg: 15 },
    { d: 'الجمعة',   pos: 67, neu: 20, neg: 13 },
    { d: 'السبت',    pos: 64, neu: 22, neg: 14 },
  ],
  aiTake: {
    headline: 'الأربعاء كان يوماً صعباً — منشور التحديث استقطب ٢٣٪ ردود سلبية',
    body: 'سبب الردود السلبية: تأخير في الرد على استفسارات الأسعار. منشور الجمعة "قبل وبعد" استعاد الثقة — تفاعل إيجابي ٧٨٪.',
  },
  themes: [
    { word: 'تأخير الرد', count: 18, mood: 'neg' },
    { word: 'الجودة',    count: 32, mood: 'pos' },
    { word: 'الأسعار',   count: 24, mood: 'neu' },
    { word: 'سرعة التنفيذ', count: 21, mood: 'pos' },
    { word: 'خدمة العملاء', count: 16, mood: 'neg' },
    { word: 'النتيجة',  count: 28, mood: 'pos' },
    { word: 'التواصل',  count: 14, mood: 'neg' },
    { word: 'الموقع',   count: 12, mood: 'neu' },
    { word: 'الفريق',   count: 19, mood: 'pos' },
    { word: 'الموعد',   count: 11, mood: 'neu' },
  ],
  drivingPosts: [
    { title:'منشور قبل/بعد · الجمعة', pos:78, neu:14, neg:8,  total:42 },
    { title:'منشور التحديث · الأربعاء', pos:32, neu:25, neg:43, total:38 },
    { title:'نصائح سريعة · الإثنين', pos:64, neu:28, neg:8,  total:21 },
  ],
  needsAttention: [
    { id:'c1', author:'@sara_mkt', avatar:'س', mood:'neg', urgency:'high', time:'منذ ٢ ساعة', post:'منشور التحديث', text:'انتظرت ٤ أيام للرد على استفساري عن السعر، هل هذه طريقة التعامل؟', replies:0 },
    { id:'c2', author:'@khalid.q',  avatar:'خ', mood:'neg', urgency:'high', time:'منذ ٤ ساعات', post:'منشور قبل/بعد', text:'الجودة لا تستحق هذا السعر، جربت مزود آخر بنصف المبلغ.', replies:2 },
    { id:'c3', author:'@noura.aa',  avatar:'ن', mood:'neg', urgency:'mid',  time:'منذ يوم', post:'منشور التحديث', text:'صفحة الموقع لا تفتح على المتصفح، الأمر متكرر.', replies:1 },
    { id:'c4', author:'@m_writer',  avatar:'م', mood:'neu', urgency:'mid',  time:'منذ يوم', post:'منشور قبل/بعد', text:'هل الخدمة متوفرة في الرياض؟ ولا فقط في جدة؟', replies:0 },
    { id:'c5', author:'@layan_mk',  avatar:'ل', mood:'neg', urgency:'low',  time:'منذ يومين', post:'منشور النصائح', text:'النصائح عامة جداً، توقعت تفاصيل أكثر.', replies:0 },
  ],
  examples: {
    positive: [
      { author:'@reem.s',   text:'تجربتي معكم كانت ممتازة، الفريق محترف والنتيجة تجاوزت توقعي.' },
      { author:'@ahmad_k',  text:'سرعة التنفيذ مذهلة، الموعد كان دقيقاً.' },
    ],
    neutral: [
      { author:'@dana_w',   text:'هل تقدمون باقات شهرية؟' },
      { author:'@h_mohd',   text:'متى موعد فتح الفرع الجديد؟' },
    ],
    negative: [
      { author:'@sara_mkt', text:'انتظرت ٤ أيام للرد على استفساري عن السعر.' },
      { author:'@khalid.q', text:'الجودة لا تستحق هذا السعر.' },
    ],
  },
};

const MOOD = {
  pos: { label:'إيجابي', bg:'oklch(0.95 0.06 155)', fg:'oklch(0.42 0.13 155)', solid:'oklch(0.62 0.13 155)' },
  neu: { label:'محايد',  bg:'var(--ink-100)',       fg:'var(--ink-600)',         solid:'var(--ink-400)' },
  neg: { label:'سلبي',   bg:'oklch(0.96 0.05 30)',  fg:'oklch(0.5 0.17 30)',     solid:'oklch(0.65 0.17 30)' },
};

const URGE = {
  high: { lbl:'عاجل',  fg:'oklch(0.5 0.17 30)',  bg:'oklch(0.96 0.05 30)' },
  mid:  { lbl:'متوسط', fg:'oklch(0.5 0.13 60)',  bg:'oklch(0.97 0.05 60)' },
  low:  { lbl:'منخفض', fg:'var(--ink-600)',         bg:'var(--ink-100)' },
};

// Shared: AI hero
const SentHero = () => (
  <section className="snt-hero">
    <div className="snt-hero-l">
      <div className="snt-hero-k">✦ خلاصة بصيرة · هذا الأسبوع</div>
      <h2>{SENT_DATA.aiTake.headline}</h2>
      <p>{SENT_DATA.aiTake.body}</p>
      <div className="snt-hero-acts">
        <button className="snt-hero-btn primary"><Icon path={I.wand} size={13}/> اقترح ردوداً</button>
        <button className="snt-hero-btn ghost">عرض المنشور المتأثر ↩</button>
      </div>
    </div>
    <div className="snt-hero-r">
      <div className="snt-hero-rings">
        {['positive','neutral','negative'].map(k => {
          const v = SENT_DATA.totals[k];
          const m = MOOD[k==='positive'?'pos':k==='neutral'?'neu':'neg'];
          return (
            <div key={k} className="snt-ring">
              <div className="snt-ring-svg" style={{'--p':v, '--c':m.solid}}>
                <div className="snt-ring-c">
                  <div className="num">{v}٪</div>
                </div>
              </div>
              <div className="snt-ring-l" style={{color:m.fg}}>{m.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

// =========================================================
// A — Triage inbox
// =========================================================
const SentimentA = () => {
  const [filter, setFilter] = React.useState('all');
  const items = SENT_DATA.needsAttention.filter(c =>
    filter==='all' ? true : filter==='neg' ? c.mood==='neg' : filter==='neu' ? c.mood==='neu' : c.mood==='pos'
  );
  return (
    <div dir="rtl" className="snt">
      <Sidebar active="sentiment"/>
      <main className="snt-main">
        <header className="snt-head">
          <div>
            <h1>المشاعر</h1>
            <p>ماذا يقول جمهورك، وما المنشورات التي تحتاج رد — آخر ٧ أيام</p>
          </div>
          <div className="snt-seg">
            <button>اليوم</button>
            <button className="is-on">٧ أيام</button>
            <button>٣٠ يوم</button>
          </div>
        </header>

        <SentHero/>

        <div className="snt-grid snt-grid--triage">
          {/* LEFT — triage list */}
          <section className="snt-panel">
            <div className="snt-panel-head">
              <div>
                <h3>تحتاج رداً</h3>
                <p className="snt-panel-s">{items.length} تعليق · مرتّبة حسب الأولوية</p>
              </div>
              <div className="snt-filter">
                {[['all','الكل'],['neg','سلبي'],['neu','استفسار'],['pos','إيجابي']].map(([v,l]) => (
                  <button key={v} className={filter===v?'is-on':''} onClick={()=>setFilter(v)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="snt-inbox">
              {items.map(c => {
                const m = MOOD[c.mood];
                const u = URGE[c.urgency];
                return (
                  <article key={c.id} className="snt-comment" style={{'--m':m.solid}}>
                    <div className="snt-c-bar"/>
                    <div className="snt-c-av" style={{background:m.bg, color:m.fg}}>{c.avatar}</div>
                    <div className="snt-c-body">
                      <div className="snt-c-meta">
                        <span className="snt-c-au">{c.author}</span>
                        <span className="snt-c-mood" style={{background:m.bg, color:m.fg}}>{m.label}</span>
                        <span className="snt-c-urge" style={{background:u.bg, color:u.fg}}>{u.lbl}</span>
                        <span className="snt-c-dot">·</span>
                        <span className="snt-c-time">{c.time}</span>
                        <span className="snt-c-dot">·</span>
                        <span className="snt-c-post">على {c.post}</span>
                      </div>
                      <p className="snt-c-text">{c.text}</p>
                      <div className="snt-c-acts">
                        <button className="snt-c-btn primary"><Icon path={I.wand} size={11}/> اقترح رداً</button>
                        <button className="snt-c-btn ghost">رد يدوياً</button>
                        <button className="snt-c-btn ghost">تجاهل</button>
                        {c.replies>0 && <span className="snt-c-rc num">{c.replies} رد</span>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* RIGHT — context */}
          <aside className="snt-cock">
            <section className="snt-mini">
              <h3>اتجاه الأسبوع</h3>
              <div className="snt-trend">
                {SENT_DATA.trend7d.map(d => (
                  <div key={d.d} className="snt-trend-c">
                    <div className="snt-trend-stack">
                      <div style={{height:`${d.pos}%`, background:MOOD.pos.solid}}/>
                      <div style={{height:`${d.neu}%`, background:MOOD.neu.solid}}/>
                      <div style={{height:`${d.neg}%`, background:MOOD.neg.solid}}/>
                    </div>
                    <div className="snt-trend-l">{d.d.slice(0,3)}</div>
                  </div>
                ))}
              </div>
              <div className="snt-trend-leg">
                <span><i style={{background:MOOD.pos.solid}}/> إيجابي</span>
                <span><i style={{background:MOOD.neu.solid}}/> محايد</span>
                <span><i style={{background:MOOD.neg.solid}}/> سلبي</span>
              </div>
            </section>

            <section className="snt-mini">
              <h3>الكلمات الأكثر تكراراً</h3>
              <p className="snt-mini-s">آخر ٧ أيام</p>
              <div className="snt-cloud">
                {SENT_DATA.themes.map(t => {
                  const m = MOOD[t.mood];
                  return (
                    <span key={t.word} className="snt-tag" style={{background:m.bg, color:m.fg, fontSize:`${11 + t.count/4}px`}}>
                      {t.word} <b className="num">{t.count}</b>
                    </span>
                  );
                })}
              </div>
            </section>

            <section className="snt-mini">
              <h3>منشورات تحرّك المشاعر</h3>
              <p className="snt-mini-s">المنشورات الأكثر تأثيراً هذا الأسبوع</p>
              <div className="snt-drv">
                {SENT_DATA.drivingPosts.map((p,i) => (
                  <div key={i} className="snt-drv-row">
                    <div className="snt-drv-meta">
                      <span className="snt-drv-t">{p.title}</span>
                      <span className="snt-drv-n num">{p.total} تعليق</span>
                    </div>
                    <div className="snt-drv-bar">
                      <div style={{width:`${p.pos}%`, background:MOOD.pos.solid}}/>
                      <div style={{width:`${p.neu}%`, background:MOOD.neu.solid}}/>
                      <div style={{width:`${p.neg}%`, background:MOOD.neg.solid}}/>
                    </div>
                    <div className="snt-drv-pcts">
                      <span className="num" style={{color:MOOD.pos.fg}}>{p.pos}٪</span>
                      <span className="num" style={{color:MOOD.neu.fg}}>{p.neu}٪</span>
                      <span className="num" style={{color:MOOD.neg.fg}}>{p.neg}٪</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
        <MPGAskFab />
      </main>
      <style>{sentStyles}</style>
    </div>
  );
};

// =========================================================
// B — Editorial dashboard
// =========================================================
const SentimentB = () => (
  <div dir="rtl" className="snt snt--b">
    <Sidebar active="sentiment"/>
    <main className="snt-main">
      <header className="snt-head">
        <div>
          <h1>المشاعر</h1>
          <p>نبضة جمهورك — آخر ٧ أيام</p>
        </div>
        <div className="snt-seg">
          <button>اليوم</button>
          <button className="is-on">٧ أيام</button>
          <button>٣٠ يوم</button>
        </div>
      </header>

      <SentHero/>

      <section className="snt-trend-big">
        <div className="snt-mini-head-row">
          <div>
            <h3>اتجاه المشاعر</h3>
            <p className="snt-mini-s">٧ أيام · نسبة لكل فئة</p>
          </div>
          <div className="snt-trend-leg">
            <span><i style={{background:MOOD.pos.solid}}/> إيجابي</span>
            <span><i style={{background:MOOD.neu.solid}}/> محايد</span>
            <span><i style={{background:MOOD.neg.solid}}/> سلبي</span>
          </div>
        </div>
        <div className="snt-trend snt-trend--big">
          {SENT_DATA.trend7d.map(d => (
            <div key={d.d} className="snt-trend-c">
              <div className="snt-trend-stack">
                <div style={{height:`${d.pos}%`, background:MOOD.pos.solid}}/>
                <div style={{height:`${d.neu}%`, background:MOOD.neu.solid}}/>
                <div style={{height:`${d.neg}%`, background:MOOD.neg.solid}}/>
              </div>
              <div className="snt-trend-l">{d.d}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="snt-grid snt-grid--ed">
        <section className="snt-panel">
          <h3>ما يقوله الناس</h3>
          <p className="snt-panel-s">الكلمات الأكثر تكراراً مرتّبة حسب المشاعر</p>
          <div className="snt-cloud snt-cloud--big">
            {SENT_DATA.themes.map(t => {
              const m = MOOD[t.mood];
              return (
                <span key={t.word} className="snt-tag" style={{background:m.bg, color:m.fg, fontSize:`${12 + t.count/4}px`}}>
                  {t.word} <b className="num">{t.count}</b>
                </span>
              );
            })}
          </div>

          <div className="snt-divider"/>

          <h3>منشورات تحرّك المشاعر</h3>
          <p className="snt-panel-s">المنشورات الأكثر تأثيراً هذا الأسبوع</p>
          <div className="snt-drv">
            {SENT_DATA.drivingPosts.map((p,i) => (
              <div key={i} className="snt-drv-row">
                <div className="snt-drv-meta">
                  <span className="snt-drv-t">{p.title}</span>
                  <span className="snt-drv-n num">{p.total} تعليق</span>
                </div>
                <div className="snt-drv-bar">
                  <div style={{width:`${p.pos}%`, background:MOOD.pos.solid}}/>
                  <div style={{width:`${p.neu}%`, background:MOOD.neu.solid}}/>
                  <div style={{width:`${p.neg}%`, background:MOOD.neg.solid}}/>
                </div>
                <div className="snt-drv-pcts">
                  <span className="num" style={{color:MOOD.pos.fg}}>{p.pos}٪</span>
                  <span className="num" style={{color:MOOD.neu.fg}}>{p.neu}٪</span>
                  <span className="num" style={{color:MOOD.neg.fg}}>{p.neg}٪</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="snt-panel">
          <h3>عينات من التعليقات</h3>
          <p className="snt-panel-s">مثال واحد لكل فئة</p>
          <div className="snt-ex">
            {[['pos','positive'],['neu','neutral'],['neg','negative']].map(([k,full]) => {
              const m = MOOD[k];
              const list = SENT_DATA.examples[full];
              return (
                <div key={k} className="snt-ex-c" style={{'--m-bg':m.bg, '--m-fg':m.fg, '--m':m.solid}}>
                  <div className="snt-ex-h">
                    <span className="snt-ex-l" style={{background:m.bg, color:m.fg}}>{m.label}</span>
                    <span className="num snt-ex-n">{SENT_DATA.totals[full]}٪</span>
                  </div>
                  {list.slice(0,2).map((x,i)=>(
                    <div key={i} className="snt-ex-q">
                      <p>"{x.text}"</p>
                      <span className="snt-ex-au">— {x.author}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <MPGAskFab />
    </main>
    <style>{sentStyles}</style>
  </div>
);

const sentStyles = `
.snt { display:flex; min-height:100vh; background:var(--canvas); }
.snt-main { flex:1; padding:28px 36px 40px; display:flex; flex-direction:column; gap:22px; max-width:1480px; }
.snt-head { display:flex; justify-content:space-between; align-items:flex-end; }
.snt-head h1 { font-size:26px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; margin:0 0 3px; }
.snt-head p { font-size:12.5px; color:var(--ink-500); margin:0; }
.snt-seg { display:flex; background:var(--ink-100); border-radius:10px; padding:3px; }
.snt-seg button { padding:7px 14px; font-size:12.5px; border-radius:7px; color:var(--ink-600); font-weight:500; }
.snt-seg button.is-on { background:var(--surface); color:var(--ink-900); font-weight:600; box-shadow:var(--shadow-sm); }

/* Hero */
.snt-hero { display:grid; grid-template-columns:1.4fr 1fr; gap:28px; background:linear-gradient(135deg, var(--purple-50), oklch(0.97 0.03 280)); border:1px solid var(--purple-200); border-radius:20px; padding:26px 30px; align-items:center; }
.snt-hero-k { font-size:11px; font-weight:700; color:var(--purple-700); letter-spacing:0.04em; text-transform:uppercase; margin-bottom:10px; }
.snt-hero h2 { font-size:21px; font-weight:700; color:var(--ink-950); margin:0 0 10px; letter-spacing:-0.015em; line-height:1.4; text-wrap:balance; }
.snt-hero p { font-size:13.5px; color:var(--ink-700); line-height:1.7; margin:0 0 16px; max-width:540px; text-wrap:pretty; }
.snt-hero-acts { display:flex; gap:8px; }
.snt-hero-btn { padding:9px 14px; border-radius:10px; font-size:12.5px; font-weight:600; display:inline-flex; align-items:center; gap:5px; }
.snt-hero-btn.primary { background:var(--purple-600); color:#fff; }
.snt-hero-btn.ghost { background:transparent; color:var(--purple-800); }
.snt-hero-rings { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
.snt-ring { background:var(--surface); border-radius:14px; padding:14px 8px; text-align:center; }
.snt-ring-svg { width:80px; height:80px; margin:0 auto 6px; border-radius:50%; background:conic-gradient(var(--c) calc(var(--p) * 1%), var(--ink-100) 0); display:grid; place-items:center; }
.snt-ring-c { width:60px; height:60px; background:var(--surface); border-radius:50%; display:grid; place-items:center; }
.snt-ring-c .num { font-size:17px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; }
.snt-ring-l { font-size:12px; font-weight:600; }

/* Grid layouts */
.snt-grid--triage { display:grid; grid-template-columns:1.55fr 1fr; gap:20px; align-items:flex-start; }
.snt-grid--ed { display:grid; grid-template-columns:1.2fr 1fr; gap:20px; align-items:flex-start; }
.snt-cock { display:flex; flex-direction:column; gap:14px; position:sticky; top:28px; }
.snt-panel, .snt-mini, .snt-trend-big { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:22px; }
.snt-panel h3, .snt-mini h3, .snt-trend-big h3 { font-size:14px; font-weight:700; color:var(--ink-950); margin:0; letter-spacing:-0.005em; }
.snt-panel-s, .snt-mini-s { font-size:11.5px; color:var(--ink-500); font-weight:500; margin:2px 0 14px; }
.snt-mini-head-row { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; }
.snt-mini-head-row h3 { margin:0 0 2px; }

.snt-panel-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:14px; }
.snt-panel-head h3 { margin:0 0 2px; }
.snt-filter { display:flex; gap:4px; flex-shrink:0; }
.snt-filter button { padding:6px 11px; font-size:11.5px; border-radius:7px; color:var(--ink-600); font-weight:500; }
.snt-filter button.is-on { background:var(--purple-100); color:var(--purple-800); font-weight:600; }

/* Inbox */
.snt-inbox { display:flex; flex-direction:column; gap:10px; }
.snt-comment { display:grid; grid-template-columns:3px 38px 1fr; gap:12px; padding:14px 14px 14px 0; border:1px solid var(--line); border-radius:12px; background:var(--surface); position:relative; overflow:hidden; }
.snt-c-bar { background:var(--m); border-radius:0 3px 3px 0; }
.snt-c-av { width:38px; height:38px; border-radius:50%; display:grid; place-items:center; font-weight:700; font-size:13px; }
.snt-c-meta { display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:11px; color:var(--ink-500); margin-bottom:6px; }
.snt-c-au { font-weight:700; color:var(--ink-900); font-size:12px; }
.snt-c-mood, .snt-c-urge { padding:2px 8px; border-radius:99px; font-size:10.5px; font-weight:600; }
.snt-c-dot { color:var(--ink-300); }
.snt-c-post { font-style:italic; }
.snt-c-text { font-size:13.5px; color:var(--ink-900); line-height:1.6; margin:0 12px 10px 0; text-wrap:pretty; }
.snt-c-acts { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.snt-c-btn { padding:6px 12px; border-radius:8px; font-size:11.5px; font-weight:600; display:inline-flex; align-items:center; gap:4px; }
.snt-c-btn.primary { background:var(--ink-900); color:#fff; }
.snt-c-btn.ghost { color:var(--ink-700); border:1px solid var(--line-strong); background:transparent; }
.snt-c-rc { font-size:11px; color:var(--ink-500); margin-inline-start:auto; padding-inline-end:12px; }

/* Trend chart */
.snt-trend { display:grid; grid-template-columns:repeat(7,1fr); gap:8px; align-items:end; height:120px; }
.snt-trend--big { height:200px; gap:14px; }
.snt-trend-c { display:flex; flex-direction:column; gap:6px; align-items:center; height:100%; }
.snt-trend-stack { width:100%; max-width:36px; display:flex; flex-direction:column; border-radius:6px; overflow:hidden; flex:1; min-height:0; }
.snt-trend-stack > div { width:100%; }
.snt-trend-l { font-size:10.5px; color:var(--ink-500); font-weight:500; }
.snt-trend-leg { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; color:var(--ink-600); }
.snt-trend-leg span { display:inline-flex; align-items:center; gap:5px; font-weight:500; }
.snt-trend-leg i { width:9px; height:9px; border-radius:2px; display:inline-block; }
.snt-mini .snt-trend-leg { margin-top:10px; }

/* Cloud */
.snt-cloud { display:flex; flex-wrap:wrap; gap:6px; }
.snt-cloud--big { gap:8px; }
.snt-tag { padding:5px 11px; border-radius:99px; font-weight:500; line-height:1.4; display:inline-flex; align-items:center; gap:5px; }
.snt-tag b { font-weight:700; opacity:.7; }

/* Examples */
.snt-ex { display:flex; flex-direction:column; gap:14px; }
.snt-ex-c { background:var(--m-bg); border-radius:12px; padding:14px 16px; position:relative; overflow:hidden; border:1px solid color-mix(in oklch, var(--m) 30%, transparent); }
.snt-ex-h { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
.snt-ex-l { font-size:11px; font-weight:700; padding:3px 10px; border-radius:99px; }
.snt-ex-n { font-size:13px; font-weight:700; color:var(--m-fg); letter-spacing:-0.005em; }
.snt-ex-q { padding:6px 0; }
.snt-ex-q + .snt-ex-q { border-top:1px solid color-mix(in oklch, var(--m) 18%, transparent); }
.snt-ex-q p { font-size:12.5px; color:var(--ink-900); line-height:1.6; margin:0 0 4px; text-wrap:pretty; }
.snt-ex-au { font-size:10.5px; color:var(--m-fg); font-weight:600; }

/* Driving posts */
.snt-divider { height:1px; background:var(--line); margin:22px 0 18px; }
.snt-drv { display:flex; flex-direction:column; gap:14px; }
.snt-drv-row { display:flex; flex-direction:column; gap:6px; }
.snt-drv-meta { display:flex; justify-content:space-between; align-items:center; }
.snt-drv-t { font-size:12px; font-weight:600; color:var(--ink-900); }
.snt-drv-n { font-size:10.5px; color:var(--ink-500); font-weight:500; }
.snt-drv-bar { display:flex; height:8px; border-radius:99px; overflow:hidden; background:var(--ink-100); }
.snt-drv-bar > div { height:100%; }
.snt-drv-pcts { display:flex; gap:10px; font-size:10.5px; font-weight:600; }
`;

window.SentimentA = SentimentA;
window.SentimentB = SentimentB;
