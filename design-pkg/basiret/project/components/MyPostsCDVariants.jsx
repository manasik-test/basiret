// My Posts — 3 more merged (conversational + dense) directions
// E = Side-thread + big chart focus
// F = Card-flow timeline (vertical story)
// G = Split workspace (thread left, live cockpit right)

// =========================================================
// OPTION E — Executive briefing
// Top: hero AI headline + 3 KPI cards
// Middle: big chart panel as the centerpiece
// Bottom: 2-col briefing cards (winner/loser) + mini chat
// =========================================================
const MyPostsE = () => {
  const w = POSTS_DATA.winner;
  const l = POSTS_DATA.loser;
  return (
    <div dir="rtl" className="mpe">
      <Sidebar active="posts" />
      <main className="mpe-main">
        <header className="mpe-head">
          <div className="mpe-crumb">منشوراتي · ملخص تنفيذي</div>
          <h1>هذا الشهر: الفيديو هو بطلك</h1>
          <p className="mpe-sub">من ٣٥ منشوراً حللتها بصيرة، ظهر نمط واضح. إليك ما وجدتُه — وماذا أفعل الآن.</p>
        </header>

        <section className="mpe-kpi">
          <div className="mpe-kpi-card mpe-kpi--hero">
            <div className="mpe-kpi-k">إجمالي التفاعل</div>
            <div className="mpe-kpi-v num">٩.٦٪</div>
            <div className="mpe-kpi-d up">↑ <span className="num">+١.٢٪</span> مقارنة بالشهر الماضي</div>
            <div className="mpe-spark">
              {[3,5,4,6,5,8,7,9,8,10,9,12].map((h,i)=><div key={i} style={{height:`${h*5}%`}}/>)}
            </div>
          </div>
          <div className="mpe-kpi-card">
            <div className="mpe-kpi-k">وصول كلي</div>
            <div className="mpe-kpi-v num">٤٨.٢K</div>
            <div className="mpe-kpi-d up">↑ <span className="num">+٨٪</span></div>
          </div>
          <div className="mpe-kpi-card">
            <div className="mpe-kpi-k">أفضل نوع</div>
            <div className="mpe-kpi-v" style={{fontSize:22}}>فيديو</div>
            <div className="mpe-kpi-d"><span className="num">٤.٨٪</span> متوسط تفاعل</div>
          </div>
        </section>

        <section className="mpe-chart-panel">
          <div className="mpe-panel-head">
            <div>
              <h2>التفاعل عبر ٣٠ يوم</h2>
              <p>مقارنة الفيديو، الصور، والكاروسيل</p>
            </div>
            <div className="mpe-legend">
              {POSTS_DATA.chart.map(c=>(
                <span key={c.type}>
                  <i style={{background:TYPE_META[c.type].color}}/>
                  {TYPE_META[c.type].ar} <b className="num">{c.engagement}٪</b>
                </span>
              ))}
            </div>
          </div>
          <div className="mpe-big-chart">
            {POSTS_DATA.chart.map(c=>{
              const pct = (c.engagement/5)*100;
              return (
                <div key={c.type} className="mpe-barx">
                  <div className="mpe-barx-track">
                    <div className="mpe-barx-fill" style={{height:`${pct}%`, background:TYPE_META[c.type].color}}>
                      <div className="mpe-barx-val num">{c.engagement}٪</div>
                    </div>
                  </div>
                  <div className="mpe-barx-lbl">
                    <TypeIcon type={c.type} size={14}/>
                    <span>{TYPE_META[c.type].ar}</span>
                    <em className="num">{c.posts} منشور</em>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mpe-briefs">
          <article className="mpe-brief mpe-brief--good">
            <div className="mpe-brief-k">
              <span>✓ كرّر هذا</span>
              <TypePill type="video" size="sm"/>
            </div>
            <h3>{w.postTopic}</h3>
            <div className="mpe-brief-stats">
              <span><strong className="num">{w.impressions}٪</strong> تفاعل</span>
              <span><strong className="num">{w.likes}</strong> إعجاب</span>
              <span><strong className="num">{w.reach}</strong> وصول</span>
            </div>
            <p>{w.body}</p>
            <button className="mpe-brief-cta"><Icon path={I.wand} size={13}/> أنشئ مشابهاً</button>
          </article>
          <article className="mpe-brief mpe-brief--bad">
            <div className="mpe-brief-k">
              <span>✗ تجنّب هذا</span>
              <TypePill type="image" size="sm"/>
            </div>
            <h3>{l.topic}</h3>
            <p>{l.body}</p>
            <div className="mpe-tip">
              <strong>البديل:</strong> {l.recommendation}
            </div>
          </article>
        </section>

        <section className="mpe-ask">
          <div className="mpe-ask-head">
            <span className="mpe-ask-av">✦</span>
            <div>
              <div className="mpe-ask-k">اسأل بصيرة</div>
              <div className="mpe-ask-t">هل تريد تحليلاً أعمق؟</div>
            </div>
          </div>
          <div className="mpe-sugg">
            <button>أفضل وقت للنشر؟</button>
            <button>اقترح ٣ أفكار محتوى</button>
            <button>لماذا انخفض وصولي؟</button>
            <button>قارن مع الشهر الماضي</button>
          </div>
        </section>
      </main>

      <style>{`
        .mpe { display:flex; min-height:100vh; background:var(--canvas); }
        .mpe-main { flex:1; padding:32px 40px 48px; display:flex; flex-direction:column; gap:22px; max-width:1480px; }
        .mpe-head { max-width:760px; }
        .mpe-crumb { font-size:12px; color:var(--ink-500); font-weight:500; margin-bottom:10px; }
        .mpe-head h1 { font-size:34px; font-weight:700; color:var(--ink-950); letter-spacing:-0.025em; line-height:1.2; margin:0 0 8px; text-wrap:balance; }
        .mpe-sub { font-size:14.5px; color:var(--ink-600); line-height:1.6; margin:0; }

        .mpe-kpi { display:grid; grid-template-columns:1.4fr 1fr 1fr; gap:14px; }
        .mpe-kpi-card { background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:20px 22px; }
        .mpe-kpi--hero { background:linear-gradient(135deg, var(--purple-700), var(--purple-800)); border-color:var(--purple-700); color:#fff; position:relative; overflow:hidden; }
        .mpe-kpi--hero .mpe-kpi-k { color:rgba(255,255,255,.75); }
        .mpe-kpi--hero .mpe-kpi-v { color:#fff; }
        .mpe-kpi--hero .mpe-kpi-d { color:rgba(255,255,255,.9); }
        .mpe-kpi-k { font-size:11.5px; color:var(--ink-500); font-weight:500; margin-bottom:10px; }
        .mpe-kpi-v { font-size:32px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; line-height:1; margin-bottom:8px; }
        .mpe-kpi-d { font-size:12.5px; font-weight:500; color:var(--ink-600); }
        .mpe-kpi-d.up { color:oklch(0.55 0.15 155); }
        .mpe-kpi--hero .mpe-kpi-d.up { color:oklch(0.9 0.12 150); }
        .mpe-spark { position:absolute; bottom:0; inset-inline:20px; height:56px; display:flex; gap:4px; align-items:flex-end; opacity:.4; }
        .mpe-spark > div { flex:1; background:#fff; border-radius:3px 3px 0 0; }

        .mpe-chart-panel { background:var(--surface); border:1px solid var(--line); border-radius:20px; padding:26px; }
        .mpe-panel-head { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:24px; }
        .mpe-panel-head h2 { font-size:18px; font-weight:700; color:var(--ink-950); margin:0 0 4px; letter-spacing:-0.01em; }
        .mpe-panel-head p { font-size:12.5px; color:var(--ink-500); margin:0; }
        .mpe-legend { display:flex; gap:16px; font-size:12px; color:var(--ink-700); }
        .mpe-legend span { display:inline-flex; align-items:center; gap:6px; font-weight:500; }
        .mpe-legend i { width:10px; height:10px; border-radius:3px; }
        .mpe-legend b { color:var(--ink-900); font-weight:700; }

        .mpe-big-chart { display:flex; gap:24px; align-items:flex-end; height:260px; padding:0 20px; }
        .mpe-barx { flex:1; display:flex; flex-direction:column; gap:12px; }
        .mpe-barx-track { flex:1; position:relative; border-radius:12px; background:var(--ink-50); overflow:hidden; min-height:220px; }
        .mpe-barx-fill { position:absolute; inset:auto 0 0 0; border-radius:12px 12px 0 0; display:flex; justify-content:center; padding-top:18px; transition:height .6s cubic-bezier(.2,.8,.2,1); }
        .mpe-barx-val { color:#fff; font-size:18px; font-weight:700; text-shadow:0 1px 2px rgba(0,0,0,.15); letter-spacing:-0.01em; }
        .mpe-barx-lbl { display:flex; align-items:center; justify-content:center; gap:8px; font-size:13px; color:var(--ink-800); font-weight:600; }
        .mpe-barx-lbl em { font-style:normal; color:var(--ink-500); font-weight:500; font-size:11.5px; }

        .mpe-briefs { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .mpe-brief { background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:22px; position:relative; overflow:hidden; }
        .mpe-brief::before { content:''; position:absolute; top:0; inset-inline-start:0; height:4px; inset-inline:0; }
        .mpe-brief--good::before { background:oklch(0.65 0.15 155); }
        .mpe-brief--bad::before { background:oklch(0.65 0.15 30); }
        .mpe-brief-k { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
        .mpe-brief-k > span { font-size:11.5px; font-weight:700; letter-spacing:0.02em; }
        .mpe-brief--good .mpe-brief-k > span { color:oklch(0.45 0.15 155); }
        .mpe-brief--bad .mpe-brief-k > span { color:oklch(0.55 0.15 30); }
        .mpe-brief h3 { font-size:16px; font-weight:700; color:var(--ink-950); margin:0 0 12px; line-height:1.4; }
        .mpe-brief-stats { display:flex; gap:18px; padding:12px 14px; background:var(--ink-50); border-radius:10px; margin-bottom:14px; font-size:12px; color:var(--ink-600); font-weight:500; }
        .mpe-brief-stats strong { color:var(--ink-950); font-weight:700; font-size:14px; letter-spacing:-0.005em; margin-inline-end:4px; }
        .mpe-brief p { font-size:13.5px; color:var(--ink-800); line-height:1.7; margin:0 0 14px; text-wrap:pretty; }
        .mpe-brief-cta { padding:10px 16px; background:var(--ink-900); color:#fff; border-radius:9px; font-size:12.5px; font-weight:600; display:inline-flex; align-items:center; gap:7px; }
        .mpe-tip { padding:12px 14px; background:oklch(0.98 0.02 30); border-radius:10px; font-size:13px; color:var(--ink-900); line-height:1.6; }
        .mpe-tip strong { color:oklch(0.5 0.15 30); font-weight:700; }

        .mpe-ask { background:var(--purple-50); border:1px solid var(--purple-200); border-radius:16px; padding:20px 24px; display:flex; justify-content:space-between; align-items:center; gap:20px; }
        .mpe-ask-head { display:flex; gap:12px; align-items:center; }
        .mpe-ask-av { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg, var(--purple-500), var(--purple-700)); color:#fff; display:grid; place-items:center; font-size:15px; font-weight:700; }
        .mpe-ask-k { font-size:11px; font-weight:700; color:var(--purple-700); margin-bottom:2px; }
        .mpe-ask-t { font-size:13.5px; color:var(--ink-900); font-weight:600; }
        .mpe-sugg { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
        .mpe-sugg button { padding:8px 14px; background:var(--surface); border:1px solid var(--purple-200); border-radius:99px; font-size:12px; color:var(--purple-800); font-weight:500; }
        .mpe-sugg button:hover { background:var(--purple-600); color:#fff; border-color:var(--purple-600); }
      `}</style>
    </div>
  );
};

// =========================================================
// OPTION F — Story scroll
// Vertical narrative: hero headline, then 4 "scenes"
// each combining one insight + its proof (stat or chart)
// Feels editorial, like a narrated report
// =========================================================
const MyPostsF = () => {
  const w = POSTS_DATA.winner;
  const l = POSTS_DATA.loser;
  return (
    <div dir="rtl" className="mpf">
      <Sidebar active="posts" />
      <main className="mpf-main">
        <div className="mpf-banner">
          <div className="mpf-banner-k">تقرير الشهر · ٢٢ أبريل</div>
          <h1>قصّة أدائك هذا الشهر</h1>
          <p>من تحليل ٣٥ منشوراً. ٤ ملاحظات سترشد خطتك القادمة.</p>
          <div className="mpf-kpi-inline">
            <div><span className="num">٣٥</span><em>منشور</em></div>
            <div className="mpf-sep"/>
            <div><span className="num">٩.٦٪</span><em>تفاعل</em></div>
            <div className="mpf-sep"/>
            <div><span className="num">٤٨.٢K</span><em>وصول</em></div>
            <div className="mpf-sep"/>
            <div><span className="num up">+١٢٪</span><em>نمو</em></div>
          </div>
        </div>

        {/* Scene 1 */}
        <section className="mpf-scene">
          <div className="mpf-scene-l">
            <div className="mpf-step">١</div>
            <div className="mpf-k good">النمط الأقوى</div>
            <h2>الفيديو هو عمودك الفقري</h2>
            <p>متوسط تفاعل الفيديو <strong className="num">٤.٨٪</strong> — أعلى بمرتين ونصف من الصور الثابتة. لم يخذلك هذا الشهر.</p>
          </div>
          <div className="mpf-scene-r">
            <div className="mpf-chart-inline">
              {POSTS_DATA.chart.map(c=>(
                <div key={c.type} className="mpf-bar-inline">
                  <div className="mpf-bar-inline-l">
                    <TypeIcon type={c.type} size={12}/>
                    <span>{TYPE_META[c.type].ar}</span>
                  </div>
                  <div className="mpf-bar-inline-t">
                    <div style={{width:`${(c.engagement/5)*100}%`, background:TYPE_META[c.type].color}}/>
                  </div>
                  <span className="num mpf-bar-inline-n">{c.engagement}٪</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Scene 2 */}
        <section className="mpf-scene mpf-scene--rev">
          <div className="mpf-scene-l">
            <div className="mpf-step">٢</div>
            <div className="mpf-k good">المنشور البطل</div>
            <h2>{w.postTopic}</h2>
            <p>{w.body}</p>
            <div className="mpf-actions">
              <button className="mpf-btn"><Icon path={I.wand} size={13}/> أنشئ مشابهاً</button>
              <button className="mpf-btn ghost">عرض المنشور</button>
            </div>
          </div>
          <div className="mpf-scene-r">
            <div className="mpf-post-card">
              <Thumb variant="purple" h={180}>
                <div style={{position:'absolute', top:14, insetInlineEnd:14}}><TypePill type="video"/></div>
              </Thumb>
              <div className="mpf-post-pb">
                <div className="mpf-post-stats">
                  <div><span className="num">{w.impressions}٪</span><em>تفاعل</em></div>
                  <div><span className="num">{w.likes}</span><em>إعجاب</em></div>
                  <div><span className="num">{w.reach}</span><em>وصول</em></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Scene 3 */}
        <section className="mpf-scene">
          <div className="mpf-scene-l">
            <div className="mpf-step">٣</div>
            <div className="mpf-k bad">ما يستنزف أداءك</div>
            <h2>الصور بدون سياق</h2>
            <p>{l.body}</p>
            <div className="mpf-rec">
              <strong>التوصية:</strong> {l.recommendation}
            </div>
          </div>
          <div className="mpf-scene-r">
            <div className="mpf-compare">
              <div className="mpf-compare-row">
                <div className="mpf-compare-k">الصور الثابتة</div>
                <div className="mpf-compare-bar"><div style={{width:'38%', background:TYPE_META.image.color}}/></div>
                <div className="num mpf-compare-v bad">١.٩٪</div>
              </div>
              <div className="mpf-compare-row">
                <div className="mpf-compare-k">الفيديو</div>
                <div className="mpf-compare-bar"><div style={{width:'96%', background:TYPE_META.video.color}}/></div>
                <div className="num mpf-compare-v good">٤.٨٪</div>
              </div>
              <div className="mpf-compare-gap">فجوة <strong className="num">٢.٩٪</strong> بين الاثنين</div>
            </div>
          </div>
        </section>

        {/* Scene 4 */}
        <section className="mpf-scene mpf-scene--cta">
          <div className="mpf-step">✦</div>
          <div className="mpf-k accent">الخطوة التالية</div>
          <h2>ماذا تريد أن نفعل الآن؟</h2>
          <div className="mpf-cta-grid">
            <button className="mpf-cta-card">
              <Icon path={I.wand} size={18}/>
              <div>
                <div className="mpf-cta-t">أنشئ خطة الأسبوع القادم</div>
                <div className="mpf-cta-s">استناداً إلى ما نجح</div>
              </div>
            </button>
            <button className="mpf-cta-card">
              <Icon path={I.spark} size={18}/>
              <div>
                <div className="mpf-cta-t">اقترح ٥ أفكار فيديو</div>
                <div className="mpf-cta-s">بنفس أسلوب منشورك البطل</div>
              </div>
            </button>
            <button className="mpf-cta-card">
              <Icon path={<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>} size={18}/>
              <div>
                <div className="mpf-cta-t">جدول توقيت مثالي</div>
                <div className="mpf-cta-s">ثلاثاء ٤م · خميس ٧م</div>
              </div>
            </button>
          </div>
        </section>
      </main>

      <style>{`
        .mpf { display:flex; min-height:100vh; background:var(--canvas); }
        .mpf-main { flex:1; padding:0 0 60px; display:flex; flex-direction:column; max-width:1180px; margin:0 auto; width:100%; }

        .mpf-banner { background:linear-gradient(135deg, var(--purple-800), var(--purple-600)); color:#fff; padding:56px 48px; margin:24px; border-radius:24px; position:relative; overflow:hidden; }
        .mpf-banner::after { content:''; position:absolute; inset-inline-end:-80px; top:-80px; width:280px; height:280px; border-radius:50%; background:radial-gradient(circle, rgba(255,255,255,.15), transparent 70%); }
        .mpf-banner-k { font-size:12px; opacity:.75; font-weight:600; letter-spacing:0.02em; margin-bottom:14px; }
        .mpf-banner h1 { font-size:40px; font-weight:700; margin:0 0 12px; letter-spacing:-0.025em; line-height:1.15; }
        .mpf-banner p { font-size:16px; opacity:.85; margin:0 0 28px; max-width:560px; line-height:1.5; }
        .mpf-kpi-inline { display:flex; gap:22px; align-items:center; padding-top:20px; border-top:1px solid rgba(255,255,255,.2); }
        .mpf-kpi-inline > div:not(.mpf-sep) { display:flex; flex-direction:column; gap:2px; }
        .mpf-kpi-inline .num { font-size:22px; font-weight:700; letter-spacing:-0.015em; }
        .mpf-kpi-inline .num.up { color:oklch(0.92 0.13 150); }
        .mpf-kpi-inline em { font-size:11.5px; opacity:.7; font-style:normal; font-weight:500; }
        .mpf-sep { width:1px; height:32px; background:rgba(255,255,255,.2); }

        .mpf-scene { padding:48px; display:grid; grid-template-columns:1fr 1fr; gap:48px; align-items:center; }
        .mpf-scene--rev { direction:ltr; }
        .mpf-scene--rev > * { direction:rtl; }
        .mpf-scene + .mpf-scene { border-top:1px solid var(--line); }
        .mpf-step { width:36px; height:36px; border-radius:50%; background:var(--purple-50); color:var(--purple-700); display:grid; place-items:center; font-size:15px; font-weight:700; margin-bottom:16px; font-family:var(--mono); }
        .mpf-k { font-size:11.5px; font-weight:700; letter-spacing:0.04em; margin-bottom:10px; text-transform:uppercase; }
        .mpf-k.good { color:oklch(0.5 0.15 155); }
        .mpf-k.bad { color:oklch(0.55 0.15 30); }
        .mpf-k.accent { color:var(--purple-700); }
        .mpf-scene h2 { font-size:30px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; margin:0 0 16px; line-height:1.2; text-wrap:balance; }
        .mpf-scene p { font-size:15px; color:var(--ink-700); line-height:1.7; margin:0 0 20px; text-wrap:pretty; }
        .mpf-scene strong { color:var(--ink-950); font-weight:700; }

        .mpf-actions { display:flex; gap:10px; }
        .mpf-btn { padding:11px 18px; background:var(--ink-900); color:#fff; border-radius:10px; font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:6px; }
        .mpf-btn.ghost { background:transparent; color:var(--ink-700); border:1px solid var(--line-strong); }

        .mpf-rec { padding:14px 16px; background:oklch(0.98 0.02 30); border-radius:12px; font-size:13.5px; line-height:1.6; color:var(--ink-900); }
        .mpf-rec strong { color:oklch(0.5 0.15 30); font-weight:700; }

        .mpf-chart-inline { display:flex; flex-direction:column; gap:14px; background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:26px; }
        .mpf-bar-inline { display:grid; grid-template-columns:100px 1fr 44px; align-items:center; gap:14px; }
        .mpf-bar-inline-l { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--ink-700); font-weight:600; }
        .mpf-bar-inline-t { height:10px; background:var(--ink-100); border-radius:99px; overflow:hidden; }
        .mpf-bar-inline-t > div { height:100%; border-radius:99px; transition:width .5s; }
        .mpf-bar-inline-n { font-size:14px; font-weight:700; color:var(--ink-900); text-align:start; }

        .mpf-post-card { background:var(--surface); border:1px solid var(--line); border-radius:18px; overflow:hidden; box-shadow:var(--shadow-lg); }
        .mpf-post-card > div:first-child { border-radius:0; }
        .mpf-post-pb { padding:20px; }
        .mpf-post-stats { display:flex; gap:24px; }
        .mpf-post-stats > div { display:flex; flex-direction:column; gap:2px; }
        .mpf-post-stats .num { font-size:22px; font-weight:700; color:var(--ink-950); letter-spacing:-0.01em; }
        .mpf-post-stats em { font-style:normal; font-size:11px; color:var(--ink-500); font-weight:500; }

        .mpf-compare { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:26px; }
        .mpf-compare-row { display:grid; grid-template-columns:120px 1fr 60px; align-items:center; gap:14px; padding:10px 0; }
        .mpf-compare-row + .mpf-compare-row { border-top:1px solid var(--line); }
        .mpf-compare-k { font-size:13px; color:var(--ink-800); font-weight:600; }
        .mpf-compare-bar { height:14px; background:var(--ink-50); border-radius:99px; overflow:hidden; }
        .mpf-compare-bar > div { height:100%; border-radius:99px; transition:width .5s; }
        .mpf-compare-v { font-size:16px; font-weight:700; text-align:start; }
        .mpf-compare-v.good { color:oklch(0.5 0.15 155); }
        .mpf-compare-v.bad { color:oklch(0.6 0.15 30); }
        .mpf-compare-gap { margin-top:14px; padding-top:14px; border-top:1px dashed var(--line); text-align:center; font-size:12.5px; color:var(--ink-600); font-weight:500; }
        .mpf-compare-gap strong { color:var(--purple-700); }

        .mpf-scene--cta { grid-template-columns:1fr; text-align:center; background:var(--surface); margin:24px 48px 0; border-radius:24px; padding:48px; border:1px solid var(--line); }
        .mpf-scene--cta .mpf-step { margin:0 auto 16px; }
        .mpf-cta-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:24px; text-align:start; }
        .mpf-cta-card { background:var(--purple-50); border:1px solid var(--purple-200); border-radius:14px; padding:18px; display:flex; gap:14px; align-items:flex-start; transition:all .15s; color:var(--purple-900); }
        .mpf-cta-card:hover { background:var(--purple-600); color:#fff; border-color:var(--purple-600); transform:translateY(-2px); }
        .mpf-cta-card svg { margin-top:2px; flex-shrink:0; }
        .mpf-cta-t { font-size:14px; font-weight:700; margin-bottom:3px; letter-spacing:-0.005em; }
        .mpf-cta-s { font-size:12px; opacity:.75; line-height:1.4; }
      `}</style>
    </div>
  );
};

// =========================================================
// OPTION G — Split workspace cockpit
// Left: scrollable AI thread (insights + follow-up)
// Right: live cockpit — sticky overview with stat ring,
// type distribution, filterable post feed
// =========================================================
const MyPostsG = () => {
  const w = POSTS_DATA.winner;
  const l = POSTS_DATA.loser;
  const posts = [
    { type: 'video',    title: 'تعرّف على الخدمة من الناس الصح', eng: 23, thumb: 'sky', date: '٢٢ أبريل' },
    { type: 'carousel', title: 'قبل وبعد: مسبح فيلا مسقط',       eng: 18, thumb: 'violet', date: '٢٠ أبريل' },
    { type: 'video',    title: 'نصائح سريعة لصيانة المسبح',       eng: 15, thumb: 'purple', date: '١٨ أبريل' },
    { type: 'image',    title: 'اقتباس عن جودة الخدمة',          eng: 4,  thumb: 'cream', date: '١٥ أبريل' },
    { type: 'image',    title: 'عرض خاص: خصم ٢٠٪',                eng: 3,  thumb: 'peach', date: '١٢ أبريل' },
  ];
  return (
    <div dir="rtl" className="mpg">
      <Sidebar active="posts" />
      <main className="mpg-main">
        <header className="mpg-head">
          <div>
            <h1>منشوراتي</h1>
            <p>تحليل بصيرة · آخر ٣٠ يوم</p>
          </div>
          <div className="mpg-seg">
            <button>٧ أيام</button>
            <button className="is-on">٣٠ يوم</button>
            <button>٩٠ يوم</button>
          </div>
        </header>

        <div className="mpg-grid">
          {/* LEFT — thread */}
          <section className="mpg-thread">
            <div className="mpg-msg">
              <div className="mpg-bubble">
                <div className="mpg-k">الملاحظة الأولى · قوي</div>
                <h3>الفيديو مضاعف أداءك</h3>
                <p>متوسط تفاعل الفيديو <strong className="num">٤.٨٪</strong> — أعلى بـ<strong>٢.٥×</strong> من الصور الثابتة.</p>
                <div className="mpg-evidence">
                  {POSTS_DATA.chart.map(c=>(
                    <div key={c.type} className="mpg-bar">
                      <span>{TYPE_META[c.type].ar}</span>
                      <div className="mpg-bar-t"><div style={{width:`${(c.engagement/5)*100}%`, background:TYPE_META[c.type].color}}/></div>
                      <span className="num">{c.engagement}٪</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mpg-msg">
              <div className="mpg-bubble">
                <div className="mpg-k">المنشور البطل</div>
                <h3>{w.postTopic}</h3>
                <p>{w.body}</p>
                <div className="mpg-stats-row">
                  <span><b className="num">{w.impressions}٪</b> تفاعل</span>
                  <span><b className="num">{w.likes}</b> إعجاب</span>
                  <span><b className="num">{w.reach}</b> وصول</span>
                </div>
                <div className="mpg-actions">
                  <button className="mpg-btn"><Icon path={I.wand} size={12}/> أنشئ مشابهاً</button>
                  <button className="mpg-btn ghost">عرض المنشور</button>
                </div>
              </div>
            </div>

            <div className="mpg-msg">
              <div className="mpg-bubble">
                <div className="mpg-k bad">نقطة ضعف</div>
                <h3>{l.topic}</h3>
                <p>{l.body}</p>
                <div className="mpg-rec">
                  <strong>جرّب:</strong> {l.recommendation}
                </div>
              </div>
            </div>

          </section>

          {/* RIGHT — cockpit */}
          <aside className="mpg-cockpit">
            <section className="mpg-feed">
              <div className="mpg-feed-head">
                <div>
                  <h3>ترتيب المنشورات</h3>
                  <p className="mpg-feed-sub">مرتبة حسب التفاعل · ٣٠ يوم</p>
                </div>
                <div className="mpg-filter">
                  <button className="is-on">الكل</button>
                  <button>فيديو</button>
                  <button>صورة</button>
                </div>
              </div>
              <div className="mpg-feed-list">
                {[...posts].sort((a,b)=>b.eng-a.eng).map((p,i)=>{
                  const maxEng = Math.max(...posts.map(x=>x.eng));
                  const pct = (p.eng/maxEng)*100;
                  const tone = p.eng>=15?'oklch(0.5 0.15 155)':p.eng<8?'oklch(0.6 0.15 30)':'var(--purple-600)';
                  return (
                    <div key={i} className="mpg-feed-row">
                      <div className="mpg-feed-rank num">{['١','٢','٣','٤','٥'][i]}</div>
                      <Thumb variant={p.thumb} h={44}/>
                      <div className="mpg-feed-body">
                        <div className="mpg-feed-meta">
                          <TypeIcon type={p.type} size={10}/>
                          <span>{TYPE_META[p.type].ar}</span>
                          <span className="num">·</span>
                          <span className="num">{p.date}</span>
                        </div>
                        <div className="mpg-feed-t">{p.title}</div>
                        <div className="mpg-feed-bar"><div style={{width:`${pct}%`, background:tone}}/></div>
                      </div>
                      <div className="mpg-feed-e">
                        <span className="num" style={{color:tone}}>{p.eng}٪</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mpg-mix">
              <h3>توزيع المحتوى</h3>
              <p className="mpg-mix-sub">نسبة كل نوع في آخر ٣٠ يوم</p>
              <div className="mpg-mix-bar">
                {[
                  { t: 'video',    pct: 40, label: 'فيديو' },
                  { t: 'image',    pct: 35, label: 'صورة' },
                  { t: 'carousel', pct: 25, label: 'كاروسيل' },
                ].map(r => (
                  <div key={r.t} style={{width:`${r.pct}%`, background:TYPE_META[r.t].color}} title={`${r.label} ${r.pct}٪`}/>
                ))}
              </div>
              <div className="mpg-mix-legend">
                {[
                  { t: 'video',    pct: 40, label: 'فيديو' },
                  { t: 'image',    pct: 35, label: 'صورة' },
                  { t: 'carousel', pct: 25, label: 'كاروسيل' },
                ].map(r => (
                  <div key={r.t} className="mpg-mix-item">
                    <span className="mpg-mix-dot" style={{background:TYPE_META[r.t].color}}/>
                    <span className="mpg-mix-l">{r.label}</span>
                    <span className="num mpg-mix-p">{r.pct}٪</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        {/* Floating Ask Basiret */}
        <MPGAskFab />
      </main>

      <style>{`
        .mpg { display:flex; min-height:100vh; background:var(--canvas); }
        .mpg-main { flex:1; padding:28px 36px 40px; display:flex; flex-direction:column; gap:20px; }

        .mpg-head { display:flex; justify-content:space-between; align-items:flex-end; }
        .mpg-head h1 { font-size:26px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; margin:0 0 3px; }
        .mpg-head p { font-size:12.5px; color:var(--ink-500); margin:0; }
        .mpg-seg { display:flex; background:var(--ink-100); border-radius:10px; padding:3px; }
        .mpg-seg button { padding:7px 14px; font-size:12.5px; border-radius:7px; color:var(--ink-600); font-weight:500; }
        .mpg-seg button.is-on { background:var(--surface); color:var(--ink-900); font-weight:600; box-shadow:var(--shadow-sm); }

        .mpg-grid { display:grid; grid-template-columns:1.55fr 1fr; gap:20px; align-items:flex-start; }

        /* THREAD */
        .mpg-thread { display:flex; flex-direction:column; gap:12px; }
        .mpg-msg { display:flex; gap:12px; align-items:flex-start; }
        .mpg-av { width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg, var(--purple-500), var(--purple-700)); color:#fff; display:grid; place-items:center; font-size:14px; font-weight:700; flex-shrink:0; box-shadow:0 4px 12px -4px rgba(99,65,224,.4); }
        .mpg-bubble { background:var(--surface); border:1px solid var(--line); border-radius:16px; border-top-start-radius:4px; padding:18px 20px; flex:1; }
        .mpg-bubble--plain { background:var(--purple-50); border-color:var(--purple-200); }
        .mpg-bubble--plain p { margin:0; font-size:13.5px; color:var(--purple-900); font-weight:500; }
        .mpg-k { font-size:10.5px; font-weight:700; color:var(--purple-700); letter-spacing:0.04em; margin-bottom:6px; text-transform:uppercase; }
        .mpg-k.bad { color:oklch(0.55 0.15 30); }
        .mpg-bubble h3 { font-size:16px; font-weight:700; color:var(--ink-950); margin:0 0 10px; letter-spacing:-0.01em; line-height:1.3; }
        .mpg-bubble p { font-size:13.5px; color:var(--ink-800); line-height:1.7; margin:0 0 12px; }
        .mpg-bubble strong { color:var(--ink-950); font-weight:700; }

        .mpg-evidence { display:flex; flex-direction:column; gap:6px; padding:12px; background:var(--ink-50); border-radius:10px; }
        .mpg-bar { display:grid; grid-template-columns:60px 1fr 40px; align-items:center; gap:10px; font-size:11.5px; color:var(--ink-700); font-weight:500; }
        .mpg-bar-t { height:7px; background:var(--ink-150); border-radius:99px; overflow:hidden; }
        .mpg-bar-t > div { height:100%; border-radius:99px; }
        .mpg-bar .num { color:var(--ink-900); font-weight:700; text-align:start; }

        .mpg-stats-row { display:flex; gap:14px; padding:10px 12px; background:var(--ink-50); border-radius:10px; margin-bottom:12px; font-size:11.5px; color:var(--ink-600); font-weight:500; flex-wrap:wrap; }
        .mpg-stats-row b { color:var(--ink-950); font-weight:700; font-size:13.5px; margin-inline-end:4px; letter-spacing:-0.005em; }

        .mpg-rec { padding:12px 14px; background:var(--purple-50); border-radius:10px; font-size:13px; line-height:1.6; color:var(--ink-900); }
        .mpg-rec strong { color:var(--purple-800); font-weight:700; }

        .mpg-actions { display:flex; gap:8px; }
        .mpg-btn { padding:8px 14px; background:var(--ink-900); color:#fff; border-radius:8px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:5px; }
        .mpg-btn.ghost { background:transparent; color:var(--ink-700); border:1px solid var(--line-strong); }

        .mpg-bubble { border-top-start-radius:16px; }
        .mpg-reply { display:flex; flex-direction:column; gap:10px; margin-top:4px; }
        .mpg-sugg { display:flex; gap:8px; flex-wrap:wrap; }
        .mpg-sugg button { padding:7px 13px; background:var(--surface); border:1px solid var(--line); border-radius:99px; font-size:11.5px; color:var(--ink-700); font-weight:500; }
        .mpg-sugg button:hover { border-color:var(--purple-300); color:var(--purple-700); }
        .mpg-input { display:flex; gap:8px; background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:4px 4px 4px 12px; }
        .mpg-input input { flex:1; border:none; outline:none; font-family:inherit; font-size:13px; color:var(--ink-900); background:transparent; padding:9px; }
        .mpg-input button { width:34px; height:34px; border-radius:8px; background:var(--purple-600); color:#fff; display:grid; place-items:center; }

        /* COCKPIT */
        .mpg-cockpit { display:flex; flex-direction:column; gap:14px; position:sticky; top:28px; }
        .mpg-over, .mpg-feed, .mpg-mix { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:22px; }
        .mpg-over h3, .mpg-feed h3, .mpg-mix h3 { font-size:14px; font-weight:700; color:var(--ink-950); margin:0 0 16px; letter-spacing:-0.005em; }

        .mpg-mix h3 { margin:0 0 2px; }
        .mpg-mix-sub { font-size:11.5px; color:var(--ink-500); font-weight:500; margin:0 0 16px; }
        .mpg-mix-bar { display:flex; height:10px; border-radius:99px; overflow:hidden; margin-bottom:16px; gap:2px; background:var(--ink-100); }
        .mpg-mix-bar > div { border-radius:3px; }
        .mpg-mix-legend { display:flex; flex-direction:column; gap:10px; }
        .mpg-mix-item { display:grid; grid-template-columns:10px 1fr auto; align-items:center; gap:10px; font-size:12.5px; color:var(--ink-700); font-weight:500; }
        .mpg-mix-dot { width:10px; height:10px; border-radius:50%; }
        .mpg-mix-l { color:var(--ink-900); font-weight:500; }
        .mpg-mix-p { font-weight:700; color:var(--ink-950); letter-spacing:-0.005em; }

        .mpg-ring { position:relative; width:180px; height:180px; margin:0 auto 18px; }
        .mpg-ring-svg { width:100%; height:100%; }
        .mpg-ring-c { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; }
        .mpg-ring-c .num { font-size:30px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; line-height:1; }
        .mpg-ring-c > div:nth-child(2) { font-size:11.5px; color:var(--ink-500); font-weight:500; }

        .mpg-over-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; padding:14px; background:var(--ink-50); border-radius:12px; }
        .mpg-over-stats > div { text-align:center; }
        .mpg-over-stats .num { display:block; font-size:17px; font-weight:700; color:var(--ink-950); letter-spacing:-0.01em; line-height:1.1; }
        .mpg-over-stats em { font-style:normal; font-size:10.5px; color:var(--ink-500); font-weight:500; }

        .mpg-feed-head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; gap:12px; }
        .mpg-feed-head h3 { margin:0 0 2px; }
        .mpg-feed-sub { font-size:11.5px; color:var(--ink-500); font-weight:500; margin:0; }
        .mpg-filter { display:flex; gap:4px; flex-shrink:0; }
        .mpg-filter button { padding:5px 10px; font-size:11px; border-radius:7px; color:var(--ink-600); font-weight:500; }
        .mpg-filter button.is-on { background:var(--purple-100); color:var(--purple-800); font-weight:600; }

        .mpg-feed-list { display:flex; flex-direction:column; gap:2px; }
        .mpg-feed-row { display:grid; grid-template-columns:20px 44px 1fr auto; align-items:center; gap:10px; padding:10px 6px; border-radius:10px; transition:background .15s; }
        .mpg-feed-row + .mpg-feed-row { margin-top:2px; }
        .mpg-feed-row:hover { background:var(--ink-50); }
        .mpg-feed-rank { font-size:12px; font-weight:700; color:var(--ink-400); text-align:center; font-family:var(--mono); }
        .mpg-feed-row > :nth-child(2) { width:44px; height:44px; border-radius:8px; overflow:hidden; }
        .mpg-feed-row > :nth-child(2) > div { width:100%; height:44px !important; }
        .mpg-feed-meta { display:inline-flex; align-items:center; gap:4px; font-size:10.5px; color:var(--ink-500); font-weight:500; margin-bottom:3px; }
        .mpg-feed-t { font-size:12.5px; font-weight:600; color:var(--ink-900); line-height:1.3; margin-bottom:6px; text-wrap:pretty; }
        .mpg-feed-bar { height:4px; background:var(--ink-100); border-radius:99px; overflow:hidden; }
        .mpg-feed-bar > div { height:100%; border-radius:99px; transition:width .5s; }
        .mpg-feed-e { padding-inline-start:6px; }
        .mpg-feed-e .num { font-size:14px; font-weight:700; letter-spacing:-0.01em; }
      `}</style>
    </div>
  );
};

// Floating Ask-Basiret FAB + expandable panel
const MPGAskFab = () => {
  const [open, setOpen] = React.useState(false);
  const [msgs, setMsgs] = React.useState([
    { from: 'ai', text: 'مرحباً! اسألني أي شيء عن منشوراتك.' },
  ]);
  const [val, setVal] = React.useState('');

  const send = (text) => {
    if (!text.trim()) return;
    setMsgs(m => [...m, { from: 'u', text }, { from: 'ai', text: 'أحلل البيانات الآن… سأعود إليك بالنتيجة خلال لحظات.' }]);
    setVal('');
  };

  return (
    <>
      {!open && (
        <button className="mpg-fab" onClick={() => setOpen(true)} aria-label="اسأل بصيرة">
          <span className="mpg-fab-icon">✦</span>
          <span className="mpg-fab-pulse"/>
        </button>
      )}

      {open && (
        <div className="mpg-panel" role="dialog">
          <header className="mpg-panel-head">
            <div className="mpg-panel-hl">
              <span className="mpg-panel-av">✦</span>
              <div>
                <div className="mpg-panel-t">اسأل بصيرة</div>
                <div className="mpg-panel-s">مساعدك لتحليل المحتوى</div>
              </div>
            </div>
            <button className="mpg-panel-x" onClick={() => setOpen(false)} aria-label="إغلاق">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </header>

          <div className="mpg-panel-body">
            {msgs.map((m,i) => (
              <div key={i} className={`mpg-pm mpg-pm--${m.from}`}>
                {m.from === 'ai' && <span className="mpg-pm-av">✦</span>}
                <div className="mpg-pm-b">{m.text}</div>
              </div>
            ))}
          </div>

          <div className="mpg-panel-sugg">
            {['أفضل وقت نشر؟', '٣ أفكار محتوى', 'لماذا انخفض الوصول؟'].map(s => (
              <button key={s} onClick={() => send(s)}>{s}</button>
            ))}
          </div>

          <form className="mpg-panel-input" onSubmit={(e) => { e.preventDefault(); send(val); }}>
            <input value={val} onChange={e=>setVal(e.target.value)} placeholder="اسأل بصيرة…"/>
            <button type="submit"><Icon path={I.spark} size={14}/></button>
          </form>
        </div>
      )}

      <style>{`
        .mpg-fab { position:fixed; inset-inline-end:28px; bottom:28px; z-index:50; width:58px; height:58px; border-radius:50%; background:linear-gradient(135deg, var(--purple-500), var(--purple-700)); color:#fff; display:grid; place-items:center; font-size:22px; font-weight:700; box-shadow:0 12px 32px -8px rgba(99,65,224,.55), 0 4px 12px -2px rgba(0,0,0,.1); transition:transform .18s cubic-bezier(.2,.8,.2,1); cursor:pointer; }
        .mpg-fab:hover { transform:scale(1.06); }
        .mpg-fab-icon { position:relative; z-index:1; }
        .mpg-fab-pulse { position:absolute; inset:-6px; border-radius:50%; background:var(--purple-500); opacity:.25; animation:mpg-pulse 2.4s ease-out infinite; }
        @keyframes mpg-pulse { 0% { transform:scale(.9); opacity:.35; } 100% { transform:scale(1.6); opacity:0; } }

        .mpg-panel { position:fixed; inset-inline-end:28px; bottom:28px; z-index:50; width:380px; max-height:560px; background:var(--surface); border:1px solid var(--line); border-radius:20px; box-shadow:0 24px 60px -12px rgba(0,0,0,.2), 0 6px 20px -6px rgba(0,0,0,.08); display:flex; flex-direction:column; overflow:hidden; animation:mpg-slide .24s cubic-bezier(.2,.8,.2,1); }
        @keyframes mpg-slide { from { opacity:0; transform:translateY(16px) scale(.97); } to { opacity:1; transform:none; } }
        .mpg-panel-head { display:flex; justify-content:space-between; align-items:center; padding:16px 18px; border-bottom:1px solid var(--line); background:linear-gradient(135deg, var(--purple-50), oklch(0.97 0.03 280)); }
        .mpg-panel-hl { display:flex; gap:12px; align-items:center; }
        .mpg-panel-av { width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg, var(--purple-500), var(--purple-700)); color:#fff; display:grid; place-items:center; font-size:15px; font-weight:700; box-shadow:0 4px 12px -4px rgba(99,65,224,.4); }
        .mpg-panel-t { font-size:14px; font-weight:700; color:var(--ink-950); }
        .mpg-panel-s { font-size:11.5px; color:var(--ink-500); margin-top:2px; }
        .mpg-panel-x { width:28px; height:28px; border-radius:8px; background:var(--surface); color:var(--ink-600); display:grid; place-items:center; border:1px solid var(--line); }
        .mpg-panel-x:hover { color:var(--ink-900); }

        .mpg-panel-body { flex:1; overflow:auto; padding:16px; display:flex; flex-direction:column; gap:10px; }
        .mpg-pm { display:flex; gap:8px; align-items:flex-start; }
        .mpg-pm--u { justify-content:flex-end; }
        .mpg-pm-av { width:26px; height:26px; border-radius:50%; background:linear-gradient(135deg, var(--purple-500), var(--purple-700)); color:#fff; display:grid; place-items:center; font-size:11px; font-weight:700; flex-shrink:0; }
        .mpg-pm-b { max-width:80%; padding:10px 14px; border-radius:14px; font-size:13px; line-height:1.55; color:var(--ink-900); }
        .mpg-pm--ai .mpg-pm-b { background:var(--ink-50); border-top-start-radius:4px; }
        .mpg-pm--u .mpg-pm-b { background:var(--purple-600); color:#fff; border-top-end-radius:4px; }

        .mpg-panel-sugg { display:flex; gap:6px; padding:10px 14px; border-top:1px solid var(--line); flex-wrap:wrap; }
        .mpg-panel-sugg button { padding:6px 11px; background:var(--surface); border:1px solid var(--line); border-radius:99px; font-size:11.5px; color:var(--ink-700); font-weight:500; }
        .mpg-panel-sugg button:hover { border-color:var(--purple-300); color:var(--purple-700); }

        .mpg-panel-input { display:flex; gap:6px; padding:10px 12px 12px; border-top:1px solid var(--line); }
        .mpg-panel-input input { flex:1; background:var(--ink-50); border:1px solid var(--line); border-radius:10px; font-family:inherit; font-size:13px; color:var(--ink-900); padding:9px 12px; outline:none; }
        .mpg-panel-input input:focus { border-color:var(--purple-400); background:var(--surface); }
        .mpg-panel-input button { width:36px; height:36px; border-radius:10px; background:var(--purple-600); color:#fff; display:grid; place-items:center; flex-shrink:0; }
      `}</style>
    </>
  );
};

window.MyPostsE = MyPostsE;
window.MyPostsF = MyPostsF;
window.MyPostsG = MyPostsG;
window.MPGAskFab = MPGAskFab;
