// Competitors (المنافسون) — Basiret
// Single rich workspace: leaderboard + activity feed + content-mix radar + top posts + sentiment + hashtags

const COMP_DATA = {
  me: { handle:'@tasyeer.sa', name:'Tasyeer', avatar:'T', color:'oklch(0.6 0.18 285)', followers:'12.4K', growth:'+2.1%', engagement:'9.6%', cadence:'4/أسبوع', mix:{video:35,image:50,carousel:15}, isMe:true },
  competitors: [
    { handle:'@raid_co',      name:'Raid Co',      avatar:'R', color:'oklch(0.65 0.17 30)',   followers:'24.8K', growth:'+5.4%', engagement:'12.3%', cadence:'7/أسبوع', mix:{video:60,image:25,carousel:15}, sentiment:78 },
    { handle:'@nour_design',  name:'Nour Design',  avatar:'ن', color:'oklch(0.65 0.15 200)',  followers:'18.2K', growth:'+3.8%', engagement:'10.1%', cadence:'5/أسبوع', mix:{video:30,image:55,carousel:15}, sentiment:71 },
    { handle:'@sahab_studio', name:'Sahab Studio', avatar:'س', color:'oklch(0.65 0.14 155)',  followers:'9.6K',  growth:'+1.2%', engagement:'8.4%',  cadence:'3/أسبوع', mix:{video:20,image:60,carousel:20}, sentiment:64 },
    { handle:'@noor_brand',   name:'Noor Brand',   avatar:'م', color:'oklch(0.65 0.16 60)',   followers:'31.5K', growth:'+0.4%', engagement:'5.8%',  cadence:'4/أسبوع', mix:{video:40,image:40,carousel:20}, sentiment:52 },
  ],
  feed: [
    { who:'@raid_co',      when:'منذ ٢ ساعة', kind:'فيديو',     title:'قبل/بعد · مشروع جديد',         eng:'٣x متوسطه', mood:'pos', why:'هذا الأسلوب أعطاك أعلى تفاعل أيضاً', tag:'فرصة' },
    { who:'@noor_brand',   when:'منذ ٤ ساعات', kind:'كاروسيل',   title:'٧ نصائح للبراندينغ',           eng:'+45٪',     mood:'pos', why:'موضوع عالي الإقبال هذا الشهر',     tag:'موضوع رائج' },
    { who:'@nour_design',  when:'منذ يوم',     kind:'صورة',     title:'إعلان فعالية افتتاح',           eng:'منخفض',    mood:'neu', why:'محتواك المماثل يؤدي بشكل أفضل',     tag:'تفوق محتمل' },
    { who:'@sahab_studio', when:'منذ يومين',   kind:'فيديو',     title:'تجربة عميل',                  eng:'+12٪',     mood:'pos', why:'صيغة بسيطة قابلة للتكرار',          tag:'أسلوب' },
    { who:'@raid_co',      when:'منذ ٣ أيام',  kind:'صورة',     title:'إعلان عرض ٣٠٪',                eng:'تعليقات سلبية', mood:'neg', why:'الجمهور لم يقتنع — خطاب التسعير',  tag:'تحذير' },
  ],
  topPosts: [
    { who:'@raid_co',     thumb:'oklch(0.7 0.15 30)',  format:'فيديو',   metric:'٢٤K مشاهدة', eng:'+٣٢٠٪', tag:'قبل/بعد' },
    { who:'@noor_brand',  thumb:'oklch(0.75 0.12 60)', format:'كاروسيل', metric:'١.٢K حفظ',   eng:'+١٨٠٪', tag:'نصائح' },
    { who:'@raid_co',     thumb:'oklch(0.72 0.14 30)', format:'ريلز',    metric:'١٨K مشاهدة', eng:'+٢١٠٪', tag:'وراء الكواليس' },
    { who:'@nour_design', thumb:'oklch(0.7 0.13 200)', format:'صورة',    metric:'٤٢٠ تفاعل',  eng:'+٤٥٪',  tag:'إعلان' },
  ],
  hashtags: [
    { tag:'#قبل_بعد',     used:14, vsYou:'+١٢', mood:'pos' },
    { tag:'#تصميم_عربي',  used:22, vsYou:'+٨',  mood:'pos' },
    { tag:'#براندينغ',    used:18, vsYou:'+٤',  mood:'neu' },
    { tag:'#خصومات',      used:9,  vsYou:'-٣',  mood:'neg' },
    { tag:'#فعالية',      used:7,  vsYou:'+٧',  mood:'pos' },
    { tag:'#تجربة_عميل',  used:11, vsYou:'+٥',  mood:'pos' },
  ],
  postingHeatmap: [
    [0,0,1,2,1,3,2,1,0,0],
    [1,2,3,5,3,4,2,1,0,0],
    [0,1,2,3,4,5,4,3,1,0],
    [1,1,2,4,5,6,4,2,1,0],
    [0,1,3,4,5,7,5,3,2,1],
    [2,3,4,5,6,7,6,4,3,2],
    [1,2,3,4,4,5,3,2,1,0],
  ],
};

