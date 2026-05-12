// Home Dashboard — alternate directions (H2, H3, H4)
// Reuses Sidebar + MPGAskFab from existing components

// =========================================================
// H2 — "Morning briefing" editorial
// Big editorial headline + 3 dense columns (What worked / What didn't / What's next)
// Inline sparklines; health as a horizontal spectrum bar at the top
// =========================================================
const HomeH2 = () => {
  return (
    <div dir="rtl" className="h2">
      <Sidebar active="home"/>
      <main className="h2-main">

        {/* Hero editorial */}
        <section className="h2-hero">
          <div className="h2-hero-l">
            <div className="h2-date">الخميس · ٢٢ أبريل ٢٠٢٦</div>
            <h1>صباح الخير Tasyeer —<br/>إليك ملخّص حسابك اليوم.</h1>
            <p>حللتُ ٣٥ منشوراً، ٣ منافسين، و٤٨ ألف مشاهدة. إليك ما يحتاج انتباهك.</p>
          </div>
          <div className="h2-hero-r">
            <div className="h2-spectrum">
              <div className="h2-spectrum-head">
                <span>صحة نموك</span>
                <span className="num" style={{color:'var(--purple-700)'}}>٦٥<em>/١٠٠</em></span>
              </div>
              <div className="h2-spectrum-bar">
                <div className="h2-spectrum-fill" style={{width:'65%'}}/>
                <div className="h2-spectrum-mark" style={{insetInlineStart:'65%'}}/>
              </div>
              <div className="h2-spectrum-labels">
                <span>ضعيف</span>
                <span>متوسط</span>
                <span>قوي</span>
              </div>
            </div>
          </div>
        </section>

        {/* KPI band */}
        <section className="h2-band">
          {[
            { k: 'تفاعل', v: '٩.٦٪', d: '+١.٢', spark:[3,5,4,6,5,8,7,9,8,10,9,12] },
            { k: 'وصول',  v: '٤٨.٢K', d: '+٨٪', spark:[4,5,4,6,7,6,8,7,9,8,10,11] },
            { k: 'منشور', v: '٣٥',   d: '+٥',  spark:[2,3,3,4,3,5,4,6,5,4,6,7] },
            { k: 'متابعين جدد', v: '١٤٢', d: '+٣٢', spark:[1,2,1,3,2,4,3,5,4,6,5,7] },
          ].map((s,i)=>(
            <div key={i} className="h2-b-card">
              <div className="h2-b-k">{s.k}</div>
              <div className="h2-b-row">
                <div className="h2-b-v num">{s.v}</div>
                <div className="h2-b-spark">
                  {s.spark.map((h,j)=><div key={j} style={{height:`${h*6+20}%`}}/>)}
                </div>
              </div>
              <div className="h2-b-d up">↑ <span className="num">{s.d}</span></div>
            </div>
          ))}
        </section>

        {/* Three columns */}
        <section className="h2-cols">
          <article className="h2-col">
            <div className="h2-col-head">
              <span className="h2-col-k good">✓ ما الذي نجح</span>
              <span className="h2-col-n num">٣ ملاحظات</span>
            </div>
            <ul>
              <li>
                <div className="h2-li-t">الفيديو يضاعف تفاعلك</div>
                <div className="h2-li-s">متوسط <b className="num">٤.٨٪</b> مقابل <b className="num">١.٩٪</b> للصور</div>
              </li>
              <li>
                <div className="h2-li-t">تنوّع المحتوى ممتاز</div>
                <div className="h2-li-s">مزيج الصور والفيديوهات متوازن عبر الأسبوع</div>
              </li>
              <li>
                <div className="h2-li-t">منشور الثلاثاء ٤م حقق ٢٣٪ تفاعل</div>
                <div className="h2-li-s">أعلى منشور هذا الشهر — كرّر النمط</div>
              </li>
            </ul>
            <button className="h2-col-cta">استعرض الأنماط الناجحة ↩</button>
          </article>

          <article className="h2-col">
            <div className="h2-col-head">
              <span className="h2-col-k bad">✗ ما الذي ينبغي تغييره</span>
              <span className="h2-col-n num">٢ تحذير</span>
            </div>
            <ul>
              <li>
                <div className="h2-li-t">الانتظام ضعيف جداً</div>
                <div className="h2-li-s">لم تنشر منذ ٣ أيام — جمهورك يفقد الارتباط</div>
              </li>
              <li>
                <div className="h2-li-t">الصور بدون CTA لا تؤدي</div>
                <div className="h2-li-s">٣ صور آخر أسبوع بتفاعل أقل من ٢٪</div>
              </li>
            </ul>
            <button className="h2-col-cta">أصلح الآن ↩</button>
          </article>

          <article className="h2-col h2-col--action">
            <div className="h2-col-head">
              <span className="h2-col-k accent">✦ الخطوات التالية</span>
              <span className="h2-col-n num">٣ إجراءات</span>
            </div>
            <ul className="h2-acts">
              <li>
                <Icon path={I.wand} size={14}/>
                <div>
                  <div className="h2-li-t">أنشئ فيديو للثلاثاء ٤م</div>
                  <div className="h2-li-s">أفضل وقت · +٢٢٪ احتمال وصول</div>
                </div>
              </li>
              <li>
                <Icon path={I.spark} size={14}/>
                <div>
                  <div className="h2-li-t">اقترح ٥ أفكار محتوى</div>
                  <div className="h2-li-s">بنفس أسلوب منشورك الأعلى</div>
                </div>
              </li>
              <li>
                <Icon path={<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>} size={14}/>
                <div>
                  <div className="h2-li-t">ضع خطة الأسبوع القادم</div>
                  <div className="h2-li-s">٧ منشورات مقترحة</div>
                </div>
              </li>
            </ul>
          </article>
        </section>

        <MPGAskFab />
      </main>

      <style>{`
        .h2 { display:flex; min-height:100vh; background:var(--canvas); }
        .h2-main { flex:1; padding:32px 40px 60px; display:flex; flex-direction:column; gap:22px; max-width:1480px; }

        .h2-hero { display:grid; grid-template-columns:1.4fr 1fr; gap:40px; padding:32px 38px; background:var(--surface); border:1px solid var(--line); border-radius:22px; align-items:center; }
        .h2-date { font-size:12px; color:var(--ink-500); font-weight:500; letter-spacing:0.02em; margin-bottom:14px; }
        .h2-hero h1 { font-size:32px; font-weight:700; color:var(--ink-950); letter-spacing:-0.025em; line-height:1.25; margin:0 0 12px; text-wrap:balance; }
        .h2-hero p { font-size:14.5px; color:var(--ink-600); line-height:1.65; margin:0; max-width:520px; }

        .h2-spectrum { background:var(--ink-50); border-radius:16px; padding:22px; }
        .h2-spectrum-head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:14px; font-size:13px; color:var(--ink-600); font-weight:500; }
        .h2-spectrum-head .num { font-size:26px; font-weight:700; letter-spacing:-0.02em; }
        .h2-spectrum-head em { font-style:normal; font-size:12px; opacity:.6; margin-inline-start:2px; font-family:var(--mono); }
        .h2-spectrum-bar { height:10px; background:linear-gradient(90deg, oklch(0.7 0.2 30), oklch(0.75 0.18 75), oklch(0.65 0.15 155)); border-radius:99px; position:relative; overflow:visible; }
        .h2-spectrum-fill { display:none; }
        .h2-spectrum-mark { position:absolute; top:-6px; width:4px; height:22px; background:var(--ink-950); border-radius:2px; transform:translateX(50%); box-shadow:0 0 0 3px #fff; }
        .h2-spectrum-labels { display:flex; justify-content:space-between; margin-top:12px; font-size:11px; color:var(--ink-500); font-weight:500; }

        .h2-band { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        .h2-b-card { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:18px 20px; }
        .h2-b-k { font-size:11px; color:var(--ink-500); font-weight:500; margin-bottom:10px; }
        .h2-b-row { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:8px; }
        .h2-b-v { font-size:28px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; line-height:1; }
        .h2-b-spark { display:flex; gap:2.5px; align-items:flex-end; height:32px; width:90px; }
        .h2-b-spark > div { flex:1; background:var(--purple-200); border-radius:2px 2px 0 0; min-height:3px; }
        .h2-b-d { font-size:12px; font-weight:600; }
        .h2-b-d.up { color:oklch(0.5 0.15 155); }

        .h2-cols { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
        .h2-col { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:22px; display:flex; flex-direction:column; gap:14px; }
        .h2-col--action { background:linear-gradient(135deg, var(--purple-50), oklch(0.97 0.03 280)); border-color:var(--purple-200); }
        .h2-col-head { display:flex; justify-content:space-between; align-items:center; }
        .h2-col-k { font-size:12px; font-weight:700; letter-spacing:0.02em; }
        .h2-col-k.good { color:oklch(0.5 0.15 155); }
        .h2-col-k.bad { color:oklch(0.55 0.15 30); }
        .h2-col-k.accent { color:var(--purple-700); }
        .h2-col-n { font-size:11px; color:var(--ink-500); font-weight:500; background:var(--ink-100); padding:3px 9px; border-radius:99px; }
        .h2-col--action .h2-col-n { background:var(--surface); }

        .h2-col ul { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:2px; flex:1; }
        .h2-col li { padding:12px 14px; border-radius:12px; transition:background .15s; }
        .h2-col li:hover { background:var(--ink-50); }
        .h2-col--action li:hover { background:rgba(255,255,255,.6); }
        .h2-acts li { display:flex; gap:12px; align-items:flex-start; cursor:pointer; }
        .h2-acts li svg { color:var(--purple-700); margin-top:2px; flex-shrink:0; }
        .h2-li-t { font-size:13.5px; font-weight:600; color:var(--ink-950); margin-bottom:4px; line-height:1.4; }
        .h2-li-s { font-size:12px; color:var(--ink-600); line-height:1.55; }
        .h2-li-s b { color:var(--ink-950); font-weight:700; }

        .h2-col-cta { padding:10px; background:transparent; border:1px solid var(--line); border-radius:10px; font-size:12px; color:var(--ink-700); font-weight:500; margin-top:4px; }
        .h2-col-cta:hover { border-color:var(--purple-300); color:var(--purple-700); }
      `}</style>
    </div>
  );
};

