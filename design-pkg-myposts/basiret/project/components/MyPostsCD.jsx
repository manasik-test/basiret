// My Posts CD — merged Conversational advisor + Dense analytics
// Top: stat tiles + AI takeaway strip (from D)
// Middle: conversational thread with inline evidence (from C)
// Right column: compact analytics side panel (chart + recent posts from D)

const MyPostsCD = () => {
  const w = POSTS_DATA.winner;
  const l = POSTS_DATA.loser;

  const posts = [
    { type: 'video',    title: 'تعرّف على الخدمة',    eng: 23, thumb: 'sky' },
    { type: 'carousel', title: 'قبل وبعد',           eng: 18, thumb: 'violet' },
    { type: 'video',    title: 'نصائح سريعة',         eng: 15, thumb: 'purple' },
    { type: 'image',    title: 'اقتباس الأسبوع',      eng: 4,  thumb: 'cream' },
  ];

  return (
    <div dir="rtl" className="mcd">
      <Sidebar active="posts" />

      <main className="mcd-main">
        <header className="mcd-head">
          <div>
            <div className="mcd-crumb">
              <span>لوحة التحكم</span>
              <Icon path={I.chevL} size={10}/>
              <span>منشوراتي</span>
            </div>
            <div className="mcd-titlerow">
              <h1>منشوراتي</h1>
              <span className="mcd-badge">
                <span className="mcd-dot"/>
                محدّث منذ دقيقتين
              </span>
            </div>
            <p>تحليل بصيرة لآخر ٣٠ يوم — ما نجح، وما ينبغي تغييره، ولماذا</p>
          </div>

          <div className="mcd-ctrls">
            <div className="mcd-seg">
              <button>٧ أيام</button>
              <button className="is-on">٣٠ يوم</button>
              <button>٩٠ يوم</button>
            </div>
            <button className="mcd-export">
              <Icon path={I.pencil} size={13}/>
              تصدير
            </button>
          </div>
        </header>

        {/* AI takeaway */}
        <div className="mcd-ai">
          <div className="mcd-ai-l">
            <span className="mcd-ai-spark">✦</span>
            <div>
              <div className="mcd-ai-k">خلاصة بصيرة</div>
              <div className="mcd-ai-t">
                الفيديو ضاعف أداءك هذا الشهر. جرّب نشر فيديو كل <strong>ثلاثاء ٤م</strong> لتعظيم الوصول.
              </div>
            </div>
          </div>
          <button className="mcd-ai-btn">عرض التحليل الكامل</button>
        </div>

        {/* Two col: thread + side panel */}
        <div className="mcd-2col">
          {/* THREAD */}
          <section className="mcd-thread">
            <div className="mcd-msg">
              <div className="mcd-av">✦</div>
              <div className="mcd-bubble">
                <div className="mcd-intro">لاحظت ثلاثة أنماط في منشوراتك هذا الشهر. إليك الأهم:</div>
              </div>
            </div>

            <div className="mcd-msg">
              <div className="mcd-av">✦</div>
              <div className="mcd-bubble">
                <div className="mcd-k good">١ · الفيديو يتفوّق بفارق كبير</div>
                <p>متوسط تفاعل الفيديو <strong className="num">٤.٨٪</strong> مقابل <strong className="num">١.٩٪</strong> للصور. هذا أعلى بـ<strong>٢.٥ ضعفاً</strong>.</p>
                <div className="mcd-evidence">
                  {POSTS_DATA.chart.map(c => (
                    <div key={c.type} className="mcd-bar">
                      <span>{TYPE_META[c.type].ar}</span>
                      <div className="mcd-bar-t"><div style={{width:`${(c.engagement/5)*100}%`, background: TYPE_META[c.type].color}}/></div>
                      <span className="num">{c.engagement}٪</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mcd-msg">
              <div className="mcd-av">✦</div>
              <div className="mcd-bubble">
                <div className="mcd-k good">٢ · المنشور الأكثر نجاحاً</div>
                <p>{w.body}</p>
                <div className="mcd-post">
                  <div className="mcd-post-meta">
                    <TypePill type="video" size="sm"/>
                    <span className="num">{w.impressions}٪ تفاعل</span>
                    <span className="num">{w.likes} إعجاب</span>
                    <span className="num">{w.reach} وصول</span>
                  </div>
                  <div className="mcd-post-body">{w.postTopic}</div>
                </div>
                <div className="mcd-actions">
                  <button className="mcd-btn"><Icon path={I.wand} size={12}/> أنشئ مشابهاً</button>
                  <button className="mcd-btn ghost">عرض المنشور</button>
                </div>
              </div>
            </div>

            <div className="mcd-msg">
              <div className="mcd-av">✦</div>
              <div className="mcd-bubble">
                <div className="mcd-k bad">٣ · ما يستنزف أداءك</div>
                <p>{l.body}</p>
                <div className="mcd-rec">
                  <strong>توصيتي:</strong> {l.recommendation}
                </div>
              </div>
            </div>

            {/* Reply */}
            <div className="mcd-reply">
              <div className="mcd-suggest">
                <button>ما أفضل وقت للنشر؟</button>
                <button>اقترح ٣ أفكار محتوى</button>
                <button>لماذا انخفض وصولي؟</button>
              </div>
              <div className="mcd-input">
                <input placeholder="اسأل بصيرة عن منشوراتك…" />
                <button><Icon path={I.spark} size={14}/></button>
              </div>
            </div>
          </section>

          {/* SIDE — analytics */}
          <aside className="mcd-side">
            <section className="mcd-card">
              <div className="mcd-card-head">
                <h3>التفاعل حسب النوع</h3>
              </div>
              <div className="mcd-chart">
                {POSTS_DATA.chart.map(c => {
                  const pct = (c.engagement/5)*100;
                  return (
                    <div key={c.type} className="mcd-barc">
                      <div className="mcd-barc-track">
                        <div className="mcd-barc-fill" style={{height:`${pct}%`, background: TYPE_META[c.type].color}}>
                          <span className="num">{c.engagement}٪</span>
                        </div>
                      </div>
                      <div className="mcd-barc-lbl">
                        <div>{TYPE_META[c.type].ar}</div>
                        <div className="num">{c.posts} منشور</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mcd-card">
              <div className="mcd-card-head">
                <h3>الأحدث</h3>
                <button className="mcd-link">الكل ↩</button>
              </div>
              <div className="mcd-posts">
                {posts.map((p,i) => (
                  <div key={i} className="mcd-prow">
                    <div className="mcd-prow-thumb">
                      <Thumb variant={p.thumb} h={44}/>
                    </div>
                    <div className="mcd-prow-body">
                      <div className="mcd-prow-meta">
                        <TypeIcon type={p.type} size={10}/>
                        <span>{TYPE_META[p.type].ar}</span>
                      </div>
                      <div className="mcd-prow-t">{p.title}</div>
                    </div>
                    <div className="mcd-prow-e">
                      <span className="num" style={{color: p.eng>=15?'oklch(0.5 0.15 155)':p.eng<8?'oklch(0.6 0.15 30)':'var(--ink-700)'}}>{p.eng}٪</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>

      <style>{`
        .mcd { display: flex; min-height: 100vh; background: var(--canvas); }
        .mcd-main { flex: 1; padding: 32px 40px 48px; display: flex; flex-direction: column; gap: 20px; max-width: 1520px; }

        .mcd-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
        .mcd-crumb { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-500); margin-bottom: 10px; font-weight: 500; }
        .mcd-crumb > :nth-child(2) { color: var(--ink-300); }
        .mcd-titlerow { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .mcd-head h1 { font-size: 30px; font-weight: 700; color: var(--ink-950); letter-spacing: -0.02em; margin: 0; }
        .mcd-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 99px; background: var(--purple-50); color: var(--purple-700); font-size: 12px; font-weight: 600; }
        .mcd-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--purple-500); box-shadow: 0 0 0 3px rgba(124,92,239,.2); }
        .mcd-head p { font-size: 13.5px; color: var(--ink-500); margin: 0; max-width: 560px; }

        .mcd-ctrls { display: flex; gap: 10px; align-items: center; }
        .mcd-seg { display: flex; background: var(--ink-100); border-radius: 10px; padding: 3px; }
        .mcd-seg button { padding: 7px 14px; font-size: 12.5px; border-radius: 7px; color: var(--ink-600); font-weight: 500; }
        .mcd-seg button.is-on { background: var(--surface); color: var(--ink-900); font-weight: 600; box-shadow: var(--shadow-sm); }
        .mcd-export { display: flex; align-items: center; gap: 7px; padding: 10px 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; font-size: 13px; font-weight: 500; color: var(--ink-800); }

        .mcd-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
        .mcd-stat { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; }
        .mcd-stat-k { font-size: 11px; color: var(--ink-500); font-weight: 500; margin-bottom: 10px; }
        .mcd-stat-v { font-size: 26px; font-weight: 700; color: var(--ink-950); letter-spacing: -0.02em; line-height: 1; margin-bottom: 6px; }
        .mcd-stat-d { font-size: 11.5px; font-weight: 600; }
        .mcd-stat-d.up { color: oklch(0.5 0.15 155); }
        .mcd-stat-d.down { color: oklch(0.55 0.15 30); }

        .mcd-ai { background: linear-gradient(135deg, var(--purple-50), oklch(0.97 0.03 280)); border: 1px solid var(--purple-200); border-radius: 16px; padding: 18px 22px; display: flex; justify-content: space-between; align-items: center; gap: 14px; }
        .mcd-ai-l { display: flex; gap: 14px; align-items: center; }
        .mcd-ai-spark { width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, var(--purple-500), var(--purple-700)); color: #fff; display: grid; place-items: center; font-size: 16px; font-weight: 700; box-shadow: 0 4px 14px -4px rgba(99,65,224,.4); }
        .mcd-ai-k { font-size: 11px; font-weight: 700; color: var(--purple-700); margin-bottom: 3px; letter-spacing: 0.01em; }
        .mcd-ai-t { font-size: 13.5px; color: var(--ink-900); font-weight: 500; line-height: 1.5; }
        .mcd-ai-t strong { color: var(--purple-800); font-weight: 700; }
        .mcd-ai-btn { padding: 9px 14px; background: var(--surface); border-radius: 9px; font-size: 12px; font-weight: 600; color: var(--ink-800); border: 1px solid var(--line); }
        .mcd-ai-btn:hover { border-color: var(--purple-300); }

        .mcd-2col { display: grid; grid-template-columns: 1.4fr 1fr; gap: 18px; align-items: flex-start; }

        /* THREAD */
        .mcd-thread { display: flex; flex-direction: column; gap: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 22px; }
        .mcd-msg { display: flex; gap: 12px; align-items: flex-start; }
        .mcd-av { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, var(--purple-500), var(--purple-700)); color: #fff; display: grid; place-items: center; font-size: 14px; font-weight: 700; flex-shrink: 0; box-shadow: 0 4px 14px -4px rgba(99,65,224,.4); }
        .mcd-bubble { background: var(--ink-50); border-radius: 16px; border-top-start-radius: 4px; padding: 16px 18px; flex: 1; }
        .mcd-intro { font-size: 14.5px; color: var(--ink-900); font-weight: 500; line-height: 1.6; }
        .mcd-k { font-size: 11px; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.02em; }
        .mcd-k.good { color: oklch(0.45 0.15 155); }
        .mcd-k.bad { color: oklch(0.55 0.15 30); }
        .mcd-bubble p { margin: 0 0 12px; font-size: 13.5px; line-height: 1.7; color: var(--ink-800); text-wrap: pretty; }
        .mcd-bubble strong { color: var(--ink-950); font-weight: 700; }

        .mcd-evidence { display: flex; flex-direction: column; gap: 6px; padding: 12px; background: var(--surface); border-radius: 10px; border: 1px solid var(--line); }
        .mcd-bar { display: grid; grid-template-columns: 60px 1fr 40px; align-items: center; gap: 10px; font-size: 12px; color: var(--ink-700); font-weight: 500; }
        .mcd-bar-t { height: 7px; background: var(--ink-150); border-radius: 99px; overflow: hidden; }
        .mcd-bar-t > div { height: 100%; border-radius: 99px; }
        .mcd-bar .num { color: var(--ink-900); font-weight: 700; text-align: start; }

        .mcd-post { padding: 12px 14px; background: var(--surface); border-radius: 10px; border: 1px solid var(--line); margin-bottom: 12px; }
        .mcd-post-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 11px; color: var(--ink-600); font-weight: 500; flex-wrap: wrap; }
        .mcd-post-body { font-size: 13px; color: var(--ink-900); line-height: 1.6; font-weight: 500; }

        .mcd-rec { padding: 12px 14px; background: var(--purple-100); border-radius: 10px; font-size: 13px; line-height: 1.6; color: var(--ink-900); }
        .mcd-rec strong { color: var(--purple-800); font-weight: 700; }

        .mcd-actions { display: flex; gap: 8px; }
        .mcd-btn { padding: 8px 14px; background: var(--ink-900); color: #fff; border-radius: 8px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; }
        .mcd-btn.ghost { background: transparent; color: var(--ink-700); border: 1px solid var(--line-strong); }

        .mcd-reply { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; padding-top: 12px; border-top: 1px dashed var(--line); }
        .mcd-suggest { display: flex; gap: 8px; flex-wrap: wrap; }
        .mcd-suggest button { padding: 7px 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 99px; font-size: 12px; color: var(--ink-700); font-weight: 500; }
        .mcd-suggest button:hover { border-color: var(--purple-300); color: var(--purple-700); }
        .mcd-input { display: flex; gap: 8px; background: var(--ink-50); border: 1px solid var(--line); border-radius: 12px; padding: 4px 4px 4px 12px; }
        .mcd-input input { flex: 1; border: none; outline: none; font-family: inherit; font-size: 13.5px; color: var(--ink-900); background: transparent; padding: 10px; }
        .mcd-input button { width: 36px; height: 36px; border-radius: 9px; background: var(--purple-600); color: #fff; display: grid; place-items: center; }

        /* SIDE */
        .mcd-side { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 32px; }
        .mcd-card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 20px; }
        .mcd-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .mcd-card-head h3 { font-size: 14px; font-weight: 700; color: var(--ink-950); margin: 0; letter-spacing: -0.005em; }
        .mcd-link { font-size: 12px; color: var(--purple-700); font-weight: 500; }

        .mcd-chart { display: flex; gap: 12px; align-items: flex-end; height: 200px; }
        .mcd-barc { flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .mcd-barc-track { flex: 1; background: var(--ink-50); border-radius: 10px; position: relative; overflow: hidden; min-height: 160px; }
        .mcd-barc-fill { position: absolute; inset: auto 0 0 0; border-radius: 10px; display: flex; align-items: flex-start; justify-content: center; padding-top: 10px; transition: height 0.5s cubic-bezier(.2,.8,.2,1); }
        .mcd-barc-fill .num { color: #fff; font-size: 12.5px; font-weight: 700; text-shadow: 0 1px 2px rgba(0,0,0,.15); }
        .mcd-barc-lbl { text-align: center; font-size: 11.5px; color: var(--ink-800); font-weight: 600; }
        .mcd-barc-lbl .num { font-size: 10.5px; color: var(--ink-500); font-weight: 500; margin-top: 2px; }

        .mcd-posts { display: flex; flex-direction: column; }
        .mcd-prow { display: grid; grid-template-columns: 56px 1fr auto; align-items: center; gap: 12px; padding: 10px 4px; border-radius: 10px; transition: background 0.1s; }
        .mcd-prow + .mcd-prow { border-top: 1px solid var(--line); }
        .mcd-prow:hover { background: var(--ink-50); }
        .mcd-prow-thumb { width: 56px; height: 44px; border-radius: 8px; overflow: hidden; }
        .mcd-prow-thumb > div { width: 100%; height: 100% !important; }
        .mcd-prow-meta { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; color: var(--ink-500); font-weight: 500; margin-bottom: 2px; }
        .mcd-prow-t { font-size: 12.5px; font-weight: 600; color: var(--ink-900); line-height: 1.3; }
        .mcd-prow-e .num { font-size: 13px; font-weight: 700; }
      `}</style>
    </div>
  );
};

window.MyPostsCD = MyPostsCD;