const C_MOOD = {
  pos: { fg:'oklch(0.5 0.15 155)',  bg:'oklch(0.96 0.05 155)', label:'إيجابي' },
  neu: { fg:'var(--ink-600)',          bg:'var(--ink-100)',          label:'محايد'  },
  neg: { fg:'oklch(0.55 0.17 30)',  bg:'oklch(0.96 0.05 30)',  label:'سلبي'   },
};

const C_TAG = {
  'فرصة':         { bg:'oklch(0.95 0.07 155)', fg:'oklch(0.42 0.13 155)' },
  'موضوع رائج':   { bg:'oklch(0.95 0.07 285)', fg:'var(--purple-700)' },
  'تفوق محتمل':   { bg:'oklch(0.95 0.07 200)', fg:'oklch(0.45 0.13 200)' },
  'أسلوب':        { bg:'var(--ink-100)',         fg:'var(--ink-700)' },
  'تحذير':        { bg:'oklch(0.95 0.07 30)',  fg:'oklch(0.5 0.17 30)' },
};

const CompetitorsApp = () => {
  const [selected, setSelected] = React.useState('@raid_co');
  const all = [COMP_DATA.me, ...COMP_DATA.competitors];

  return (
    <div dir="rtl" className="cmp">
      <Sidebar active="competitors"/>
      <main className="cmp-main">
        <header className="cmp-head">
          <div>
            <h1>المنافسون</h1>
            <p>كيف يتحرّك السوق حولك — وأين الفرص</p>
          </div>
          <div className="cmp-head-r">
            <div className="cmp-seg">
              <button>اليوم</button>
              <button className="is-on">٧ أيام</button>
              <button>٣٠ يوم</button>
            </div>
            <button className="cmp-add">+ إضافة منافس</button>
          </div>
        </header>

        {/* AI hero */}
        <section className="cmp-hero">
          <div className="cmp-hero-l">
            <div className="cmp-hero-k">✦ خلاصة بصيرة عن منافسيك</div>
            <h2>منافسوك يستثمرون في الفيديو القصير — وأنت تتأخر بنسبة ٢٥٪</h2>
            <p>@raid_co نشر "قبل/بعد" فيديو حقّق ٣x متوسط تفاعله. الأسلوب نفسه أعطاك أعلى تفاعل الأسبوع الماضي — كرّره قبل أن يستهلك السوق.</p>
            <div className="cmp-hero-acts">
              <button className="cmp-hero-btn primary">✦ اقترح ٣ أفكار مماثلة</button>
              <button className="cmp-hero-btn ghost">عرض المنشور المرجعي ↩</button>
            </div>
          </div>
          <div className="cmp-hero-stats">
            <div className="cmp-hero-stat"><div className="cmp-hero-stat-k">منشورات منافسيك (٧ أيام)</div><div className="cmp-hero-stat-v num">١٩</div><div className="cmp-hero-stat-d">منك ٤</div></div>
            <div className="cmp-hero-stat"><div className="cmp-hero-stat-k">متوسط تفاعلهم</div><div className="cmp-hero-stat-v num">٩.١٪</div><div className="cmp-hero-stat-d">منك ٩.٦٪ ✓</div></div>
            <div className="cmp-hero-stat"><div className="cmp-hero-stat-k">فرص مرصودة</div><div className="cmp-hero-stat-v num">٣</div><div className="cmp-hero-stat-d">عاجلة الآن</div></div>
          </div>
        </section>

        {/* 2-col grid */}
        <div className="cmp-grid">
          {/* LEFT col */}
          <div className="cmp-col">
            <section className="cmp-card">
              <div className="cmp-card-head">
                <div>
                  <h3>نشاط منافسيك</h3>
                  <p>منشوراتهم الأخيرة مع توصية مخصصة لكل منشور</p>
                </div>
              </div>
              <div className="cmp-feed">
                {COMP_DATA.feed.map((f,i)=>{
                  const m = C_MOOD[f.mood];
                  const t = C_TAG[f.tag] || C_TAG['أسلوب'];
                  return (
                    <article key={i} className="cmp-feed-i">
                      <div className="cmp-feed-thumb" style={{background:`linear-gradient(135deg, ${m.bg}, ${m.fg})`}}>
                        <span className="cmp-feed-format">{f.kind}</span>
                      </div>
                      <div className="cmp-feed-body">
                        <div className="cmp-feed-meta">
                          <span className="cmp-feed-who">{f.who}</span>
                          <span className="cmp-feed-dot">·</span>
                          <span className="cmp-feed-when">{f.when}</span>
                          <span className="cmp-feed-tag" style={{background:t.bg, color:t.fg}}>{f.tag}</span>
                        </div>
                        <div className="cmp-feed-title">{f.title}</div>
                        <div className="cmp-feed-eng"><span className="num">{f.eng}</span><span className="cmp-feed-why">— {f.why}</span></div>
                      </div>
                      <div className="cmp-feed-acts">
                        <button className="cmp-feed-btn primary">✦ نسخة مماثلة</button>
                        <button className="cmp-feed-btn ghost">حفظ</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="cmp-card" style={{display:'none'}}></section>
          </div>

          {/* RIGHT col */}
          <div className="cmp-col">
            <section className="cmp-card">
              <h3>الكلمات والوسوم</h3>
              <p className="cmp-sub">يستخدمها منافسوك أكثر منك</p>
              <div className="cmp-tags">
                {COMP_DATA.hashtags.map(h => {
                  const m = C_MOOD[h.mood];
                  const positive = !h.vsYou.startsWith('-');
                  return (
                    <div key={h.tag} className="cmp-tag-r">
                      <span className="cmp-tag-t">{h.tag}</span>
                      <span className="cmp-tag-u num">{h.used}×</span>
                      <span className="cmp-tag-d num" style={{color: positive ? 'oklch(0.5 0.15 155)' : 'oklch(0.55 0.17 30)'}}>
                        {h.vsYou}
                      </span>
                      <span className="cmp-tag-mood" style={{background:m.bg, color:m.fg}}>{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="cmp-card">
              <h3>متى ينشرون</h3>
              <p className="cmp-sub">أيام × ساعات — كثافة منشورات منافسيك</p>
              <div className="cmp-heat">
                <div className="cmp-heat-cols">
                  {['٦ص','٨ص','١٠ص','١٢ظ','٢م','٤م','٦م','٨م','١٠م','١٢ل'].map(t=><span key={t}>{t}</span>)}
                </div>
                <div className="cmp-heat-grid">
                  {COMP_DATA.postingHeatmap.map((row,r)=>(
                    <React.Fragment key={r}>
                      <span className="cmp-heat-day">{['أ','ث','ر','خ','ج','س','ح'][r]}</span>
                      {row.map((v,c)=>(
                        <div key={c} className="cmp-heat-cell" style={{background: v===0 ? 'var(--ink-100)' : `oklch(0.62 0.18 285 / ${0.18 + v*0.11})`, borderColor: v>=5 ? 'var(--purple-700)' : 'transparent'}}/>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
                <p className="cmp-heat-hint">الذروة: <b>الجمعة ٦م</b> — أنت تنشر صباحاً غالباً</p>
              </div>
            </section>
          </div>
        </div>
        <MPGAskFab />
      </main>

      <style>{cmpStyles}</style>
    </div>
  );
};

const cmpStyles = `
.cmp { display:flex; min-height:100vh; background:var(--canvas); }
.cmp-main { flex:1; padding:28px 36px 40px; display:flex; flex-direction:column; gap:18px; max-width:1520px; }
.cmp-head { display:flex; justify-content:space-between; align-items:flex-end; }
.cmp-head h1 { font-size:26px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; margin:0 0 3px; }
.cmp-head p { font-size:12.5px; color:var(--ink-500); margin:0; }
.cmp-head-r { display:flex; gap:10px; align-items:center; }
.cmp-seg { display:flex; background:var(--ink-100); border-radius:10px; padding:3px; }
.cmp-seg button { padding:7px 14px; font-size:12.5px; border-radius:7px; color:var(--ink-600); font-weight:500; }
.cmp-seg button.is-on { background:var(--surface); color:var(--ink-900); font-weight:600; box-shadow:0 1px 3px rgba(0,0,0,.04); }
.cmp-add { padding:8px 14px; font-size:12.5px; border-radius:10px; background:transparent; color:var(--purple-700); font-weight:600; border:1px solid var(--purple-200); }

/* Hero */
.cmp-hero { display:grid; grid-template-columns:1.6fr 1fr; gap:18px; background:linear-gradient(135deg, var(--purple-50), oklch(0.97 0.03 280)); border:1px solid var(--purple-200); border-radius:16px; padding:16px 20px; align-items:center; }
.cmp-hero-k { font-size:10px; font-weight:700; color:var(--purple-700); letter-spacing:0.04em; text-transform:uppercase; margin-bottom:6px; }
.cmp-hero h2 { font-size:15.5px; font-weight:700; color:var(--ink-950); margin:0 0 6px; letter-spacing:-0.01em; line-height:1.4; text-wrap:balance; }
.cmp-hero p { font-size:12px; color:var(--ink-700); line-height:1.6; margin:0 0 10px; max-width:560px; text-wrap:pretty; }
.cmp-hero-acts { display:flex; gap:6px; }
.cmp-hero-btn { padding:7px 11px; border-radius:8px; font-size:11.5px; font-weight:600; }
.cmp-hero-btn.primary { background:var(--purple-600); color:#fff; }
.cmp-hero-btn.ghost { background:transparent; color:var(--purple-800); }
.cmp-hero-stats { display:flex; flex-direction:column; gap:6px; }
.cmp-hero-stat { background:var(--surface); border-radius:10px; padding:8px 11px; display:grid; grid-template-columns:1fr auto; align-items:center; gap:8px; }
.cmp-hero-stat-k { font-size:10.5px; color:var(--ink-500); font-weight:500; grid-row:1; grid-column:1; }
.cmp-hero-stat-v { font-size:16px; font-weight:700; color:var(--ink-950); letter-spacing:-0.01em; line-height:1; grid-row:1 / span 2; grid-column:2; }
.cmp-hero-stat-d { font-size:10.5px; color:var(--ink-600); font-weight:500; grid-row:2; grid-column:1; }

/* Cards */
.cmp-card { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:20px 22px; }
.cmp-card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:14px; }
.cmp-card-head h3 { font-size:15px; font-weight:700; color:var(--ink-950); margin:0 0 3px; letter-spacing:-0.005em; }
.cmp-card-head p { font-size:12px; color:var(--ink-500); margin:0; }
.cmp-card h3 { font-size:14px; font-weight:700; color:var(--ink-950); margin:0; }
.cmp-card p.cmp-sub { font-size:11.5px; color:var(--ink-500); font-weight:500; margin:2px 0 14px; }
.cmp-link { font-size:12px; color:var(--purple-700); font-weight:500; }

/* Avatars */
.cmp-av { width:32px; height:32px; border-radius:50%; display:grid; place-items:center; color:#fff; font-weight:700; font-size:13px; flex-shrink:0; }
.cmp-av--lg { width:44px; height:44px; font-size:17px; }

/* Leaderboard */
.cmp-board { display:flex; flex-direction:column; gap:1px; background:var(--line); border-radius:12px; overflow:hidden; }
.cmp-board-h, .cmp-board-r { display:grid; grid-template-columns:1.6fr .8fr .7fr .7fr .8fr 1.3fr .9fr; gap:14px; padding:11px 14px; align-items:center; background:var(--surface); }
.cmp-board-h { background:var(--ink-50); font-size:11px; color:var(--ink-500); font-weight:600; }
.cmp-board-r { font-size:12.5px; cursor:pointer; transition:background .12s; }
.cmp-board-r:hover { background:var(--ink-50); }
.cmp-board-r.is-me { background:var(--purple-50); }
.cmp-board-r.is-me:hover { background:oklch(0.96 0.04 285); }
.cmp-board-acc { display:flex; align-items:center; gap:10px; }
.cmp-board-rank { color:var(--ink-400); font-size:11px; font-weight:600; min-width:14px; }
.cmp-board-n { font-weight:600; color:var(--ink-950); font-size:12.5px; }
.cmp-board-h2 { font-size:11px; color:var(--ink-500); }
.cmp-me { display:inline-block; font-size:9.5px; padding:1px 6px; border-radius:99px; background:var(--purple-200); color:var(--purple-800); font-weight:700; margin-inline-start:5px; }
.cmp-board-num { color:var(--ink-900); font-weight:600; }
.cmp-board-up  { color:oklch(0.5 0.15 155); font-weight:600; }
.cmp-board-eng { color:var(--ink-950); font-weight:700; }
.cmp-board-cad { color:var(--ink-700); font-size:11.5px; }
.cmp-board-snt { color:var(--ink-700); font-size:12px; font-weight:600; }
.cmp-board-snt-l { color:var(--ink-400); font-size:10px; font-weight:500; margin-inline-start:1px; }

.cmp-mix { display:flex; height:8px; border-radius:99px; overflow:hidden; background:var(--ink-100); }
.cmp-mix > div { height:100%; }
.cmp-mix-leg { display:flex; gap:14px; padding:10px 14px; background:var(--surface); font-size:11px; color:var(--ink-600); justify-content:flex-end; }
.cmp-mix-leg span { display:inline-flex; align-items:center; gap:5px; font-weight:500; }
.cmp-mix-leg i { width:8px; height:8px; border-radius:2px; display:inline-block; }

/* Grid */
.cmp-grid { display:grid; grid-template-columns:1.4fr 1fr; gap:18px; align-items:flex-start; }
.cmp-col { display:flex; flex-direction:column; gap:14px; }

/* Feed */
.cmp-feed { display:flex; flex-direction:column; gap:8px; }
.cmp-feed-i { display:grid; grid-template-columns:64px 1fr auto; gap:14px; padding:12px; border-radius:12px; border:1px solid var(--line); background:var(--surface); align-items:center; transition:border-color .15s; }
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
.cmp-feed-btn { padding:7px 12px; border-radius:8px; font-size:11px; font-weight:600; white-space:nowrap; }
.cmp-feed-btn.primary { background:var(--ink-900); color:#fff; }
.cmp-feed-btn.ghost { color:var(--ink-700); border:1px solid var(--line-strong); background:transparent; }

/* Top posts */
.cmp-top { display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; }
.cmp-top-c { display:flex; flex-direction:column; gap:8px; padding:10px; border-radius:12px; border:1px solid var(--line); }
.cmp-top-thumb { aspect-ratio:1.4; border-radius:10px; display:flex; justify-content:space-between; align-items:flex-start; padding:8px; }
.cmp-top-fmt { font-size:10px; padding:3px 8px; background:rgba(0,0,0,.45); color:#fff; border-radius:99px; font-weight:700; }
.cmp-top-eng { font-size:11px; padding:3px 8px; background:#fff; color:oklch(0.5 0.15 155); border-radius:99px; font-weight:700; }
.cmp-top-meta { padding:0 4px; }
.cmp-top-tag { font-size:11px; color:var(--ink-500); font-weight:500; }
.cmp-top-who { font-size:12.5px; font-weight:600; color:var(--ink-900); margin:2px 0; }
.cmp-top-m { font-size:11px; color:var(--ink-700); font-weight:600; }
.cmp-top-btn { padding:8px; border-radius:8px; font-size:11.5px; font-weight:600; background:var(--ink-50); color:var(--ink-800); border:1px solid var(--line); }
.cmp-top-btn:hover { background:var(--purple-50); color:var(--purple-700); border-color:var(--purple-200); }

/* Profile */
.cmp-prof-head { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
.cmp-prof-info { flex:1; }
.cmp-prof-n { font-size:14.5px; font-weight:700; color:var(--ink-950); }
.cmp-prof-h { font-size:12px; color:var(--ink-500); }
.cmp-prof-follow { padding:6px 12px; border-radius:8px; font-size:11.5px; font-weight:600; background:var(--purple-100); color:var(--purple-800); }
.cmp-prof-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:16px; }
.cmp-prof-stats > div { padding:10px; border-radius:10px; background:var(--ink-50); text-align:center; }
.cmp-prof-stats .num { font-size:14px; font-weight:700; color:var(--ink-950); letter-spacing:-0.005em; }
.cmp-prof-stats .num.up { color:oklch(0.5 0.15 155); }
.cmp-prof-stats em { display:block; font-style:normal; font-size:10.5px; color:var(--ink-500); margin-top:2px; font-weight:500; }
.cmp-prof-snt-h { display:flex; justify-content:space-between; font-size:12px; font-weight:600; color:var(--ink-800); margin-bottom:6px; }
.cmp-prof-snt-v { color:var(--purple-700); }
.cmp-prof-snt-bar { height:8px; background:var(--ink-100); border-radius:99px; overflow:hidden; }
.cmp-prof-snt-bar > div { height:100%; background:linear-gradient(90deg, oklch(0.65 0.15 30), oklch(0.7 0.13 60), oklch(0.62 0.13 155)); border-radius:99px; }
.cmp-prof-snt-hint { font-size:11px; color:var(--ink-500); margin:8px 0 0; }

/* Hashtags */
.cmp-tags { display:flex; flex-direction:column; gap:1px; background:var(--line); border-radius:10px; overflow:hidden; }
.cmp-tag-r { display:grid; grid-template-columns:1.5fr .6fr .6fr 1fr; gap:10px; padding:10px 12px; background:var(--surface); align-items:center; font-size:12px; }
.cmp-tag-t { font-weight:600; color:var(--ink-900); font-family:var(--mono, monospace); }
.cmp-tag-u { color:var(--ink-700); font-weight:500; }
.cmp-tag-d { font-weight:700; }
.cmp-tag-mood { padding:3px 9px; border-radius:99px; font-size:10.5px; font-weight:600; justify-self:end; }

/* Heatmap */
.cmp-heat-cols { display:grid; grid-template-columns:24px repeat(10,1fr); gap:3px; font-size:9.5px; color:var(--ink-400); margin-bottom:4px; padding-inline-start:3px; }
.cmp-heat-cols span:first-child { display:none; }
.cmp-heat-cols span { text-align:center; font-weight:500; }
.cmp-heat-grid { display:grid; grid-template-columns:24px repeat(10,1fr); gap:3px; }
.cmp-heat-day { font-size:10px; color:var(--ink-500); display:grid; place-items:center; font-weight:600; }
.cmp-heat-cell { aspect-ratio:1; min-height:22px; border-radius:4px; border:1.5px solid; transition:transform .12s; }
.cmp-heat-cell:hover { transform:scale(1.15); }
.cmp-heat-hint { font-size:11px; color:var(--ink-600); margin-top:10px; }
.cmp-heat-hint b { color:var(--purple-700); font-weight:700; }
`;

window.CompetitorsApp = CompetitorsApp;
