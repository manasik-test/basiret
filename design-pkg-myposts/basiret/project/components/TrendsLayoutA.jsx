// Trends — Layout A: Editorial briefing
// Hero "أهم ما يحدث" + summary chips + 2-col (rising feed + cultural calendar/macro)

const TRA_PhaseDot = ({ phase }) => {
  const p = PHASE[phase];
  return <span className="tra-phase" style={{ background: p.bg, color: p.fg }}>
    <i style={{ background: p.dot }} />{p.ar}
  </span>;
};

const TRA_Spark = ({ data, color = '#7c5cef', height = 40, width = 110 }) => {
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * (height - 4) - 2}`).join(' ');
  const area = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`tra-g-${color}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#tra-g-${color})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => i === data.length - 1 && (
        <circle key={i} cx={(i / (data.length - 1)) * width} cy={height - (v / max) * (height - 4) - 2} r="3" fill={color} stroke="#fff" strokeWidth="1.5" />
      ))}
    </svg>
  );
};

const TRA_HeroTrend = () => {
  const t = TRENDS.find(x => x.id === 't3'); // top momentum
  const phaseInfo = PHASE[t.phase];
  return (
    <section className="tra-hero">
      <div className="tra-hero-l">
        <div className="tra-hero-k">
          <span className="tra-hero-spark-icon">✦</span>
          أعلى زخم في {TRENDS_USER.industry} اليوم
        </div>
        <h2>{t.title}</h2>
        <p className="tra-hero-sub">{t.sub}</p>
        <p className="tra-hero-why">{t.why}</p>
        <div className="tra-hero-acts">
          <button className="tra-btn primary">✦ اقترح ٣ منشورات حول الفكرة</button>
          <button className="tra-btn ghost">أضف إلى خطة المحتوى ↩</button>
        </div>
      </div>
      <div className="tra-hero-r">
        <div className="tra-hero-stat">
          <span className="tra-hero-stat-k">الزخم خلال ٧ أيام</span>
          <div className="tra-hero-stat-row">
            <span className="tra-hero-stat-v num">{t.momentum}</span>
            <TRA_Spark data={t.spark} color={CATEGORY[t.cat].color} width={120} height={44} />
          </div>
        </div>
        <div className="tra-hero-meta">
          <div><span className="tra-hero-meta-k">المرحلة</span><TRA_PhaseDot phase={t.phase} /></div>
          <div><span className="tra-hero-meta-k">نافذة الفعل</span><span className="tra-hero-meta-v">{t.timeToAct}</span></div>
          <div><span className="tra-hero-meta-k">حسابات تستخدمه</span><span className="tra-hero-meta-v num">{t.examples}</span></div>
        </div>
      </div>
    </section>
  );
};

const TRA_SummaryChips = () => {
  const counts = {
    rising:  TRENDS.filter(t => t.phase === 'rising').length,
    peaking: TRENDS.filter(t => t.phase === 'peaking').length,
    fading:  TRENDS.filter(t => t.phase === 'fading').length,
    moments: CULTURAL_CALENDAR.filter(c => c.daysAway <= 30).length,
  };
  return (
    <div className="tra-chips">
      <div className="tra-chip">
        <div className="tra-chip-v num" style={{ color: PHASE.rising.fg }}>{counts.rising}</div>
        <div className="tra-chip-l">اتجاه صاعد</div>
      </div>
      <div className="tra-chip">
        <div className="tra-chip-v num" style={{ color: PHASE.peaking.fg }}>{counts.peaking}</div>
        <div className="tra-chip-l">في ذروته</div>
      </div>
      <div className="tra-chip">
        <div className="tra-chip-v num" style={{ color: PHASE.fading.fg }}>{counts.fading}</div>
        <div className="tra-chip-l">متراجع</div>
      </div>
      <div className="tra-chip">
        <div className="tra-chip-v num" style={{ color: CATEGORY.cultural.color }}>{counts.moments}</div>
        <div className="tra-chip-l">موسم خلال ٣٠ يوم</div>
      </div>
    </div>
  );
};

