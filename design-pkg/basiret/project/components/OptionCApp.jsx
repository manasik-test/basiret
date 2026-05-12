// Option C — polished standalone with state, tweaks, and caption generation

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "cozy",
  "accentHue": 295,
  "captionTone": "ودود"
}/*EDITMODE-END*/;

const OptionCApp = () => {
  const [selected, setSelected] = React.useState(3);
  const [filter, setFilter] = React.useState('all');
  const [captions, setCaptions] = React.useState({}); // index -> caption text
  const [generating, setGenerating] = React.useState(null);

  const [tweaksOn, setTweaksOn] = React.useState(false);
  const [density, setDensity] = React.useState(DEFAULTS.density);
  const [accentHue, setAccentHue] = React.useState(DEFAULTS.accentHue);
  const [captionTone, setCaptionTone] = React.useState(DEFAULTS.captionTone);

  // Tweaks protocol
  React.useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__activate_edit_mode') setTweaksOn(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksOn(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const persist = (patch) => {
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: patch }, '*');
  };

  // Dynamic accent
  React.useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--purple-50',  `oklch(0.98 0.015 ${accentHue})`);
    r.style.setProperty('--purple-100', `oklch(0.95 0.04  ${accentHue})`);
    r.style.setProperty('--purple-200', `oklch(0.88 0.08  ${accentHue})`);
    r.style.setProperty('--purple-300', `oklch(0.78 0.13  ${accentHue})`);
    r.style.setProperty('--purple-400', `oklch(0.68 0.17  ${accentHue})`);
    r.style.setProperty('--purple-500', `oklch(0.58 0.19  ${accentHue})`);
    r.style.setProperty('--purple-600', `oklch(0.50 0.20  ${accentHue})`);
    r.style.setProperty('--purple-700', `oklch(0.42 0.18  ${accentHue})`);
    r.style.setProperty('--purple-800', `oklch(0.34 0.15  ${accentHue})`);
    r.style.setProperty('--purple-900', `oklch(0.26 0.12  ${accentHue})`);
  }, [accentHue]);

  const filtered = filter === 'all' ? WEEK_DATA : WEEK_DATA.filter(d => d.type === filter);
  const typeCounts = {
    all: WEEK_DATA.length,
    video: WEEK_DATA.filter(d => d.type === 'video').length,
    image: WEEK_DATA.filter(d => d.type === 'image').length,
    carousel: WEEK_DATA.filter(d => d.type === 'carousel').length,
  };

  const sel = WEEK_DATA[selected];
  const selCaption = captions[selected];

  const generateCaption = async () => {
    setGenerating(selected);
    try {
      const prompt = `اكتب تسمية (caption) قصيرة جذّابة لمنشور انستغرام باللغة العربية، نبرة ${captionTone}. الموضوع: "${sel.topic}". نوع المحتوى: ${TYPE_META[sel.type].ar}. أضف 3 هاشتاغات مناسبة. لا تزيد عن 50 كلمة. اكتب التسمية مباشرة دون مقدمات.`;
      const text = await window.claude.complete(prompt);
      setCaptions(c => ({ ...c, [selected]: text.trim() }));
    } catch (e) {
      setCaptions(c => ({ ...c, [selected]: 'تعذّر توليد التسمية. حاول مرة أخرى.' }));
    } finally {
      setGenerating(null);
    }
  };

  // Keyboard nav
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const currentIdx = filtered.findIndex((_, i) => WEEK_DATA.indexOf(filtered[i]) === selected);
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const next = filtered[Math.min(currentIdx + 1, filtered.length - 1)];
        if (next) setSelected(WEEK_DATA.indexOf(next));
      }
      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prev = filtered[Math.max(currentIdx - 1, 0)];
        if (prev) setSelected(WEEK_DATA.indexOf(prev));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, filtered]);

  return (
    <div dir="rtl" className={`oc density-${density}`}>
      <Sidebar active="content-plan" />

      <main className="oc-main">
        <header className="oc-head">
          <div>
            <div className="oc-crumb">
              <span>لوحة التحكم</span>
              <Icon path={I.chevL} size={10}/>
              <span>خطة المحتوى</span>
            </div>
            <div className="oc-titlerow">
              <h1 className="oc-title">أسبوعك القادم</h1>
              <span className="oc-badge">
                <span className="oc-dot"/>
                ٧ أيام
              </span>
            </div>
            <p className="oc-sub">منشورات مقترحة بالذكاء الاصطناعي وفق جمهورك وأهدافك — عدّل ما تريد قبل النشر</p>
          </div>

          <div className="oc-head-act">
            <button className="oc-search">
              <Icon path={I.search} size={14}/>
              <span>بحث في الخطة</span>
              <kbd>⌘K</kbd>
            </button>
            <button className="oc-regen">
              <Icon path={I.spark} size={14}/>
              <span>إعادة توليد الخطة</span>
            </button>
          </div>
        </header>

        <div className="oc-split">
          <section className="oc-list">
            <div className="oc-list-head">
              <div className="oc-week">
                <button className="oc-nav"><Icon path={I.chevR} size={14}/></button>
                <div className="oc-week-txt">
                  <div className="oc-week-label">الأسبوع ١٨</div>
                  <div className="oc-week-range num">٢٦ أبريل — ٢ مايو</div>
                </div>
                <button className="oc-nav"><Icon path={I.chevL} size={14}/></button>
              </div>

              <div className="oc-filters">
                {[
                  {k: 'all', lbl: 'الكل'},
                  {k: 'video', lbl: 'فيديو'},
                  {k: 'image', lbl: 'صورة'},
                  {k: 'carousel', lbl: 'كاروسيل'},
                ].map(f => (
                  <button
                    key={f.k}
                    className={`oc-filter ${filter === f.k ? 'is-on' : ''}`}
                    onClick={() => setFilter(f.k)}
                  >
                    {f.lbl} <span className="num">· {typeCounts[f.k]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="oc-rows">
              {filtered.map((d) => {
                const realIdx = WEEK_DATA.indexOf(d);
                const m = TYPE_META[d.type];
                const hasCaption = !!captions[realIdx];
                return (
                  <button
                    key={realIdx}
                    className={`oc-row ${realIdx === selected ? 'is-on' : ''}`}
                    onClick={() => setSelected(realIdx)}
                  >
                    <div className="oc-row-date">
                      <div className="oc-row-day">{d.day}</div>
                      <div className="oc-row-num num">{d.date}</div>
                    </div>

                    <div className="oc-row-tline" style={{background: m.color}} />

                    <div className="oc-row-body">
                      <div className="oc-row-top">
                        <span className="oc-row-type" style={{color: m.color}}>
                          <TypeIcon type={d.type} size={12}/> {m.ar}
                        </span>
                        {d.tag && <span className="oc-row-tag">مقترح</span>}
                        {hasCaption && <span className="oc-row-done"><Icon path={I.check} size={10}/> جاهز</span>}
                      </div>
                      <div className="oc-row-topic">{d.topic}</div>
                    </div>

                    <div className="oc-row-meta">
                      <div className="oc-row-time num">
                        <Icon path={I.clock} size={11}/>
                        {d.time}
                      </div>
                      <div className="oc-row-eng num">{d.engagement}٪ تفاعل</div>
                    </div>

                    <div className="oc-row-chev">
                      <Icon path={I.chevL} size={14}/>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="oc-list-foot">
              <span className="oc-foot-hint">
                <kbd>↑</kbd><kbd>↓</kbd> للتنقّل
              </span>
              <span className="num oc-foot-count">
                {Object.keys(captions).length}/{WEEK_DATA.length} تسميات جاهزة
              </span>
            </div>
          </section>

          <aside className="oc-preview">
            <div className="oc-prev-head">
              <div>
                <div className="oc-prev-day">
                  <span>{sel.day}، {sel.date}</span>
                  <span className="oc-prev-dot">·</span>
                  <span className="num">{sel.time}</span>
                </div>
                <h2 className="oc-prev-topic">{sel.topic}</h2>
              </div>
              <button className="oc-prev-more" aria-label="المزيد"><Icon path={I.more} size={16}/></button>
            </div>

            <Thumb variant={sel.thumb} h={200}>
              <div style={{position: 'absolute', bottom: 12, insetInlineEnd: 12}}>
                <TypePill type={sel.type}/>
              </div>
              {sel.tag && (
                <div style={{
                  position: 'absolute', top: 12, insetInlineStart: 12,
                  background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(8px)',
                  padding: '4px 10px', borderRadius: 99,
                  fontSize: 11, fontWeight: 700, color: 'var(--purple-700)',
                }}>✦ مقترح بصيرة</div>
              )}
            </Thumb>

            <div className="oc-prev-stats">
              <div>
                <div className="oc-prev-lbl">النوع</div>
                <div className="oc-prev-val">{TYPE_META[sel.type].ar}</div>
              </div>
              <div className="oc-prev-sep"/>
              <div>
                <div className="oc-prev-lbl">التفاعل المتوقع</div>
                <div className="oc-prev-val num" style={{color: 'var(--purple-700)'}}>
                  {sel.engagement}٪
                </div>
              </div>
              <div className="oc-prev-sep"/>
              <div>
                <div className="oc-prev-lbl">المنصة</div>
                <div className="oc-prev-val">انستغرام</div>
              </div>
            </div>

            <div className={`oc-cap ${selCaption ? 'has-cap' : ''} ${generating === selected ? 'is-gen' : ''}`}>
              <div className="oc-cap-head">
                <span className="oc-cap-title">
                  <Icon path={I.wand} size={13}/>
                  التسمية
                </span>
                {selCaption
                  ? <button className="oc-cap-regen" onClick={generateCaption}>توليد أخرى</button>
                  : <span className="oc-cap-empty">لم تُنشأ بعد</span>}
              </div>

              {generating === selected ? (
                <div className="oc-cap-loading">
                  <div className="oc-loader"/>
                  <span>بصيرة تكتب لك تسمية بنبرة {captionTone}…</span>
                </div>
              ) : selCaption ? (
                <div className="oc-cap-text">{selCaption}</div>
              ) : (
                <div className="oc-cap-placeholder">
                  سيقوم مساعد بصيرة بكتابة تسمية جذّابة بنبرة {captionTone} بناءً على الموضوع.
                </div>
              )}
            </div>

            <div className="oc-prev-actions">
              <button className="oc-ghost">
                <Icon path={I.pencil} size={14}/>
                تعديل
              </button>
              <button className="oc-cta" onClick={generateCaption} disabled={generating === selected}>
                <Icon path={I.wand} size={14}/>
                {selCaption ? 'توليد بديل' : 'إنشاء التسمية'}
              </button>
            </div>
          </aside>
        </div>
        <MPGAskFab />
      </main>

      {tweaksOn && (
        <TweaksPanel
          density={density} setDensity={(v) => { setDensity(v); persist({density: v}); }}
          accentHue={accentHue} setAccentHue={(v) => { setAccentHue(v); persist({accentHue: v}); }}
          captionTone={captionTone} setCaptionTone={(v) => { setCaptionTone(v); persist({captionTone: v}); }}
        />
      )}

      <style>{`
        .oc { display: flex; min-height: 100vh; background: var(--canvas); }
        .oc-main {
          flex: 1;
          padding: 32px 40px 28px;
          display: flex; flex-direction: column;
          min-height: 100vh;
          gap: 22px;
          max-width: 1480px;
        }
        .oc.density-compact .oc-main { padding: 24px 32px 22px; gap: 16px; }
        .oc.density-spacious .oc-main { padding: 40px 48px 36px; gap: 28px; }

        .oc-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
        .oc-crumb {
          display: flex; align-items: center; gap: 8px;
          font-size: 12px; color: var(--ink-500); margin-bottom: 10px; font-weight: 500;
        }
        .oc-crumb > :nth-child(2) { color: var(--ink-300); }
        .oc-titlerow { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .oc-title {
          font-size: 30px; font-weight: 700;
          color: var(--ink-950);
          letter-spacing: -0.02em;
          margin: 0;
          line-height: 1.15;
        }
        .oc-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px; border-radius: 99px;
          background: var(--purple-50);
          color: var(--purple-700);
          font-size: 12px; font-weight: 600;
        }
        .oc-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--purple-500); box-shadow: 0 0 0 3px rgba(124,92,239,.2); }
        .oc-sub { font-size: 13.5px; color: var(--ink-500); margin: 0; max-width: 560px; line-height: 1.55; text-wrap: pretty; }

        .oc-head-act { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }
        .oc-search {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px;
          background: var(--surface); border: 1px solid var(--line);
          border-radius: 10px; font-size: 13px; color: var(--ink-500);
          min-width: 260px;
          transition: border-color 0.12s;
        }
        .oc-search:hover { border-color: var(--line-strong); }
        .oc-search kbd {
          margin-inline-start: auto;
          font-family: 'Inter', sans-serif; font-size: 10.5px;
          background: var(--ink-100); padding: 2px 6px;
          border-radius: 4px; color: var(--ink-600);
        }
        .oc-regen {
          display: flex; align-items: center; gap: 8px;
          padding: 11px 18px;
          background: var(--purple-600);
          color: #fff;
          border-radius: 10px;
          font-size: 13px; font-weight: 600;
          box-shadow: 0 6px 16px -6px rgba(99,65,224,.55), inset 0 1px 0 rgba(255,255,255,.15);
          transition: background 0.12s, transform 0.12s, box-shadow 0.12s;
        }
        .oc-regen:hover {
          background: var(--purple-700);
          transform: translateY(-1px);
          box-shadow: 0 8px 20px -6px rgba(99,65,224,.6), inset 0 1px 0 rgba(255,255,255,.15);
        }

        .oc-split {
          display: grid;
          grid-template-columns: 1.35fr 1fr;
          gap: 18px;
          flex: 1;
          min-height: 0;
        }

        /* LIST */
        .oc-list {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 18px;
          display: flex; flex-direction: column;
          overflow: hidden;
        }
        .oc-list-head {
          padding: 18px 22px 14px;
          border-bottom: 1px solid var(--line);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .oc-week { display: flex; align-items: center; gap: 14px; }
        .oc-week-txt { flex: 1; }
        .oc-week-label { font-size: 11px; color: var(--ink-500); font-weight: 500; margin-bottom: 2px; }
        .oc-week-range { font-size: 14.5px; font-weight: 700; color: var(--ink-950); letter-spacing: -0.01em; }
        .oc-nav {
          width: 30px; height: 30px; border-radius: 8px;
          display: grid; place-items: center;
          color: var(--ink-600);
          background: var(--ink-100);
          transition: background 0.12s, color 0.12s;
        }
        .oc-nav:hover { background: var(--ink-150); color: var(--ink-900); }

        .oc-filters { display: flex; gap: 6px; flex-wrap: wrap; }
        .oc-filter {
          padding: 6px 12px; border-radius: 99px;
          background: transparent;
          border: 1px solid var(--line);
          font-size: 12px; color: var(--ink-600); font-weight: 500;
          transition: all 0.12s;
        }
        .oc-filter:hover { border-color: var(--line-strong); color: var(--ink-900); }
        .oc-filter.is-on {
          background: var(--ink-900); color: #fff; border-color: var(--ink-900);
        }
        .oc-filter .num { opacity: 0.7; font-size: 11px; }

        .oc-rows {
          padding: 6px 10px 6px;
          display: flex; flex-direction: column;
          flex: 1;
          overflow: auto;
        }
        .oc-row {
          display: grid;
          grid-template-columns: 68px 3px 1fr auto 18px;
          align-items: center;
          gap: 14px;
          padding: 16px 14px;
          border-radius: 12px;
          text-align: start;
          transition: background 0.1s;
          position: relative;
          width: 100%;
        }
        .oc.density-compact .oc-row { padding: 12px 14px; }
        .oc.density-spacious .oc-row { padding: 20px 14px; }

        .oc-row + .oc-row::before {
          content: '';
          position: absolute; top: 0;
          inset-inline: 14px;
          height: 1px;
          background: var(--line);
        }
        .oc-row:hover { background: var(--ink-50); }
        .oc-row:hover::before,
        .oc-row:hover + .oc-row::before { opacity: 0; }
        .oc-row.is-on { background: var(--purple-50); }
        .oc-row.is-on::before,
        .oc-row.is-on + .oc-row::before { opacity: 0; }
        .oc-row.is-on .oc-row-topic { color: var(--purple-900); }
        .oc-row.is-on .oc-row-num { color: var(--purple-800); }

        .oc-row-date { text-align: start; }
        .oc-row-day { font-size: 11px; color: var(--ink-500); font-weight: 500; }
        .oc-row-num { font-size: 14.5px; font-weight: 700; color: var(--ink-900); letter-spacing: -0.01em; margin-top: 2px; }

        .oc-row-tline { width: 3px; height: 36px; border-radius: 3px; }

        .oc-row-top {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 4px;
          flex-wrap: wrap;
        }
        .oc-row-type {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 600;
        }
        .oc-row-tag {
          font-size: 10px; font-weight: 700;
          color: var(--purple-700); background: var(--purple-100);
          padding: 2px 7px; border-radius: 99px;
        }
        .oc-row-done {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 10px; font-weight: 700;
          color: oklch(0.5 0.15 155);
          background: oklch(0.95 0.05 155);
          padding: 2px 7px; border-radius: 99px;
        }
        .oc-row-topic {
          font-size: 14px; font-weight: 600;
          color: var(--ink-900); line-height: 1.4;
          letter-spacing: -0.005em;
          text-wrap: pretty;
        }

        .oc-row-meta {
          display: flex; flex-direction: column;
          align-items: flex-end; gap: 3px;
        }
        .oc-row-time {
          font-size: 12px; color: var(--ink-700); font-weight: 600;
          display: inline-flex; align-items: center; gap: 4px;
        }
        .oc-row-eng { font-size: 11px; color: var(--ink-400); font-weight: 500; }

        .oc-row-chev { color: var(--ink-300); transition: color 0.12s, transform 0.12s; }
        .oc-row.is-on .oc-row-chev { color: var(--purple-600); transform: translateX(-2px); }

        .oc-list-foot {
          border-top: 1px solid var(--line);
          padding: 12px 22px;
          display: flex; justify-content: space-between; align-items: center;
          font-size: 11.5px; color: var(--ink-500);
        }
        .oc-foot-hint { display: inline-flex; align-items: center; gap: 6px; }
        .oc-foot-hint kbd {
          font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 600;
          background: var(--ink-100); color: var(--ink-700);
          padding: 1px 5px; border-radius: 4px;
          box-shadow: 0 1px 0 var(--ink-200);
        }
        .oc-foot-count { font-weight: 600; color: var(--ink-700); }

        /* PREVIEW */
        .oc-preview {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 22px;
          display: flex; flex-direction: column;
          gap: 18px;
          position: sticky; top: 32px;
          align-self: flex-start;
          max-height: calc(100vh - 64px);
          overflow: auto;
        }
        .oc-prev-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .oc-prev-day {
          font-size: 12px; color: var(--ink-500); font-weight: 500;
          margin-bottom: 6px; display: inline-flex; align-items: center; gap: 6px;
        }
        .oc-prev-dot { color: var(--ink-300); }
        .oc-prev-topic {
          font-size: 22px; font-weight: 700;
          color: var(--ink-950);
          letter-spacing: -0.02em;
          margin: 0; line-height: 1.25;
          text-wrap: pretty;
        }
        .oc-prev-more {
          width: 32px; height: 32px;
          border-radius: 8px; display: grid; place-items: center;
          color: var(--ink-500);
          flex-shrink: 0;
        }
        .oc-prev-more:hover { background: var(--ink-100); color: var(--ink-900); }

        .oc-prev-stats {
          display: flex;
          padding: 14px 18px;
          background: var(--ink-50);
          border-radius: 14px;
          align-items: center;
          gap: 16px;
        }
        .oc-prev-stats > div:not(.oc-prev-sep) { flex: 1; }
        .oc-prev-sep { width: 1px; height: 28px; background: var(--line); flex-shrink: 0; }
        .oc-prev-lbl { font-size: 10.5px; color: var(--ink-500); margin-bottom: 4px; font-weight: 500; letter-spacing: 0.01em; }
        .oc-prev-val { font-size: 14px; font-weight: 700; color: var(--ink-900); letter-spacing: -0.005em; }

        /* Caption block */
        .oc-cap {
          background: var(--ink-50);
          border-radius: 14px;
          padding: 16px;
          border: 1px dashed var(--ink-200);
          transition: background 0.15s, border-color 0.15s;
        }
        .oc-cap.has-cap {
          background: var(--purple-50);
          border: 1px solid var(--purple-200);
          border-style: solid;
        }
        .oc-cap.is-gen { background: var(--purple-50); border-color: var(--purple-300); border-style: solid; }
        .oc-cap-head {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 10px;
        }
        .oc-cap-title {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11.5px; font-weight: 700;
          color: var(--ink-800);
          letter-spacing: 0.02em;
        }
        .oc-cap.has-cap .oc-cap-title, .oc-cap.is-gen .oc-cap-title { color: var(--purple-800); }
        .oc-cap-empty { font-weight: 500; color: var(--ink-400); font-size: 11px; }
        .oc-cap-regen {
          font-size: 11px; font-weight: 600;
          color: var(--purple-700);
          padding: 3px 8px;
          border-radius: 6px;
        }
        .oc-cap-regen:hover { background: var(--purple-100); }

        .oc-cap-placeholder {
          font-size: 13px; color: var(--ink-500);
          line-height: 1.6; text-wrap: pretty;
        }
        .oc-cap-text {
          font-size: 13.5px; color: var(--ink-900);
          line-height: 1.7; text-wrap: pretty;
          white-space: pre-wrap;
          font-weight: 500;
        }
        .oc-cap-loading {
          display: flex; align-items: center; gap: 10px;
          font-size: 12.5px; color: var(--purple-800);
          padding: 4px 0;
        }
        .oc-loader {
          width: 14px; height: 14px;
          border: 2px solid var(--purple-200);
          border-top-color: var(--purple-600);
          border-radius: 50%;
          animation: oc-spin 0.7s linear infinite;
        }
        @keyframes oc-spin { to { transform: rotate(360deg); } }

        .oc-prev-actions {
          display: flex; gap: 10px;
          margin-top: auto;
        }
        .oc-ghost {
          flex: 1;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 12px;
          background: var(--ink-100);
          color: var(--ink-800);
          border-radius: 10px;
          font-size: 13px; font-weight: 600;
          transition: background 0.12s;
        }
        .oc-ghost:hover { background: var(--ink-150); }
        .oc-cta {
          flex: 1.4;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          padding: 12px;
          background: var(--purple-600); color: #fff;
          border-radius: 10px;
          font-size: 13px; font-weight: 600;
          box-shadow: 0 6px 16px -6px rgba(99,65,224,.55), inset 0 1px 0 rgba(255,255,255,.15);
          transition: background 0.12s, transform 0.12s;
        }
        .oc-cta:hover:not(:disabled) { background: var(--purple-700); transform: translateY(-1px); }
        .oc-cta:disabled { opacity: 0.7; cursor: not-allowed; }
      `}</style>
    </div>
  );
};

const TweaksPanel = ({ density, setDensity, accentHue, setAccentHue, captionTone, setCaptionTone }) => {
  return (
    <div dir="rtl" className="tw">
      <div className="tw-head">
        <div>
          <div className="tw-title">Tweaks</div>
          <div className="tw-sub">تخصيص مباشر</div>
        </div>
        <div className="tw-live"><span/>حيّ</div>
      </div>

      <div className="tw-row">
        <label>الكثافة</label>
        <div className="tw-seg">
          {['compact','cozy','spacious'].map(d => (
            <button key={d} className={density===d?'is-on':''} onClick={() => setDensity(d)}>
              {d==='compact'?'مضغوط':d==='cozy'?'مريح':'واسع'}
            </button>
          ))}
        </div>
      </div>

      <div className="tw-row">
        <label>لون العلامة <span className="num tw-hue">H {accentHue}°</span></label>
        <input type="range" min="0" max="360" value={accentHue}
          onChange={e => setAccentHue(parseInt(e.target.value))}
          className="tw-slider"
          style={{background: `linear-gradient(to left, oklch(0.58 0.19 0), oklch(0.58 0.19 60), oklch(0.58 0.19 120), oklch(0.58 0.19 180), oklch(0.58 0.19 240), oklch(0.58 0.19 300), oklch(0.58 0.19 360))`}}
        />
        <div className="tw-swatches">
          {[295, 260, 220, 180, 340, 25].map(h => (
            <button key={h} className={`tw-sw ${accentHue===h?'is-on':''}`}
              style={{background: `oklch(0.5 0.2 ${h})`}}
              onClick={() => setAccentHue(h)}
            />
          ))}
        </div>
      </div>

      <div className="tw-row">
        <label>نبرة التسمية</label>
        <div className="tw-chips">
          {['ودود','احترافي','حماسي','ساخر','راقي'].map(t => (
            <button key={t} className={`tw-chip ${captionTone===t?'is-on':''}`} onClick={() => setCaptionTone(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .tw {
          position: fixed; bottom: 20px; inset-inline-start: 20px;
          width: 280px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 18px;
          box-shadow: var(--shadow-lg);
          z-index: 1000;
          display: flex; flex-direction: column; gap: 16px;
        }
        .tw-head { display: flex; justify-content: space-between; align-items: center; }
        .tw-title { font-size: 14px; font-weight: 700; color: var(--ink-950); letter-spacing: -0.01em; }
        .tw-sub { font-size: 11px; color: var(--ink-500); margin-top: 2px; }
        .tw-live { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; color: var(--purple-700); font-weight: 600; background: var(--purple-50); padding: 3px 8px; border-radius: 99px; }
        .tw-live span { width: 6px; height: 6px; border-radius: 50%; background: var(--purple-500); box-shadow: 0 0 0 3px rgba(124,92,239,.2); animation: tw-pulse 1.8s ease-in-out infinite; }
        @keyframes tw-pulse { 50% { opacity: 0.5; } }

        .tw-row label { display: block; font-size: 11px; font-weight: 600; color: var(--ink-700); margin-bottom: 8px; }
        .tw-hue { font-size: 10px; color: var(--ink-400); font-weight: 500; margin-inline-start: 6px; }

        .tw-seg { display: flex; background: var(--ink-100); border-radius: 9px; padding: 3px; }
        .tw-seg button { flex: 1; padding: 6px; font-size: 11.5px; font-weight: 500; border-radius: 6px; color: var(--ink-600); }
        .tw-seg button.is-on { background: var(--surface); color: var(--ink-900); box-shadow: var(--shadow-sm); font-weight: 600; }

        .tw-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 8px; border-radius: 99px; outline: none; cursor: pointer; }
        .tw-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #fff; border: 2px solid var(--ink-900); cursor: grab; }

        .tw-swatches { display: flex; gap: 6px; margin-top: 10px; }
        .tw-sw { width: 26px; height: 26px; border-radius: 8px; border: 2px solid transparent; transition: border-color 0.12s, transform 0.12s; }
        .tw-sw:hover { transform: scale(1.08); }
        .tw-sw.is-on { border-color: var(--ink-950); }

        .tw-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .tw-chip { padding: 6px 12px; border-radius: 99px; border: 1px solid var(--line); background: transparent; font-size: 11.5px; color: var(--ink-600); font-weight: 500; transition: all 0.12s; }
        .tw-chip:hover { border-color: var(--line-strong); }
        .tw-chip.is-on { background: var(--purple-600); color: #fff; border-color: var(--purple-600); }
      `}</style>
    </div>
  );
};

window.OptionCApp = OptionCApp;