// =========================================================
// H3 — "Mission control" dense
// Sticky top bar with mini health + score; then a 3x2 grid of small tiles
// for ambitious power-users. Everything scannable at a glance.
// =========================================================
const HomeH3 = () => {
  return (
    <div dir="rtl" className="h3">
      <Sidebar active="home"/>
      <main className="h3-main">
        {/* Compact top */}
        <header className="h3-head">
          <div className="h3-title">
            <h1>الرئيسية</h1>
            <span className="h3-pulse"><i/>محدّث الآن</span>
          </div>
          <div className="h3-score">
            <div className="h3-score-k">صحة نموك</div>
            <div className="h3-score-bar">
              <div style={{width:'65%'}}/>
            </div>
            <div className="h3-score-v num">٦٥<em>/١٠٠</em></div>
          </div>
          <div className="h3-head-ctrls">
            <div className="h3-seg">
              <button>٧</button>
              <button className="is-on">٣٠</button>
              <button>٩٠ يوم</button>
            </div>
            <button className="h3-new">
              <Icon path={I.plus} size={12}/>
              جديد
            </button>
          </div>
        </header>

        {/* Top insight banner */}
        <div className="h3-insight">
          <span className="h3-ins-av">✦</span>
          <div className="h3-ins-body">
            <strong>توصيتي:</strong> انشر فيديو قصير يوم الثلاثاء ٤م — <b className="num">+٢٢٪</b> احتمال وصول.
          </div>
          <button className="h3-ins-btn">طبّق</button>
        </div>

        {/* 3-col grid */}
        <div className="h3-grid">
          {/* Row 1 */}
          <div className="h3-tile">
            <div className="h3-t-head"><h3>التفاعل</h3><span className="h3-t-ch up num">+١.٢٪</span></div>
            <div className="h3-t-v num">٩.٦٪</div>
            <div className="h3-t-chart">
              {[3,5,4,6,5,8,7,9,8,10,9,12,8,11,10,13].map((h,i)=>(
                <div key={i} style={{height:`${h*5+20}%`}}/>
              ))}
            </div>
            <div className="h3-t-foot">متوسط ٣٠ يوم</div>
          </div>

          <div className="h3-tile">
            <div className="h3-t-head"><h3>الوصول</h3><span className="h3-t-ch up num">+٨٪</span></div>
            <div className="h3-t-v num">٤٨.٢K</div>
            <div className="h3-t-chart">
              {[4,5,4,6,7,6,8,7,9,8,10,11,10,12,11,13].map((h,i)=>(
                <div key={i} style={{height:`${h*5+20}%`}} className="alt"/>
              ))}
            </div>
            <div className="h3-t-foot">٣٠ يوم</div>
          </div>

          <div className="h3-tile h3-tile--pattern">
            <div className="h3-t-head"><h3>أفضل نمط</h3><TypePill type="video" size="sm"/></div>
            <div className="h3-t-p">
              <div className="h3-t-p-t">فيديو · الثلاثاء ٤م</div>
              <div className="h3-t-p-s">٥ منشورات · متوسط <b className="num">٤.٨٪</b></div>
            </div>
            <button className="h3-t-cta">أنشئ مشابهاً</button>
          </div>

          {/* Row 2 */}
          <div className="h3-tile h3-tile--health">
            <div className="h3-t-head"><h3>تفاصيل الصحة</h3></div>
            {[
              { k: 'الجمهور',  v: 29, t: 'bad' },
              { k: 'إنستغرام', v: 9,  t: 'bad' },
              { k: 'الانتظام', v: 0,  t: 'bad' },
              { k: 'التنوّع',   v: 100, t: 'good' },
            ].map((r,i)=>(
              <div key={i} className="h3-hr">
                <span>{r.k}</span>
                <div className="h3-hr-t"><div className={r.t} style={{width:`${r.v}%`}}/></div>
                <span className={`num ${r.t}`}>{r.v}٪</span>
              </div>
            ))}
          </div>

          <div className="h3-tile h3-tile--wide">
            <div className="h3-t-head">
              <h3>أنماط محتواك</h3>
              <button className="h3-link">الكل ↩</button>
            </div>
            <div className="h3-pattern-list">
              {[
                { title: 'Low-Engagement Video Afternoon', pct: 52, tone: 'video' },
                { title: 'Low-Engagement Visual Morning',  pct: 33, tone: 'image' },
                { title: 'Low-Engagement Video Morning',   pct: 10, tone: 'video' },
              ].map((p,i)=>(
                <div key={i} className="h3-pat">
                  <div className="num h3-pat-n" style={{color:TYPE_META[p.tone].color}}>{p.pct}٪</div>
                  <div className="h3-pat-t">{p.title}</div>
                  <TypeIcon type={p.tone} size={14}/>
                </div>
              ))}
            </div>
          </div>
        </div>

        <MPGAskFab />
      </main>

      <style>{`
        .h3 { display:flex; min-height:100vh; background:var(--canvas); }
        .h3-main { flex:1; padding:24px 32px 40px; display:flex; flex-direction:column; gap:14px; max-width:1480px; }

        .h3-head { display:flex; align-items:center; gap:20px; background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:14px 20px; }
        .h3-title { display:flex; align-items:center; gap:12px; }
        .h3-title h1 { font-size:20px; font-weight:700; color:var(--ink-950); margin:0; letter-spacing:-0.015em; }
        .h3-pulse { display:inline-flex; align-items:center; gap:6px; font-size:11px; color:var(--ink-500); font-weight:500; }
        .h3-pulse i { width:6px; height:6px; border-radius:50%; background:oklch(0.65 0.15 155); animation:h3-pulse 2s infinite; }
        @keyframes h3-pulse { 0%,100%{opacity:1;} 50%{opacity:.4;} }

        .h3-score { flex:1; display:flex; align-items:center; gap:12px; max-width:340px; }
        .h3-score-k { font-size:12px; color:var(--ink-600); font-weight:500; flex-shrink:0; }
        .h3-score-bar { flex:1; height:8px; background:var(--ink-100); border-radius:99px; overflow:hidden; }
        .h3-score-bar > div { height:100%; background:linear-gradient(90deg, var(--purple-400), var(--purple-700)); border-radius:99px; }
        .h3-score-v { font-size:16px; font-weight:700; color:var(--purple-700); letter-spacing:-0.01em; }
        .h3-score-v em { font-style:normal; font-size:11px; opacity:.6; font-weight:500; font-family:var(--mono); }

        .h3-head-ctrls { display:flex; gap:8px; align-items:center; }
        .h3-seg { display:flex; background:var(--ink-100); border-radius:8px; padding:3px; }
        .h3-seg button { padding:5px 10px; font-size:11.5px; border-radius:5px; color:var(--ink-600); font-weight:500; }
        .h3-seg button.is-on { background:var(--surface); color:var(--ink-900); font-weight:600; }
        .h3-new { display:inline-flex; align-items:center; gap:4px; padding:7px 12px; background:var(--ink-900); color:#fff; border-radius:8px; font-size:12px; font-weight:600; }

        .h3-insight { display:flex; align-items:center; gap:12px; padding:12px 18px; background:linear-gradient(135deg, var(--purple-50), oklch(0.97 0.03 280)); border:1px solid var(--purple-200); border-radius:12px; }
        .h3-ins-av { width:30px; height:30px; border-radius:8px; background:linear-gradient(135deg, var(--purple-500), var(--purple-700)); color:#fff; display:grid; place-items:center; font-size:13px; font-weight:700; flex-shrink:0; }
        .h3-ins-body { flex:1; font-size:13px; color:var(--ink-900); font-weight:500; }
        .h3-ins-body strong { color:var(--purple-800); font-weight:700; }
        .h3-ins-body b { color:oklch(0.5 0.15 155); font-weight:700; }
        .h3-ins-btn { padding:7px 14px; background:var(--purple-600); color:#fff; border-radius:8px; font-size:12px; font-weight:600; }

        .h3-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; }
        .h3-tile { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:18px 20px; display:flex; flex-direction:column; gap:10px; }
        .h3-tile--wide { grid-column:span 2; }
        .h3-t-head { display:flex; justify-content:space-between; align-items:center; }
        .h3-t-head h3 { font-size:13px; font-weight:600; color:var(--ink-600); margin:0; letter-spacing:0; }
        .h3-t-ch { font-size:11px; font-weight:700; padding:2px 8px; border-radius:99px; }
        .h3-t-ch.up { color:oklch(0.5 0.15 155); background:oklch(0.96 0.06 155); }
        .h3-t-v { font-size:30px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; line-height:1; }
        .h3-t-chart { display:flex; gap:2px; align-items:flex-end; height:60px; margin:auto 0 4px; }
        .h3-t-chart > div { flex:1; background:var(--purple-300); border-radius:2px 2px 0 0; min-height:4px; }
        .h3-t-chart > div.alt { background:oklch(0.8 0.1 200); }
        .h3-t-foot { font-size:11px; color:var(--ink-400); font-weight:500; }

        .h3-tile--pattern { justify-content:space-between; }
        .h3-t-p { padding:14px 0; flex:1; }
        .h3-t-p-t { font-size:15px; font-weight:700; color:var(--ink-950); margin-bottom:4px; letter-spacing:-0.005em; }
        .h3-t-p-s { font-size:12px; color:var(--ink-600); }
        .h3-t-p-s b { color:var(--ink-950); font-weight:700; }
        .h3-t-cta { padding:9px; background:var(--purple-600); color:#fff; border-radius:9px; font-size:12px; font-weight:600; }

        .h3-tile--health { gap:8px; }
        .h3-hr { display:grid; grid-template-columns:70px 1fr 40px; align-items:center; gap:10px; font-size:12px; color:var(--ink-700); font-weight:500; }
        .h3-hr-t { height:6px; background:var(--ink-100); border-radius:99px; overflow:hidden; }
        .h3-hr-t > div { height:100%; border-radius:99px; transition:width .5s; }
        .h3-hr-t .good { background:oklch(0.65 0.15 155); }
        .h3-hr-t .bad  { background:oklch(0.65 0.2 30); }
        .h3-hr .num { text-align:start; font-weight:700; font-size:12px; letter-spacing:-0.005em; }
        .h3-hr .num.good { color:oklch(0.5 0.15 155); }
        .h3-hr .num.bad  { color:oklch(0.6 0.2 30); }

        .h3-link { font-size:11.5px; color:var(--purple-700); font-weight:500; }
        .h3-pattern-list { display:flex; flex-direction:column; gap:6px; }
        .h3-pat { display:grid; grid-template-columns:52px 1fr auto; align-items:center; gap:12px; padding:10px 12px; background:var(--ink-50); border-radius:10px; }
        .h3-pat-n { font-size:16px; font-weight:700; letter-spacing:-0.01em; }
        .h3-pat-t { font-size:12px; font-weight:600; color:var(--ink-900); font-family:var(--mono); letter-spacing:-0.005em; }
      `}</style>
    </div>
  );
};

