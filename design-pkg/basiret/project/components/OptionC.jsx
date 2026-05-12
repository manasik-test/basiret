// OPTION C — Editorial list / split view
// Left: a clean list of posts grouped by day, compact but rich
// Right: focused preview of the selected post with generate-caption action
// Hierarchy: topic dominates, type/time/engagement quiet on the edge

const OptionC = () => {
  const [selected, setSelected] = React.useState(3); // Wed — the "مقترح" one

  const sel = WEEK_DATA[selected];

  return (
    <div dir="rtl" className="opt-c">
      <Sidebar active="content-plan" />

      <main className="c-main">
        <header className="c-head">
          <div>
            <h1 className="c-title">خطة المحتوى</h1>
            <p className="c-sub">٧ منشورات جاهزة لهذا الأسبوع · مقترحة وفق أهدافك</p>
          </div>

          <div className="c-head-act">
            <button className="c-search">
              <Icon path={I.search} size={14}/>
              <span>بحث في الخطة</span>
              <kbd>⌘K</kbd>
            </button>
            <button className="c-primary">
              <Icon path={I.spark} size={14}/>
              <span>إعادة توليد الخطة</span>
            </button>
          </div>
        </header>

        <div className="c-split">
          {/* LIST */}
          <section className="c-list">
            <div className="c-list-head">
              <div className="c-week-range">
                <button className="c-nav"><Icon path={I.chevR} size={14}/></button>
                <span className="num">٢٦ أبريل — ٢ مايو</span>
                <button className="c-nav"><Icon path={I.chevL} size={14}/></button>
              </div>
              <div className="c-filters">
                <button className="c-filter is-on">الكل · 7</button>
                <button className="c-filter">فيديو · 3</button>
                <button className="c-filter">صورة · 2</button>
                <button className="c-filter">كاروسيل · 2</button>
              </div>
            </div>

            <div className="c-rows">
              {WEEK_DATA.map((d, i) => {
                const m = TYPE_META[d.type];
                return (
                  <button
                    key={i}
                    className={`c-row ${i === selected ? 'is-on' : ''}`}
                    onClick={() => setSelected(i)}
                  >
                    <div className="c-row-date">
                      <div className="c-row-day">{d.day}</div>
                      <div className="c-row-num num">{d.date}</div>
                    </div>

                    <div className="c-row-tline" style={{background: m.color}} />

                    <div className="c-row-body">
                      <div className="c-row-top">
                        <span className="c-row-type" style={{color: m.color}}>
                          <TypeIcon type={d.type} size={12}/> {m.ar}
                        </span>
                        {d.tag && <span className="c-row-tag">{d.tag}</span>}
                      </div>
                      <div className="c-row-topic">{d.topic}</div>
                    </div>

                    <div className="c-row-meta">
                      <div className="c-row-time num">
                        <Icon path={I.clock} size={11}/>
                        {d.time}
                      </div>
                      <div className="c-row-eng num">{d.engagement}٪</div>
                    </div>

                    <div className="c-row-chev">
                      <Icon path={I.chevL} size={14}/>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* PREVIEW */}
          <aside className="c-preview">
            <div className="c-prev-head">
              <div>
                <div className="c-prev-day">{sel.day}، {sel.date} · <span className="num">{sel.time}</span></div>
                <h2 className="c-prev-topic">{sel.topic}</h2>
              </div>
              <button className="c-prev-more"><Icon path={I.more} size={16}/></button>
            </div>

            <Thumb variant={sel.thumb} h={220}>
              <div style={{position: 'absolute', bottom: 14, insetInlineEnd: 14}}>
                <TypePill type={sel.type}/>
              </div>
            </Thumb>

            <div className="c-prev-stats">
              <div>
                <div className="c-prev-lbl">نوع المحتوى</div>
                <div className="c-prev-val">{TYPE_META[sel.type].ar}</div>
              </div>
              <div>
                <div className="c-prev-lbl">التفاعل المتوقع</div>
                <div className="c-prev-val num" style={{color: 'var(--purple-700)'}}>{sel.engagement}٪</div>
              </div>
              <div>
                <div className="c-prev-lbl">المنصة</div>
                <div className="c-prev-val">انستغرام</div>
              </div>
            </div>

            <div className="c-prev-caption">
              <div className="c-cap-head">
                <span>التسمية (Caption)</span>
                <span className="c-cap-empty">لم تُنشأ بعد</span>
              </div>
              <div className="c-cap-placeholder">
                سيقوم مساعد بصيرة بكتابة تسمية جذّابة بناءً على الموضوع ونبرة علامتك التجارية.
              </div>
            </div>

            <div className="c-prev-actions">
              <button className="c-prev-ghost">
                <Icon path={I.pencil} size={14}/>
                تعديل الموضوع
              </button>
              <button className="c-prev-cta">
                <Icon path={I.wand} size={14}/>
                إنشاء التسمية
              </button>
            </div>
          </aside>
        </div>
      </main>

      <style>{`
        .opt-c { display: flex; min-height: 100vh; background: var(--canvas); }
        .c-main { flex: 1; padding: 28px 36px 40px; max-width: 1320px; display: flex; flex-direction: column; min-height: 100vh; }

        .c-head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 22px; gap: 20px; }
        .c-title { font-size: 26px; font-weight: 700; color: var(--ink-950); letter-spacing: -0.02em; margin: 0 0 4px; }
        .c-sub { font-size: 13.5px; color: var(--ink-500); margin: 0; }
        .c-head-act { display: flex; gap: 10px; }
        .c-search {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 14px;
          background: var(--surface); border: 1px solid var(--line);
          border-radius: 10px; font-size: 13px; color: var(--ink-500);
          min-width: 240px;
        }
        .c-search kbd { margin-inline-start: auto; font-family: 'Inter', sans-serif; font-size: 11px; background: var(--ink-100); padding: 2px 6px; border-radius: 4px; color: var(--ink-600); }
        .c-primary { display: flex; align-items: center; gap: 8px; padding: 10px 18px; background: var(--purple-600); color: #fff; border-radius: 10px; font-size: 13px; font-weight: 600; box-shadow: 0 4px 12px -4px rgba(99,65,224,.5); }
        .c-primary:hover { background: var(--purple-700); }

        .c-split { display: grid; grid-template-columns: 1.2fr 0.9fr; gap: 18px; flex: 1; min-height: 0; }

        .c-list {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 16px;
          display: flex; flex-direction: column;
          overflow: hidden;
        }
        .c-list-head {
          padding: 16px 20px 12px;
          border-bottom: 1px solid var(--line);
          display: flex; flex-direction: column; gap: 12px;
        }
        .c-week-range { display: flex; align-items: center; gap: 12px; font-size: 13.5px; font-weight: 600; color: var(--ink-800); }
        .c-nav { width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center; color: var(--ink-600); background: var(--ink-100); }
        .c-nav:hover { background: var(--ink-150); color: var(--ink-900); }
        .c-filters { display: flex; gap: 6px; }
        .c-filter { padding: 6px 12px; border-radius: 99px; background: transparent; border: 1px solid var(--line); font-size: 12px; color: var(--ink-600); font-weight: 500; transition: all 0.12s; }
        .c-filter:hover { border-color: var(--line-strong); color: var(--ink-900); }
        .c-filter.is-on { background: var(--ink-900); color: #fff; border-color: var(--ink-900); }

        .c-rows { padding: 6px 10px 10px; display: flex; flex-direction: column; }

        .c-row {
          display: grid;
          grid-template-columns: 72px 3px 1fr auto 18px;
          align-items: center;
          gap: 14px;
          padding: 14px 14px;
          border-radius: 12px;
          text-align: start;
          transition: background 0.1s;
          position: relative;
        }
        .c-row + .c-row::before {
          content: '';
          position: absolute; top: 0; inset-inline: 14px;
          height: 1px; background: var(--line);
        }
        .c-row:hover { background: var(--ink-50); }
        .c-row:hover + .c-row::before,
        .c-row.is-on::before, .c-row.is-on + .c-row::before { opacity: 0; }
        .c-row.is-on { background: var(--purple-50); }
        .c-row.is-on .c-row-topic { color: var(--purple-900); }

        .c-row-date { text-align: start; }
        .c-row-day { font-size: 11px; color: var(--ink-500); font-weight: 500; }
        .c-row-num { font-size: 14px; font-weight: 700; color: var(--ink-900); letter-spacing: -0.01em; margin-top: 2px; }

        .c-row-tline { width: 3px; height: 36px; border-radius: 3px; }

        .c-row-top { display: flex; align-items: center; gap: 10px; margin-bottom: 3px; }
        .c-row-type { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; }
        .c-row-tag { font-size: 10px; font-weight: 700; color: var(--purple-700); background: var(--purple-100); padding: 2px 7px; border-radius: 99px; }
        .c-row-topic { font-size: 14px; font-weight: 600; color: var(--ink-900); line-height: 1.4; letter-spacing: -0.005em; }

        .c-row-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
        .c-row-time { font-size: 12px; color: var(--ink-600); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
        .c-row-eng { font-size: 10.5px; color: var(--ink-400); font-weight: 500; }

        .c-row-chev { color: var(--ink-300); }
        .c-row.is-on .c-row-chev { color: var(--purple-600); }

        /* Preview */
        .c-preview {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 20px;
          display: flex; flex-direction: column;
          gap: 18px;
          position: sticky; top: 20px;
          align-self: flex-start;
          max-height: calc(100vh - 40px);
          overflow: auto;
        }
        .c-prev-head { display: flex; justify-content: space-between; align-items: flex-start; }
        .c-prev-day { font-size: 12px; color: var(--ink-500); font-weight: 500; margin-bottom: 6px; }
        .c-prev-topic { font-size: 20px; font-weight: 700; color: var(--ink-950); letter-spacing: -0.02em; margin: 0; line-height: 1.3; max-width: 320px; text-wrap: pretty; }
        .c-prev-more { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; color: var(--ink-500); }
        .c-prev-more:hover { background: var(--ink-100); color: var(--ink-900); }

        .c-prev-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 16px; background: var(--ink-50); border-radius: 12px; }
        .c-prev-lbl { font-size: 10.5px; color: var(--ink-500); margin-bottom: 4px; font-weight: 500; }
        .c-prev-val { font-size: 13.5px; font-weight: 600; color: var(--ink-900); }

        .c-prev-caption { background: var(--ink-50); border-radius: 12px; padding: 14px; border: 1px dashed var(--ink-200); }
        .c-cap-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 11.5px; font-weight: 600; color: var(--ink-700); }
        .c-cap-empty { font-weight: 500; color: var(--ink-400); font-size: 11px; }
        .c-cap-placeholder { font-size: 12.5px; color: var(--ink-500); line-height: 1.55; text-wrap: pretty; }

        .c-prev-actions { display: flex; gap: 10px; margin-top: auto; }
        .c-prev-ghost { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 11px; background: var(--ink-100); color: var(--ink-700); border-radius: 10px; font-size: 13px; font-weight: 600; }
        .c-prev-ghost:hover { background: var(--ink-150); }
        .c-prev-cta { flex: 1.3; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 11px; background: var(--purple-600); color: #fff; border-radius: 10px; font-size: 13px; font-weight: 600; box-shadow: 0 4px 12px -4px rgba(99,65,224,.5); }
        .c-prev-cta:hover { background: var(--purple-700); }
      `}</style>
    </div>
  );
};

window.OptionC = OptionC;
