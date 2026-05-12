// OPTION A — Refined Grid
// Keeps the familiar weekly grid but fixes hierarchy:
// — one dominant element per card (topic line)
// — visual thumbnail replaces redundant labels
// — primary action is the caption generator, elevated
// — metadata is quiet, monospace numerics

const OptionA = () => {
  return (
    <div dir="rtl" className="opt-a">
      <Sidebar active="content-plan" />

      <main className="a-main">
        {/* Header */}
        <header className="a-head">
          <div className="a-head-top">
            <div>
              <div className="a-eyebrow">خطة المحتوى · أسبوع 18</div>
              <h1 className="a-title">أسبوعك القادم</h1>
              <p className="a-sub">٧ منشورات مقترحة بالذكاء الاصطناعي — معدّلة حسب جمهورك وأهدافك</p>
            </div>
            <div className="a-head-actions">
              <button className="a-range">
                <Icon path={I.chevR} size={14}/>
                <span>٢٦ أبريل — ٢ مايو</span>
                <Icon path={I.chevL} size={14}/>
              </button>
              <button className="a-regen">
                <Icon path={I.spark} size={15}/>
                <span>إعادة توليد الخطة</span>
              </button>
            </div>
          </div>

          {/* Progress strip */}
          <div className="a-progress">
            <div className="a-prog-item">
              <div className="a-prog-num num">7</div>
              <div className="a-prog-lbl">منشور</div>
            </div>
            <div className="a-prog-sep" />
            <div className="a-prog-item">
              <div className="a-prog-num num">0/7</div>
              <div className="a-prog-lbl">تسميات جاهزة</div>
            </div>
            <div className="a-prog-sep" />
            <div className="a-prog-item">
              <div className="a-prog-num num">٣.٦</div>
              <div className="a-prog-lbl">معدل تفاعل متوقع</div>
            </div>
            <div className="a-prog-sep" />
            <div className="a-prog-item" style={{marginInlineStart: 'auto'}}>
              <div className="a-type-legend">
                <LegendDot type="video"/>
                <LegendDot type="image"/>
                <LegendDot type="carousel"/>
              </div>
            </div>
          </div>
        </header>

        {/* Cards */}
        <div className="a-grid">
          {WEEK_DATA.map((d, i) => <CardA key={i} d={d} />)}
        </div>
      </main>

      <style>{`
        .opt-a { display: flex; min-height: 100vh; background: var(--canvas); }
        .a-main { flex: 1; padding: 32px 40px 56px; max-width: 1200px; }

        .a-head-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 24px; }
        .a-eyebrow { font-size: 12px; color: var(--purple-600); font-weight: 600; letter-spacing: 0.01em; margin-bottom: 8px; }
        .a-title { font-size: 32px; font-weight: 700; letter-spacing: -0.02em; color: var(--ink-950); margin: 0 0 6px; line-height: 1.15; }
        .a-sub { font-size: 14px; color: var(--ink-500); margin: 0; max-width: 520px; line-height: 1.55; }

        .a-head-actions { display: flex; gap: 10px; align-items: center; }
        .a-range {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 14px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 10px;
          font-size: 13px; font-weight: 500; color: var(--ink-700);
          transition: border-color 0.12s;
        }
        .a-range:hover { border-color: var(--line-strong); }
        .a-regen {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 16px;
          background: var(--purple-600);
          color: #fff;
          border-radius: 10px;
          font-size: 13px; font-weight: 600;
          box-shadow: 0 4px 12px -4px rgba(99, 65, 224, 0.5);
          transition: background 0.12s, transform 0.12s;
        }
        .a-regen:hover { background: var(--purple-700); transform: translateY(-1px); }

        .a-progress {
          display: flex; align-items: center; gap: 22px;
          padding: 14px 20px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 14px;
          margin-bottom: 28px;
        }
        .a-prog-sep { width: 1px; height: 22px; background: var(--line); }
        .a-prog-num { font-size: 18px; font-weight: 700; color: var(--ink-900); letter-spacing: -0.01em; line-height: 1; }
        .a-prog-lbl { font-size: 11px; color: var(--ink-500); margin-top: 3px; }
        .a-type-legend { display: flex; gap: 14px; }

        .a-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
      `}</style>
    </div>
  );
};

const LegendDot = ({ type }) => {
  const m = TYPE_META[type];
  return (
    <span style={{display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-600)'}}>
      <span style={{width: 8, height: 8, borderRadius: 2, background: m.color}} />
      {m.ar}
    </span>
  );
};

const CardA = ({ d }) => {
  return (
    <article className="ca">
      <div className="ca-head">
        <div className="ca-date">
          <div className="ca-day">{d.day}</div>
          <div className="ca-datenum num">{d.date}</div>
        </div>
        <TypePill type={d.type} size="sm" />
      </div>

      <Thumb variant={d.thumb} h={110}>
        {d.tag && (
          <span style={{
            position: 'absolute', top: 10, insetInlineStart: 10,
            padding: '3px 8px', borderRadius: 999,
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
            fontSize: 10, fontWeight: 700, color: 'var(--purple-700)',
            letterSpacing: '0.02em',
          }}>
            {d.tag}
          </span>
        )}
      </Thumb>

      <div className="ca-body">
        <div className="ca-topic">{d.topic}</div>
        <div className="ca-meta">
          <span className="ca-time num">
            <Icon path={I.clock} size={12} />
            {d.time}
          </span>
          <span className="ca-eng num">
            <Icon path={I.trend} size={12} />
            {d.engagement}٪ تفاعل
          </span>
        </div>
      </div>

      <button className="ca-cta">
        <Icon path={I.wand} size={13} />
        <span>إنشاء التسمية</span>
      </button>

      <style>{`
        .ca {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: border-color 0.12s, transform 0.12s, box-shadow 0.15s;
        }
        .ca:hover {
          border-color: var(--purple-200);
          box-shadow: var(--shadow);
          transform: translateY(-2px);
        }
        .ca-head { display: flex; align-items: flex-start; justify-content: space-between; }
        .ca-day { font-size: 12px; color: var(--ink-500); font-weight: 500; }
        .ca-datenum { font-size: 15px; font-weight: 700; color: var(--ink-900); letter-spacing: -0.01em; margin-top: 2px; }
        .ca-body { display: flex; flex-direction: column; gap: 8px; }
        .ca-topic {
          font-size: 14.5px;
          font-weight: 600;
          color: var(--ink-900);
          line-height: 1.45;
          letter-spacing: -0.005em;
          text-wrap: pretty;
          min-height: 42px;
        }
        .ca-meta { display: flex; gap: 14px; font-size: 11.5px; color: var(--ink-500); font-weight: 500; }
        .ca-time, .ca-eng { display: inline-flex; align-items: center; gap: 5px; }
        .ca-cta {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 10px;
          background: var(--purple-50);
          color: var(--purple-700);
          border-radius: 10px;
          font-size: 13px; font-weight: 600;
          transition: background 0.12s;
        }
        .ca-cta:hover { background: var(--purple-100); }
      `}</style>
    </article>
  );
};

window.OptionA = OptionA;