const TRA_TrendCard = ({ t }) => {
  const cat = CATEGORY[t.cat];
  return (
    <article className="tra-card" style={{ '--accent': cat.color, '--accent-tint': cat.tint }}>
      <header className="tra-card-h">
        <div className="tra-card-h-l">
          <span className="tra-cat-dot" style={{ background: cat.color }} />
          <span className="tra-cat-l">{cat.ar}</span>
          <span className="tra-card-tag">{t.tag}</span>
          <TRA_PhaseDot phase={t.phase} />
        </div>
        <button className="tra-card-more" aria-label="more">⋯</button>
      </header>
      <h3 className="tra-card-t">{t.title}</h3>
      <p className="tra-card-s">{t.sub}</p>

      <div className="tra-card-stats">
        <div>
          <span className="tra-stat-k">الزخم</span>
          <span className="tra-stat-v num" style={{ color: t.phase === 'fading' ? PHASE.fading.fg : PHASE.rising.fg }}>{t.momentum}</span>
        </div>
        <div>
          <span className="tra-stat-k">الحجم</span>
          <span className="tra-stat-v num">{t.volume.toLocaleString('ar-SA')}</span>
        </div>
        <div>
          <span className="tra-stat-k">منذ</span>
          <span className="tra-stat-v num">{t.daysIn} يوم</span>
        </div>
      </div>

      <p className="tra-card-why">{t.why}</p>

      {t.angles.length > 0 && (
        <div className="tra-card-angles">
          <div className="tra-card-angles-h">زوايا مقترحة لك</div>
          <ul>
            {t.angles.map((a, i) => (
              <li key={i}><span className="tra-bul">✦</span>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <footer className="tra-card-f">
        <div className="tra-card-time">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span>نافذة الفعل: <strong>{t.timeToAct}</strong></span>
        </div>
        <div className="tra-card-acts">
          <button className="tra-btn ghost-sm">عرض أمثلة</button>
          <button className="tra-btn primary-sm">✦ إنشاء منشور</button>
        </div>
      </footer>
    </article>
  );
};

const TRA_CalendarStrip = () => (
  <section className="tra-cal">
    <header className="tra-cal-h">
      <h3>روزنامة المواسم</h3>
      <p>لحظات قادمة تستحق التخطيط — مرتّبة حسب القرب</p>
    </header>
    <ol className="tra-cal-list">
      {CULTURAL_CALENDAR.map((c, i) => {
        const big = c.weight === 'huge';
        const med = c.weight === 'med';
        return (
          <li key={i} className={`tra-cal-i ${big ? 'is-big' : med ? 'is-med' : ''}`}>
            <div className="tra-cal-rail">
              <span className="tra-cal-mark" />
              {i < CULTURAL_CALENDAR.length - 1 && <span className="tra-cal-line" />}
            </div>
            <div className="tra-cal-body">
              <div className="tra-cal-d">{c.date}</div>
              <div className="tra-cal-t">{c.label}</div>
              {big && <div className="tra-cal-tag">موسم كبير — ابدأ الإعداد</div>}
              {med && <div className="tra-cal-tag tra-cal-tag--med">يستحق التخطيط</div>}
            </div>
          </li>
        );
      })}
    </ol>
  </section>
);

const TRA_MacroSignals = () => {
  const macros = TRENDS.filter(t => t.cat === 'macro');
  return (
    <section className="tra-macro">
      <header className="tra-macro-h">
        <h3>إشارات السوق</h3>
        <p>تنظيم وأسعار وأبحاث تؤثر على محتواك</p>
      </header>
      <ul className="tra-macro-list">
        {macros.map(m => (
          <li key={m.id} className="tra-macro-i">
            <div className="tra-macro-row">
              <span className="tra-macro-tag" style={{ background: CATEGORY.macro.tint, color: CATEGORY.macro.color }}>{m.tag}</span>
              <span className="tra-macro-mom num" style={{ color: PHASE.rising.fg }}>{m.momentum}</span>
            </div>
            <div className="tra-macro-t">{m.title}</div>
            <p className="tra-macro-s">{m.sub}</p>
            <p className="tra-macro-w">{m.why}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};

const TrendsLayoutA = () => {
  const rising = TRENDS.filter(t => t.cat === 'topic' || t.cat === 'cultural');
  return (
    <div className="tra" dir="rtl">
      <header className="tra-head">
        <div>
          <div className="tra-eyebrow">
            <span className="tra-loc-dot" />
            تركّز على <strong>{TRENDS_USER.industry}</strong> في <strong>{TRENDS_USER.city}</strong>
            <button className="tra-loc-edit">تعديل ✎</button>
          </div>
          <h1>الاتجاهات</h1>
          <p>ما يتحرّك في صناعتك ومدينتك — فرص قبل أن تُستهلك</p>
        </div>
        <div className="tra-head-r">
          <div className="tra-seg">
            <button>اليوم</button>
            <button className="is-on">٧ أيام</button>
            <button>٣٠ يوم</button>
          </div>
          <button className="tra-add">✦ توليد خطة من الاتجاهات</button>
        </div>
      </header>

      <TRA_HeroTrend />

      <div className="tra-grid">
        <div className="tra-col-main">
          <header className="tra-sec-h">
            <h2>اتجاهات يجب أن تنظر إليها</h2>
            <div className="tra-sort">
              <span>ترتيب حسب</span>
              <button className="is-on">الزخم ↓</button>
              <button>الحجم</button>
              <button>القرب</button>
            </div>
          </header>
          <div className="tra-stack">
            {rising.map(t => <TRA_TrendCard key={t.id} t={t} />)}
          </div>
        </div>
        <aside className="tra-col-side">
          <TRA_CalendarStrip />
          <TRA_MacroSignals />
        </aside>
      </div>

      <style>{`
        .tra { padding: 24px 28px 60px; background: var(--canvas); color: var(--ink-900); font-family: 'IBM Plex Sans Arabic', 'Inter', system-ui, sans-serif; min-height: 100%; }
        .tra .num { font-family: 'Inter', system-ui, sans-serif; font-feature-settings: 'tnum'; }

        /* Header */
        .tra-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 18px; }
        .tra-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-600); margin-bottom: 8px; padding: 5px 11px; background: var(--surface); border: 1px solid var(--line); border-radius: 99px; }
        .tra-eyebrow strong { color: var(--ink-900); font-weight: 600; }
        .tra-loc-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--purple-500); box-shadow: 0 0 0 3px rgba(124,92,239,0.18); }
        .tra-loc-edit { font-size: 11px; color: var(--purple-700); padding: 0 0 0 4px; border-inline-start: 1px solid var(--line); margin-inline-start: 6px; }
        .tra h1 { font-size: 28px; font-weight: 700; color: var(--ink-950); margin: 0 0 4px; letter-spacing: -0.02em; }
        .tra-head > div > p { font-size: 13.5px; color: var(--ink-500); margin: 0; }
        .tra-head-r { display: flex; gap: 10px; align-items: center; }
        .tra-seg { display: flex; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 3px; }
        .tra-seg button { padding: 6px 12px; font-size: 12.5px; color: var(--ink-600); border-radius: 7px; font-weight: 500; }
        .tra-seg button.is-on { background: var(--ink-900); color: #fff; font-weight: 600; }
        .tra-add { padding: 9px 14px; background: var(--purple-600); color: #fff; border-radius: 10px; font-size: 12.5px; font-weight: 600; }
        .tra-add:hover { background: var(--purple-700); }

        /* Hero */
        .tra-hero { display: grid; grid-template-columns: 1.5fr 1fr; gap: 22px; background: linear-gradient(135deg, var(--purple-50), oklch(0.97 0.03 280)); border: 1px solid var(--purple-200); border-radius: 18px; padding: 22px 24px; margin-bottom: 22px; }
        .tra-hero-k { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--purple-700); letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 8px; }
        .tra-hero-spark-icon { color: var(--purple-500); font-size: 13px; }
        .tra-hero h2 { font-size: 22px; font-weight: 700; color: var(--ink-950); margin: 0 0 6px; letter-spacing: -0.015em; line-height: 1.35; text-wrap: balance; }
        .tra-hero-sub { font-size: 13px; color: var(--ink-600); margin: 0 0 12px; font-weight: 500; }
        .tra-hero-why { font-size: 13px; color: var(--ink-700); line-height: 1.7; margin: 0 0 14px; max-width: 560px; }
        .tra-hero-acts { display: flex; gap: 8px; }
        .tra-btn { padding: 8px 14px; border-radius: 9px; font-size: 12.5px; font-weight: 600; transition: all .15s; }
        .tra-btn.primary { background: var(--purple-600); color: #fff; }
        .tra-btn.primary:hover { background: var(--purple-700); }
        .tra-btn.ghost { background: transparent; color: var(--purple-800); }
        .tra-btn.ghost:hover { background: rgba(124,92,239,0.08); }
        .tra-btn.primary-sm { padding: 6px 11px; border-radius: 7px; font-size: 11.5px; background: var(--purple-600); color: #fff; }
        .tra-btn.ghost-sm { padding: 6px 11px; border-radius: 7px; font-size: 11.5px; color: var(--ink-700); background: var(--ink-100); }
        .tra-btn.ghost-sm:hover { background: var(--ink-150); }

        .tra-hero-r { display: flex; flex-direction: column; gap: 10px; }
        .tra-hero-stat { background: var(--surface); border-radius: 12px; padding: 12px 14px; }
        .tra-hero-stat-k { font-size: 11px; color: var(--ink-500); font-weight: 500; }
        .tra-hero-stat-row { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
        .tra-hero-stat-v { font-size: 22px; font-weight: 700; color: var(--purple-700); letter-spacing: -0.015em; }
        .tra-hero-meta { background: var(--surface); border-radius: 12px; padding: 10px 14px; display: flex; flex-direction: column; gap: 6px; }
        .tra-hero-meta > div { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
        .tra-hero-meta-k { color: var(--ink-500); }
        .tra-hero-meta-v { color: var(--ink-900); font-weight: 600; }

        /* Phase pill */
        .tra-phase { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 99px; font-size: 11px; font-weight: 600; }
        .tra-phase i { width: 5px; height: 5px; border-radius: 50%; }

        /* Summary chips */
        .tra-chips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }
        .tra-chip { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
        .tra-chip-v { font-size: 22px; font-weight: 700; letter-spacing: -0.015em; line-height: 1; }
        .tra-chip-l { font-size: 11.5px; color: var(--ink-500); margin-top: 4px; font-weight: 500; }

        /* Grid layout */
        .tra-grid { display: grid; grid-template-columns: 1.7fr 1fr; gap: 18px; align-items: start; }
        .tra-col-main { display: flex; flex-direction: column; gap: 14px; }
        .tra-col-side { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 16px; }
        .tra-sec-h { display: flex; justify-content: space-between; align-items: center; padding: 0 4px; }
        .tra-sec-h h2 { font-size: 16px; font-weight: 700; color: var(--ink-900); letter-spacing: -0.01em; margin: 0; }
        .tra-sort { display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--ink-500); }
        .tra-sort button { padding: 4px 9px; border-radius: 6px; color: var(--ink-600); font-weight: 500; }
        .tra-sort button.is-on { background: var(--ink-100); color: var(--ink-900); font-weight: 600; }
        .tra-stack { display: flex; flex-direction: column; gap: 10px; }

        /* Trend card */
        .tra-card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; position: relative; transition: border-color .15s, box-shadow .15s; }
        .tra-card::before { content:''; position: absolute; top: 14px; bottom: 14px; inset-inline-start: 0; width: 3px; border-radius: 0 3px 3px 0; background: var(--accent); opacity: .85; }
        .tra-card:hover { border-color: var(--line-strong); box-shadow: 0 1px 0 rgba(28,26,40,0.04); }
        .tra-card-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .tra-card-h-l { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .tra-cat-dot { width: 6px; height: 6px; border-radius: 50%; }
        .tra-cat-l { font-size: 11px; color: var(--ink-500); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .tra-card-tag { font-size: 10.5px; font-weight: 600; padding: 2px 8px; border-radius: 99px; background: var(--accent-tint); color: var(--accent); }
        .tra-card-more { padding: 4px 6px; border-radius: 6px; color: var(--ink-400); font-size: 16px; line-height: 1; }
        .tra-card-more:hover { background: var(--ink-100); color: var(--ink-700); }
        .tra-card-t { font-size: 17px; font-weight: 700; color: var(--ink-950); margin: 0 0 3px; letter-spacing: -0.012em; line-height: 1.35; text-wrap: balance; }
        .tra-card-s { font-size: 12.5px; color: var(--ink-500); margin: 0 0 12px; }

        .tra-card-stats { display: grid; grid-template-columns: repeat(3, max-content); gap: 28px; align-items: center; padding: 10px 14px; background: var(--ink-50); border-radius: 10px; margin-bottom: 12px; }
        .tra-stat-k { font-size: 10.5px; color: var(--ink-500); font-weight: 500; display: block; margin-bottom: 2px; }
        .tra-stat-v { font-size: 14px; font-weight: 700; color: var(--ink-950); letter-spacing: -0.005em; }
        .tra-card-spark { justify-self: end; }

        .tra-card-why { font-size: 12.5px; color: var(--ink-700); line-height: 1.65; margin: 0 0 12px; }

        .tra-card-angles { background: var(--purple-50); border: 1px solid var(--purple-200); border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; }
        .tra-card-angles-h { font-size: 11px; font-weight: 700; color: var(--purple-700); margin-bottom: 6px; letter-spacing: 0.03em; text-transform: uppercase; }
        .tra-card-angles ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
        .tra-card-angles li { font-size: 12.5px; color: var(--ink-800); display: flex; align-items: flex-start; gap: 7px; line-height: 1.55; }
        .tra-bul { color: var(--purple-500); font-weight: 700; flex-shrink: 0; margin-top: 1px; }

        .tra-card-f { display: flex; justify-content: space-between; align-items: center; padding-top: 4px; }
        .tra-card-time { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--ink-500); }
        .tra-card-time strong { color: var(--ink-800); font-weight: 600; }
        .tra-card-acts { display: flex; gap: 6px; }

        /* Calendar strip */
        .tra-cal, .tra-macro { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; }
        .tra-cal-h h3, .tra-macro-h h3, .tra-sec-h h2 { font-size: 15px; font-weight: 700; color: var(--ink-900); margin: 0; letter-spacing: -0.005em; }
        .tra-cal-h p, .tra-macro-h p { font-size: 12px; color: var(--ink-500); margin: 3px 0 14px; }
        .tra-cal-list { list-style: none; margin: 0; padding: 0; }
        .tra-cal-i { display: flex; gap: 12px; padding-bottom: 12px; }
        .tra-cal-rail { width: 14px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; padding-top: 4px; }
        .tra-cal-mark { width: 9px; height: 9px; border-radius: 50%; background: var(--ink-200); border: 2px solid var(--surface); box-shadow: 0 0 0 1px var(--ink-300); }
        .tra-cal-i.is-med .tra-cal-mark { background: ${CATEGORY.cultural.color}; box-shadow: 0 0 0 1px ${CATEGORY.cultural.color}; }
        .tra-cal-i.is-big .tra-cal-mark { background: ${CATEGORY.cultural.color}; box-shadow: 0 0 0 1px ${CATEGORY.cultural.color}, 0 0 0 5px ${CATEGORY.cultural.tint}; width: 11px; height: 11px; }
        .tra-cal-line { flex: 1; width: 1.5px; background: var(--ink-200); margin-top: 4px; }
        .tra-cal-d { font-size: 11px; color: var(--ink-500); font-weight: 500; }
        .tra-cal-t { font-size: 13.5px; font-weight: 600; color: var(--ink-900); margin: 1px 0 3px; }
        .tra-cal-tag { font-size: 10.5px; font-weight: 600; padding: 2px 7px; border-radius: 99px; background: ${CATEGORY.cultural.tint}; color: ${CATEGORY.cultural.color}; display: inline-block; }
        .tra-cal-tag--med { background: var(--ink-100); color: var(--ink-700); }

        /* Macro signals */
        .tra-macro-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .tra-macro-i { padding: 12px; background: var(--ink-50); border-radius: 10px; border: 1px solid transparent; }
        .tra-macro-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .tra-macro-tag { font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
        .tra-macro-mom { font-size: 12.5px; font-weight: 700; }
        .tra-macro-t { font-size: 13.5px; font-weight: 700; color: var(--ink-900); margin-bottom: 2px; line-height: 1.35; }
        .tra-macro-s { font-size: 11.5px; color: var(--ink-500); margin: 0 0 6px; }
        .tra-macro-w { font-size: 11.5px; color: var(--ink-700); margin: 0; line-height: 1.6; }
      `}</style>
    </div>
  );
};

Object.assign(window, { TrendsLayoutA });
