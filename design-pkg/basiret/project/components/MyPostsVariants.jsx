// My Posts — alternate direction explorations (B, C, D)
// Uses same data as MyPostsApp

// =========================================================
// OPTION B — Spotlight + leaderboard
// Big hero post at the top, ranked list of recent posts below,
// chart integrated as a sparkline row, insights as small chips
// =========================================================
const MyPostsB = () => {
  const w = POSTS_DATA.winner;
  const recent = [
    { rank: 1, type: 'video',    title: 'تعرّف على الخدمة من الناس الصح', eng: 23, likes: 187, date: '٢٢ أبريل' },
    { rank: 2, type: 'carousel', title: 'قبل وبعد: مسبح فيلا مسقط',       eng: 18, likes: 142, date: '٢٠ أبريل' },
    { rank: 3, type: 'video',    title: 'نصائح سريعة لصيانة المسبح',       eng: 15, likes: 98,  date: '١٨ أبريل' },
    { rank: 4, type: 'image',    title: 'اقتباس عن جودة الخدمة',          eng: 4,  likes: 22,  date: '١٥ أبريل' },
    { rank: 5, type: 'image',    title: 'عرض خاص: خصم ٢٠٪',                eng: 3,  likes: 18,  date: '١٢ أبريل' },
  ];

  return (
    <div dir="rtl" className="mpb">
      <Sidebar active="posts" />
      <main className="mpb-main">
        <header className="mpb-head">
          <div>
            <div className="mpb-crumb">منشوراتي · آخر ٣٠ يوم</div>
            <h1 className="mpb-title">٣٥ منشور · تفاعل متوسط <span className="num" style={{color:'var(--purple-700)'}}>٩.٦٪</span></h1>
          </div>
          <button className="mpb-export">تصدير التقرير</button>
        </header>

        {/* Hero winner */}
        <section className="mpb-hero">
          <div className="mpb-hero-l">
            <div className="mpb-hero-rank">
              <span className="num">#1</span>
              <span>أفضل منشور الشهر</span>
            </div>
            <h2 className="mpb-hero-title">{w.postTopic}</h2>
            <div className="mpb-hero-stats">
              <div><div className="num">{w.impressions}٪</div><span>تفاعل</span></div>
              <div><div className="num">{w.likes}</div><span>إعجاب</span></div>
              <div><div className="num">{w.reach}</div><span>وصول</span></div>
              <div><div className="num">{w.comments}</div><span>تعليق</span></div>
            </div>
            <div className="mpb-why">
              <span className="mpb-why-k">لماذا نجح</span>
              <p>{w.body}</p>
            </div>
            <div className="mpb-hero-actions">
              <button className="mpb-cta-p"><Icon path={I.wand} size={14}/> أنشئ مشابهاً</button>
              <button className="mpb-cta-g">عرض المنشور</button>
            </div>
          </div>
          <div className="mpb-hero-r">
            <Thumb variant="sky" h={300}>
              <div style={{position:'absolute', bottom:14, insetInlineEnd:14}}>
                <TypePill type={w.type}/>
              </div>
            </Thumb>
          </div>
        </section>

        {/* Two-col: leaderboard + insights */}
        <div className="mpb-2col">
          <section className="mpb-board">
            <div className="mpb-board-head">
              <h3>ترتيب منشورات الشهر</h3>
              <div className="mpb-sort">
                <button className="is-on">الأعلى تفاعلاً</button>
                <button>الأحدث</button>
              </div>
            </div>
            <div className="mpb-rows">
              {recent.map(p => {
                const m = TYPE_META[p.type];
                return (
                  <div key={p.rank} className={`mpb-row ${p.rank===1?'is-top':''}`}>
                    <div className={`mpb-rank num ${p.rank<=3?'is-hot':''}`}>#{p.rank}</div>
                    <div className="mpb-row-bar" style={{background:m.color, opacity:.2+(p.eng/25)*0.8}}/>
                    <div>
                      <div className="mpb-row-meta">
                        <TypeIcon type={p.type} size={11}/>
                        <span>{m.ar}</span>
                        <span className="num">·</span>
                        <span className="num">{p.date}</span>
                      </div>
                      <div className="mpb-row-title">{p.title}</div>
                    </div>
                    <div className="mpb-row-eng num" style={{color: p.eng >= 15 ? 'oklch(0.5 0.15 155)' : p.eng < 8 ? 'oklch(0.6 0.15 30)' : 'var(--ink-700)'}}>{p.eng}٪</div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="mpb-insights">
            <h3>رؤى سريعة</h3>
            <div className="mpb-chip mpb-chip--good">
              <div className="mpb-chip-k">✓ يعمل جيداً</div>
              <p>الفيديوهات تحت ٣٠ ثانية بدعوة عمل واضحة</p>
            </div>
            <div className="mpb-chip mpb-chip--bad">
              <div className="mpb-chip-k">✗ أقل أداءً</div>
              <p>الصور الثابتة بتسميات طويلة بدون CTA</p>
            </div>
            <div className="mpb-chip mpb-chip--tip">
              <div className="mpb-chip-k">💡 جرّب</div>
              <p>نشر فيديو كل يوم ثلاثاء ٤م — أعلى وصول تاريخياً</p>
            </div>

            <div className="mpb-mini-chart">
              <div className="mpb-mini-head">التفاعل حسب النوع</div>
              {POSTS_DATA.chart.map(c => (
                <div key={c.type} className="mpb-mini-row">
                  <span>{TYPE_META[c.type].ar}</span>
                  <div className="mpb-mini-track">
                    <div style={{width:`${(c.engagement/5)*100}%`, background:TYPE_META[c.type].color}}/>
                  </div>
                  <span className="num">{c.engagement}٪</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>

      <style>{`
        .mpb { display: flex; min-height: 100vh; background: var(--canvas); }
        .mpb-main { flex: 1; padding: 32px 40px; display: flex; flex-direction: column; gap: 22px; }
        .mpb-head { display: flex; justify-content: space-between; align-items: flex-end; }
        .mpb-crumb { font-size: 12px; color: var(--ink-500); margin-bottom: 8px; font-weight: 500; }
        .mpb-title { font-size: 28px; font-weight: 700; color: var(--ink-950); letter-spacing: -0.02em; margin: 0; }
        .mpb-export { padding: 10px 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; font-size: 13px; font-weight: 500; color: var(--ink-800); }

        .mpb-hero { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 28px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 28px; position: relative; overflow: hidden; }
        .mpb-hero::before { content:''; position:absolute; top:0; inset-inline:0; height:4px; background: linear-gradient(90deg, var(--purple-400), var(--purple-600), var(--purple-400)); }
        .mpb-hero-rank { display: inline-flex; align-items: center; gap: 8px; background: var(--purple-50); color: var(--purple-800); padding: 6px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; margin-bottom: 14px; }
        .mpb-hero-rank .num { font-size: 13px; }
        .mpb-hero-title { font-size: 22px; font-weight: 700; line-height: 1.4; color: var(--ink-950); margin: 0 0 20px; text-wrap: pretty; letter-spacing: -0.01em; }
        .mpb-hero-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; padding: 16px; background: var(--ink-50); border-radius: 14px; margin-bottom: 18px; }
        .mpb-hero-stats > div { text-align: start; }
        .mpb-hero-stats .num { font-size: 22px; font-weight: 700; color: var(--ink-950); letter-spacing: -0.01em; }
        .mpb-hero-stats span { font-size: 11px; color: var(--ink-500); font-weight: 500; display: block; margin-top: 2px; }
        .mpb-why { padding: 14px 16px; background: oklch(0.97 0.025 155); border-radius: 12px; margin-bottom: 18px; }
        .mpb-why-k { font-size: 11px; font-weight: 700; color: oklch(0.45 0.15 155); display: block; margin-bottom: 6px; }
        .mpb-why p { margin: 0; font-size: 13px; line-height: 1.7; color: var(--ink-800); }
        .mpb-hero-actions { display: flex; gap: 10px; }
        .mpb-cta-p { flex:1; padding: 12px; background: var(--purple-600); color: #fff; border-radius: 10px; font-size: 13.5px; font-weight: 600; display:flex; align-items:center; justify-content:center; gap:7px; box-shadow: 0 6px 16px -6px rgba(99,65,224,.55); }
        .mpb-cta-g { flex:1; padding: 12px; background: var(--ink-100); color: var(--ink-800); border-radius: 10px; font-size: 13.5px; font-weight: 600; }

        .mpb-2col { display: grid; grid-template-columns: 1.5fr 1fr; gap: 18px; }
        .mpb-board, .mpb-insights { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 22px; }
        .mpb-board-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .mpb-board-head h3, .mpb-insights h3 { font-size: 15px; font-weight: 700; color: var(--ink-950); margin: 0; letter-spacing: -0.01em; }
        .mpb-insights h3 { margin-bottom: 14px; }
        .mpb-sort { display: flex; background: var(--ink-100); border-radius: 8px; padding: 3px; }
        .mpb-sort button { padding: 5px 12px; font-size: 11.5px; font-weight: 500; border-radius: 6px; color: var(--ink-600); }
        .mpb-sort button.is-on { background: var(--surface); color: var(--ink-900); box-shadow: var(--shadow-sm); font-weight: 600; }

        .mpb-rows { display: flex; flex-direction: column; }
        .mpb-row { display: grid; grid-template-columns: 36px 3px 1fr auto; align-items: center; gap: 14px; padding: 12px 6px; border-radius: 10px; }
        .mpb-row + .mpb-row { border-top: 1px solid var(--line); }
        .mpb-row:hover { background: var(--ink-50); }
        .mpb-row.is-top { background: var(--purple-50); }
        .mpb-rank { font-size: 13px; font-weight: 700; color: var(--ink-400); }
        .mpb-rank.is-hot { color: var(--purple-700); }
        .mpb-row-bar { height: 30px; border-radius: 3px; }
        .mpb-row-meta { display: flex; align-items: center; gap: 5px; font-size: 10.5px; color: var(--ink-500); font-weight: 500; margin-bottom: 2px; }
        .mpb-row-title { font-size: 13px; font-weight: 600; color: var(--ink-900); line-height: 1.4; }
        .mpb-row-eng { font-size: 14px; font-weight: 700; }

        .mpb-chip { padding: 12px 14px; border-radius: 12px; margin-bottom: 8px; }
        .mpb-chip-k { font-size: 11px; font-weight: 700; margin-bottom: 4px; }
        .mpb-chip p { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--ink-800); }
        .mpb-chip--good { background: oklch(0.97 0.025 155); } .mpb-chip--good .mpb-chip-k { color: oklch(0.45 0.15 155); }
        .mpb-chip--bad { background: oklch(0.97 0.025 30); } .mpb-chip--bad .mpb-chip-k { color: oklch(0.5 0.15 30); }
        .mpb-chip--tip { background: var(--purple-50); } .mpb-chip--tip .mpb-chip-k { color: var(--purple-700); }

        .mpb-mini-chart { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line); }
        .mpb-mini-head { font-size: 11px; font-weight: 600; color: var(--ink-600); margin-bottom: 10px; }
        .mpb-mini-row { display: grid; grid-template-columns: 60px 1fr 40px; align-items: center; gap: 10px; font-size: 11.5px; color: var(--ink-700); padding: 5px 0; }
        .mpb-mini-track { height: 6px; background: var(--ink-100); border-radius: 99px; overflow: hidden; }
        .mpb-mini-track > div { height: 100%; border-radius: 99px; }
        .mpb-mini-row .num { text-align: start; font-weight: 600; color: var(--ink-900); }
      `}</style>
    </div>
  );
};

// =========================================================
// OPTION C — Conversational AI advisor
// Feels like a chat with Basiret: AI narrates what it sees,
// shows evidence inline (post preview, mini chart), you reply
// =========================================================
const MyPostsC = () => {
  const w = POSTS_DATA.winner;
  const l = POSTS_DATA.loser;
  return (
    <div dir="rtl" className="mpc">
      <Sidebar active="posts" />
      <main className="mpc-main">
        <header className="mpc-head">
          <div>
            <div className="mpc-crumb">منشوراتي</div>
            <h1>تحليل أسبوعك من بصيرة</h1>
            <p>آخر ٣٠ يوم · ٣٥ منشور · محدّث منذ دقيقتين</p>
          </div>
          <div className="mpc-summary">
            <div><span className="num">+١٢٪</span><em>تفاعل</em></div>
            <div><span className="num">+٨٪</span><em>وصول</em></div>
            <div><span className="num">٣</span><em>أنماط</em></div>
          </div>
        </header>

        <div className="mpc-thread">
          <div className="mpc-msg">
            <div className="mpc-av">✦</div>
            <div className="mpc-bubble">
              <div className="mpc-intro">لاحظت ثلاثة أنماط في منشوراتك هذا الشهر. إليك الأهم:</div>
            </div>
          </div>

          <div className="mpc-msg">
            <div className="mpc-av">✦</div>
            <div className="mpc-bubble">
              <div className="mpc-k good">١. الفيديو يتفوّق بفارق كبير</div>
              <p>متوسط تفاعل الفيديو <strong className="num">٤.٨٪</strong> مقابل <strong className="num">١.٩٪</strong> للصور. هذا أعلى بـ<strong>٢.٥ ضعفاً</strong>.</p>
              <div className="mpc-evidence">
                {POSTS_DATA.chart.map(c => (
                  <div key={c.type} className="mpc-bar">
                    <span>{TYPE_META[c.type].ar}</span>
                    <div className="mpc-bar-t"><div style={{width:`${(c.engagement/5)*100}%`, background: TYPE_META[c.type].color}}/></div>
                    <span className="num">{c.engagement}٪</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mpc-msg">
            <div className="mpc-av">✦</div>
            <div className="mpc-bubble">
              <div className="mpc-k good">٢. المنشور الأكثر نجاحاً</div>
              <p>{w.body}</p>
              <div className="mpc-post">
                <div className="mpc-post-meta">
                  <TypePill type="video" size="sm"/>
                  <span className="num">{w.impressions}٪ تفاعل</span>
                  <span className="num">{w.likes} إعجاب</span>
                </div>
                <div className="mpc-post-body">{w.postTopic}</div>
              </div>
              <div className="mpc-actions">
                <button className="mpc-btn"><Icon path={I.wand} size={12}/> أنشئ مشابهاً</button>
                <button className="mpc-btn ghost">عرض المنشور</button>
              </div>
            </div>
          </div>

          <div className="mpc-msg">
            <div className="mpc-av">✦</div>
            <div className="mpc-bubble">
              <div className="mpc-k bad">٣. ما يستنزف أداءك</div>
              <p>{l.body}</p>
              <div className="mpc-rec">
                <strong>توصيتي:</strong> {l.recommendation}
              </div>
            </div>
          </div>

          {/* Reply */}
          <div className="mpc-reply">
            <div className="mpc-suggest">
              <button>ما أفضل وقت للنشر؟</button>
              <button>اقترح ٣ أفكار محتوى</button>
              <button>لماذا انخفض وصولي؟</button>
            </div>
            <div className="mpc-input">
              <input placeholder="اسأل بصيرة عن منشوراتك…" />
              <button><Icon path={I.spark} size={14}/></button>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .mpc { display: flex; min-height: 100vh; background: var(--canvas); }
        .mpc-main { flex: 1; padding: 32px 40px; display: flex; flex-direction: column; gap: 22px; max-width: 1100px; margin: 0 auto; width: 100%; }
        .mpc-head { display: flex; justify-content: space-between; align-items: flex-end; }
        .mpc-crumb { font-size: 12px; color: var(--ink-500); margin-bottom: 6px; font-weight: 500; }
        .mpc-head h1 { font-size: 28px; font-weight: 700; color: var(--ink-950); letter-spacing: -0.02em; margin: 0 0 4px; }
        .mpc-head p { margin: 0; font-size: 12.5px; color: var(--ink-500); }
        .mpc-summary { display: flex; gap: 20px; }
        .mpc-summary > div { text-align: center; }
        .mpc-summary .num { font-size: 20px; font-weight: 700; color: var(--purple-700); display: block; }
        .mpc-summary em { font-size: 10.5px; font-style: normal; color: var(--ink-500); font-weight: 500; }

        .mpc-thread { display: flex; flex-direction: column; gap: 18px; }
        .mpc-msg { display: flex; gap: 14px; align-items: flex-start; }
        .mpc-av { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--purple-500), var(--purple-700)); color: #fff; display: grid; place-items: center; font-size: 15px; font-weight: 700; flex-shrink: 0; box-shadow: 0 4px 14px -4px rgba(99,65,224,.4); }
        .mpc-bubble { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; border-top-start-radius: 4px; padding: 18px 22px; flex: 1; max-width: 680px; }
        .mpc-intro { font-size: 15px; color: var(--ink-900); font-weight: 500; line-height: 1.6; }
        .mpc-k { font-size: 11px; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.02em; }
        .mpc-k.good { color: oklch(0.45 0.15 155); }
        .mpc-k.bad { color: oklch(0.55 0.15 30); }
        .mpc-bubble p { margin: 0 0 14px; font-size: 14px; line-height: 1.7; color: var(--ink-800); text-wrap: pretty; }
        .mpc-bubble strong { color: var(--ink-950); font-weight: 700; }

        .mpc-evidence { display: flex; flex-direction: column; gap: 8px; padding: 14px; background: var(--ink-50); border-radius: 12px; }
        .mpc-bar { display: grid; grid-template-columns: 60px 1fr 40px; align-items: center; gap: 10px; font-size: 12px; color: var(--ink-700); font-weight: 500; }
        .mpc-bar-t { height: 8px; background: var(--ink-150); border-radius: 99px; overflow: hidden; }
        .mpc-bar-t > div { height: 100%; border-radius: 99px; }
        .mpc-bar .num { color: var(--ink-900); font-weight: 700; text-align: start; }

        .mpc-post { padding: 14px; background: var(--ink-50); border-radius: 12px; margin-bottom: 12px; }
        .mpc-post-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; font-size: 11px; color: var(--ink-600); font-weight: 500; }
        .mpc-post-body { font-size: 13px; color: var(--ink-900); line-height: 1.6; font-weight: 500; }

        .mpc-rec { padding: 12px 14px; background: var(--purple-50); border-radius: 10px; font-size: 13px; line-height: 1.6; color: var(--ink-900); }
        .mpc-rec strong { color: var(--purple-800); font-weight: 700; }

        .mpc-actions { display: flex; gap: 8px; }
        .mpc-btn { padding: 8px 14px; background: var(--ink-900); color: #fff; border-radius: 8px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; }
        .mpc-btn.ghost { background: transparent; color: var(--ink-700); border: 1px solid var(--line); }

        .mpc-reply { margin-inline-start: 50px; display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
        .mpc-suggest { display: flex; gap: 8px; flex-wrap: wrap; }
        .mpc-suggest button { padding: 7px 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 99px; font-size: 12px; color: var(--ink-700); font-weight: 500; }
        .mpc-suggest button:hover { border-color: var(--purple-300); color: var(--purple-700); }
        .mpc-input { display: flex; gap: 8px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 6px 6px 6px 14px; }
        .mpc-input input { flex: 1; border: none; outline: none; font-family: inherit; font-size: 14px; color: var(--ink-900); background: transparent; padding: 10px; }
        .mpc-input button { width: 40px; height: 40px; border-radius: 10px; background: var(--purple-600); color: #fff; display: grid; place-items: center; }
      `}</style>
    </div>
  );
};

// =========================================================
// OPTION D — Dense analytics dashboard
// Tiles, stats, grid of posts — for power users
// =========================================================
const MyPostsD = () => {
  const stats = [
    { k: 'منشور', v: '٣٥', d: '+٥', up: true },
    { k: 'متوسط تفاعل', v: '٩.٦٪', d: '+١.٢٪', up: true },
    { k: 'وصول كلي', v: '٤٨.٢K', d: '+٨٪', up: true },
    { k: 'تعليقات', v: '٣٤٢', d: '-١٢', up: false },
  ];
  const posts = [
    { type: 'video', title: 'تعرّف على الخدمة', eng: 23, thumb: 'sky' },
    { type: 'carousel', title: 'قبل وبعد', eng: 18, thumb: 'violet' },
    { type: 'video', title: 'نصائح سريعة', eng: 15, thumb: 'purple' },
    { type: 'image', title: 'اقتباس الأسبوع', eng: 4, thumb: 'cream' },
    { type: 'image', title: 'عرض خاص', eng: 3, thumb: 'peach' },
    { type: 'carousel', title: 'مسقط الصيف', eng: 12, thumb: 'mint' },
  ];
  return (
    <div dir="rtl" className="mpd">
      <Sidebar active="posts"/>
      <main className="mpd-main">
        <header className="mpd-head">
          <div>
            <h1>منشوراتي</h1>
            <p>آخر ٣٠ يوم · محدّث منذ دقيقتين</p>
          </div>
          <div className="mpd-controls">
            <div className="mpd-seg"><button className="is-on">٣٠ يوم</button><button>٧ أيام</button><button>٩٠ يوم</button></div>
            <button className="mpd-p">+ منشور جديد</button>
          </div>
        </header>

        {/* Stat tiles */}
        <div className="mpd-stats">
          {stats.map((s,i) => (
            <div key={i} className="mpd-stat">
              <div className="mpd-stat-k">{s.k}</div>
              <div className="mpd-stat-v num">{s.v}</div>
              <div className={`mpd-stat-d ${s.up?'up':'down'}`}>
                {s.up?'↑':'↓'} <span className="num">{s.d}</span>
              </div>
            </div>
          ))}
        </div>

        {/* AI takeaway strip */}
        <div className="mpd-ai">
          <div className="mpd-ai-l">
            <span className="mpd-ai-spark">✦</span>
            <div>
              <div className="mpd-ai-k">خلاصة بصيرة</div>
              <div className="mpd-ai-t">
                الفيديو ضاعف أداءك هذا الشهر. جرّب نشر فيديو كل <strong>ثلاثاء ٤م</strong> لتعظيم الوصول.
              </div>
            </div>
          </div>
          <div className="mpd-ai-r">
            <button className="mpd-ai-btn">تفاصيل التحليل</button>
          </div>
        </div>

        {/* Two col */}
        <div className="mpd-2col">
          <section className="mpd-chart-card">
            <div className="mpd-card-head">
              <h3>التفاعل حسب النوع</h3>
              <button className="mpd-link">عرض الكل ↩</button>
            </div>
            <div className="mpd-chart">
              {POSTS_DATA.chart.map(c => {
                const max = 5;
                const pct = (c.engagement/max)*100;
                return (
                  <div key={c.type} className="mpd-barc">
                    <div className="mpd-barc-track">
                      <div className="mpd-barc-fill" style={{height:`${pct}%`, background: TYPE_META[c.type].color}}>
                        <span className="num">{c.engagement}٪</span>
                      </div>
                    </div>
                    <div className="mpd-barc-lbl">
                      <div>{TYPE_META[c.type].ar}</div>
                      <div className="num">{c.posts} منشور</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mpd-posts">
            <div className="mpd-card-head">
              <h3>الأحدث</h3>
              <button className="mpd-link">عرض الكل ↩</button>
            </div>
            <div className="mpd-grid">
              {posts.map((p,i) => (
                <div key={i} className="mpd-post">
                  <Thumb variant={p.thumb} h={90}>
                    <div style={{position:'absolute', top:8, insetInlineEnd:8}}><TypePill type={p.type} size="sm"/></div>
                  </Thumb>
                  <div className="mpd-post-t">{p.title}</div>
                  <div className="mpd-post-e"><span className="num">{p.eng}٪</span> تفاعل</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <style>{`
        .mpd { display: flex; min-height: 100vh; background: var(--canvas); }
        .mpd-main { flex: 1; padding: 28px 36px; display: flex; flex-direction: column; gap: 18px; }
        .mpd-head { display: flex; justify-content: space-between; align-items: flex-end; }
        .mpd-head h1 { font-size: 24px; font-weight: 700; color: var(--ink-950); letter-spacing: -0.01em; margin: 0 0 4px; }
        .mpd-head p { font-size: 12px; color: var(--ink-500); margin: 0; }
        .mpd-controls { display: flex; gap: 10px; align-items: center; }
        .mpd-seg { display: flex; background: var(--ink-100); border-radius: 9px; padding: 3px; }
        .mpd-seg button { padding: 6px 12px; font-size: 12px; border-radius: 6px; color: var(--ink-600); font-weight: 500; }
        .mpd-seg button.is-on { background: var(--surface); color: var(--ink-900); font-weight: 600; box-shadow: var(--shadow-sm); }
        .mpd-p { padding: 9px 14px; background: var(--purple-600); color: #fff; border-radius: 9px; font-size: 12.5px; font-weight: 600; }

        .mpd-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
        .mpd-stat { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; }
        .mpd-stat-k { font-size: 11px; color: var(--ink-500); font-weight: 500; margin-bottom: 8px; }
        .mpd-stat-v { font-size: 26px; font-weight: 700; color: var(--ink-950); letter-spacing: -0.02em; line-height: 1; margin-bottom: 6px; }
        .mpd-stat-d { font-size: 11.5px; font-weight: 600; }
        .mpd-stat-d.up { color: oklch(0.5 0.15 155); }
        .mpd-stat-d.down { color: oklch(0.55 0.15 30); }

        .mpd-ai { background: linear-gradient(135deg, var(--purple-50), oklch(0.97 0.03 280)); border: 1px solid var(--purple-200); border-radius: 16px; padding: 18px 22px; display: flex; justify-content: space-between; align-items: center; gap: 14px; }
        .mpd-ai-l { display: flex; gap: 14px; align-items: center; }
        .mpd-ai-spark { width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, var(--purple-500), var(--purple-700)); color: #fff; display: grid; place-items: center; font-size: 16px; font-weight: 700; box-shadow: 0 4px 14px -4px rgba(99,65,224,.4); }
        .mpd-ai-k { font-size: 11px; font-weight: 700; color: var(--purple-700); margin-bottom: 3px; }
        .mpd-ai-t { font-size: 13.5px; color: var(--ink-900); font-weight: 500; }
        .mpd-ai-t strong { color: var(--purple-800); font-weight: 700; }
        .mpd-ai-btn { padding: 9px 14px; background: var(--surface); border-radius: 9px; font-size: 12px; font-weight: 600; color: var(--ink-800); border: 1px solid var(--line); }

        .mpd-2col { display: grid; grid-template-columns: 1fr 1.1fr; gap: 14px; }
        .mpd-chart-card, .mpd-posts { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 20px; }
        .mpd-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .mpd-card-head h3 { font-size: 14px; font-weight: 700; color: var(--ink-950); margin: 0; }
        .mpd-link { font-size: 12px; color: var(--purple-700); font-weight: 500; }

        .mpd-chart { display: flex; gap: 14px; align-items: flex-end; height: 220px; }
        .mpd-barc { flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .mpd-barc-track { flex: 1; background: var(--ink-50); border-radius: 10px; position: relative; overflow: hidden; min-height: 180px; }
        .mpd-barc-fill { position: absolute; inset: auto 0 0 0; border-radius: 10px; display: flex; align-items: flex-start; justify-content: center; padding-top: 10px; transition: height 0.5s cubic-bezier(.2,.8,.2,1); }
        .mpd-barc-fill .num { color: #fff; font-size: 13px; font-weight: 700; text-shadow: 0 1px 2px rgba(0,0,0,.15); }
        .mpd-barc-lbl { text-align: center; font-size: 12px; color: var(--ink-800); font-weight: 600; }
        .mpd-barc-lbl .num { font-size: 10.5px; color: var(--ink-500); font-weight: 500; margin-top: 2px; }

        .mpd-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
        .mpd-post { display: flex; flex-direction: column; gap: 8px; }
        .mpd-post-t { font-size: 12.5px; font-weight: 600; color: var(--ink-900); line-height: 1.4; }
        .mpd-post-e { font-size: 11px; color: var(--ink-500); }
        .mpd-post-e .num { color: var(--purple-700); font-weight: 700; }
      `}</style>
    </div>
  );
};

window.MyPostsB = MyPostsB;
window.MyPostsC = MyPostsC;
window.MyPostsD = MyPostsD;