// =========================================================
// H4 — "Action focus"
// Single hero score + 3 big action cards; health as a secondary row
// Maximalist visual, opinionated, mobile-ish proportions
// =========================================================
const HomeH4 = () => {
  return (
    <div dir="rtl" className="h4">
      <Sidebar active="home"/>
      <main className="h4-main">
        <header className="h4-head">
          <div>
            <div className="h4-greet">مساء الخير Tasyeer</div>
            <h1>صحة حسابك <span className="num h4-score">٦٥</span><em>/١٠٠</em></h1>
            <p>نمو جيد هذا الشهر (<b className="num up">+٨</b> نقاط). ركّز على ٣ إجراءات لرفعها.</p>
          </div>
          <div className="h4-head-r">
            <div className="h4-chip"><i className="dot"/>محدّث الآن</div>
          </div>
        </header>

        {/* Big action cards */}
        <section className="h4-actions">
          <article className="h4-act h4-act--1">
            <div className="h4-act-num num">٠١</div>
            <div className="h4-act-k">أولوية عالية</div>
            <h3>انشر فيديو اليوم</h3>
            <p>لم تنشر منذ ٣ أيام. الفيديو يحقق لك أعلى تفاعل (٤.٨٪) — الثلاثاء ٤م هو الوقت الأمثل.</p>
            <div className="h4-act-meta">
              <span><Icon path={I.clock} size={11}/> اليوم ١٦:٠٠</span>
              <span className="up">+٢٢٪ وصول متوقع</span>
            </div>
            <button className="h4-act-btn primary">
              <Icon path={I.wand} size={13}/>
              أنشئ فيديو الآن
            </button>
          </article>

          <article className="h4-act h4-act--2">
            <div className="h4-act-num num">٠٢</div>
            <div className="h4-act-k">توصية</div>
            <h3>استكشف ٣ مواضيع جديدة</h3>
            <p>جمهورك أكبر من محتواك. جرّب دمج مواضيع ذات صلة بالإنستقرام أو نمط المحتوى لزيادة تنوّع شرائح الجمهور.</p>
            <div className="h4-act-sugg">
              <span>تسويق بالفيديو</span>
              <span>نصائح سريعة</span>
              <span>قصص عملاء</span>
            </div>
            <button className="h4-act-btn">توسيع نطاق الجمهور</button>
          </article>

          <article className="h4-act h4-act--3">
            <div className="h4-act-num num">٠٣</div>
            <div className="h4-act-k">مراجعة</div>
            <h3>حلل ما ينجح وما لا</h3>
            <p>لديك ٣٥ منشور يمكن أن يكشف أنماطاً مخفية. افتح منشوراتي لمراجعة التحليل الكامل.</p>
            <div className="h4-act-mini">
              <div><span className="num">٤.٨٪</span><em>فيديو</em></div>
              <div><span className="num">١.٩٪</span><em>صورة</em></div>
              <div><span className="num">٢.٢٪</span><em>كاروسيل</em></div>
            </div>
            <button className="h4-act-btn">فتح منشوراتي</button>
          </article>
        </section>

        {/* Secondary: health breakdown */}
        <section className="h4-health">
          <div className="h4-h-head">
            <h2>تفاصيل صحة نموك</h2>
            <p>ما الذي يرفع ويخفض نتيجتك</p>
          </div>
          <div className="h4-h-grid">
            {[
              { k: 'ملاءمة الجمهور', v: 29, hint: 'نسبة استبدال إيجابية', t: 'bad', icon: <><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/></> },
              { k: 'أداء إنستغرام',  v: 9,  hint: 'متوسط التفاعل لكل منشور', t: 'bad', icon: <><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></> },
              { k: 'الانتظام',       v: 0,  hint: 'آخر منشور: ٤ سبتمبر', t: 'bad', icon: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></> },
              { k: 'تنوّع المحتوى',   v: 100,hint: 'مزيج مثالي', t: 'good', icon: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></> },
            ].map((row,i) => (
              <div key={i} className={`h4-h-card ${row.t}`}>
                <div className="h4-h-icon"><Icon path={row.icon} size={18}/></div>
                <div className="h4-h-v num">{row.v}<em>٪</em></div>
                <div className="h4-h-k">{row.k}</div>
                <div className="h4-h-hint">{row.hint}</div>
              </div>
            ))}
          </div>
        </section>

        <MPGAskFab />
      </main>

      <style>{`
        .h4 { display:flex; min-height:100vh; background:var(--canvas); }
        .h4-main { flex:1; padding:32px 40px 60px; display:flex; flex-direction:column; gap:24px; max-width:1480px; }

        .h4-head { display:flex; justify-content:space-between; align-items:flex-end; }
        .h4-greet { font-size:12.5px; color:var(--ink-500); font-weight:500; margin-bottom:6px; }
        .h4-head h1 { font-size:34px; font-weight:700; color:var(--ink-950); letter-spacing:-0.025em; margin:0 0 10px; display:flex; align-items:baseline; gap:10px; }
        .h4-score { color:var(--purple-700); font-size:44px; letter-spacing:-0.03em; }
        .h4-head h1 em { font-size:18px; color:var(--ink-400); font-style:normal; font-weight:500; font-family:var(--mono); margin-inline-start:-6px; }
        .h4-head p { font-size:14px; color:var(--ink-600); margin:0; max-width:540px; }
        .h4-head p b.up { color:oklch(0.5 0.15 155); font-weight:700; }
        .h4-chip { display:inline-flex; align-items:center; gap:7px; font-size:12px; color:var(--ink-600); padding:6px 12px; background:var(--surface); border:1px solid var(--line); border-radius:99px; font-weight:500; }
        .h4-chip .dot { width:6px; height:6px; border-radius:50%; background:oklch(0.65 0.15 155); }

        /* Action cards */
        .h4-actions { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
        .h4-act { background:var(--surface); border:1px solid var(--line); border-radius:20px; padding:24px; display:flex; flex-direction:column; gap:10px; position:relative; overflow:hidden; }
        .h4-act--1 { background:linear-gradient(160deg, var(--purple-700), var(--purple-900)); color:#fff; border:none; }
        .h4-act--1 p { color:rgba(255,255,255,.85); }
        .h4-act--1 .h4-act-k { color:rgba(255,255,255,.75); }
        .h4-act--1 h3 { color:#fff; }
        .h4-act--1 .h4-act-num { color:rgba(255,255,255,.25); }
        .h4-act--1 .h4-act-meta { color:rgba(255,255,255,.8); }
        .h4-act--1 .h4-act-meta svg { opacity:.7; }
        .h4-act-num { position:absolute; top:18px; inset-inline-end:22px; font-size:54px; font-weight:700; color:var(--ink-100); letter-spacing:-0.03em; line-height:1; }
        .h4-act-k { font-size:11px; font-weight:700; color:var(--ink-500); letter-spacing:0.04em; text-transform:uppercase; }
        .h4-act h3 { font-size:22px; font-weight:700; color:var(--ink-950); margin:4px 0 6px; letter-spacing:-0.015em; line-height:1.25; }
        .h4-act p { font-size:13.5px; color:var(--ink-700); line-height:1.65; margin:0 0 6px; text-wrap:pretty; }

        .h4-act-meta { display:flex; gap:14px; font-size:11.5px; color:var(--ink-500); font-weight:500; padding:10px 0; margin-top:auto; }
        .h4-act-meta span { display:inline-flex; align-items:center; gap:4px; }
        .h4-act-meta .up { color:oklch(0.7 0.15 150); }

        .h4-act-sugg { display:flex; flex-wrap:wrap; gap:6px; margin-top:auto; padding:8px 0; }
        .h4-act-sugg span { padding:5px 12px; background:var(--purple-50); color:var(--purple-800); border-radius:99px; font-size:11.5px; font-weight:500; }

        .h4-act-mini { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; padding:12px; background:var(--ink-50); border-radius:10px; margin-top:auto; }
        .h4-act-mini > div { text-align:center; }
        .h4-act-mini .num { display:block; font-size:16px; font-weight:700; color:var(--ink-950); letter-spacing:-0.01em; line-height:1.1; }
        .h4-act-mini em { font-style:normal; font-size:11px; color:var(--ink-500); font-weight:500; }

        .h4-act-btn { padding:11px; background:var(--ink-900); color:#fff; border-radius:10px; font-size:13px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:6px; margin-top:6px; }
        .h4-act-btn:hover { background:var(--ink-800); }
        .h4-act-btn.primary { background:#fff; color:var(--purple-800); }
        .h4-act-btn.primary:hover { background:rgba(255,255,255,.9); }

        /* Health */
        .h4-health { background:var(--surface); border:1px solid var(--line); border-radius:20px; padding:26px; }
        .h4-h-head { margin-bottom:18px; }
        .h4-h-head h2 { font-size:18px; font-weight:700; color:var(--ink-950); margin:0 0 4px; letter-spacing:-0.01em; }
        .h4-h-head p { font-size:12.5px; color:var(--ink-500); margin:0; }
        .h4-h-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        .h4-h-card { padding:20px; border-radius:14px; background:var(--ink-50); border:1px solid var(--line); display:flex; flex-direction:column; gap:8px; }
        .h4-h-card.good { background:oklch(0.97 0.04 155); border-color:oklch(0.88 0.1 155); }
        .h4-h-card.bad  { background:oklch(0.98 0.02 30); border-color:oklch(0.9 0.1 30); }
        .h4-h-icon { width:32px; height:32px; border-radius:10px; background:var(--surface); color:var(--ink-700); display:grid; place-items:center; }
        .h4-h-card.good .h4-h-icon { color:oklch(0.5 0.15 155); }
        .h4-h-card.bad .h4-h-icon { color:oklch(0.55 0.2 30); }
        .h4-h-v { font-size:30px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; line-height:1; }
        .h4-h-v em { font-size:15px; font-style:normal; opacity:.5; font-weight:500; margin-inline-start:2px; }
        .h4-h-card.good .h4-h-v { color:oklch(0.4 0.15 155); }
        .h4-h-card.bad .h4-h-v  { color:oklch(0.5 0.2 30); }
        .h4-h-k { font-size:13px; font-weight:700; color:var(--ink-900); }
        .h4-h-hint { font-size:11.5px; color:var(--ink-600); line-height:1.5; }
      `}</style>
    </div>
  );
};

window.HomeH2 = HomeH2;
window.HomeH3 = HomeH3;
window.HomeH4 = HomeH4;
