// OPTION B — Weekly Timeline View
// Horizontal 7-day strip with content laid out by time of day
// Visual: time column on the right (RTL), days as columns, posts as blocks
// Hierarchy: scannable at a glance, time is primary axis

const OptionB = () => {
  // Hours 8am → 8pm
  const HOURS = [9, 11, 13, 15, 17, 19];

  return (
    <div dir="rtl" className="opt-b">
      <Sidebar active="content-plan" />

      <main className="b-main">
        <header className="b-head">
          <div>
            <div className="b-crumb">خطة المحتوى</div>
            <h1 className="b-title">أسبوع ٢٦ أبريل — ٢ مايو</h1>
          </div>
          <div className="b-head-actions">
            <div className="b-seg">
              <button>شهر</button>
              <button className="is-on">أسبوع</button>
              <button>يوم</button>
            </div>
            <button className="b-ghost">
              <Icon path={I.chevR} size={14}/>
            </button>
            <button className="b-today">اليوم</button>
            <button className="b-ghost">
              <Icon path={I.chevL} size={14}/>
            </button>
            <div className="b-divider"/>
            <button className="b-primary">
              <Icon path={I.spark} size={14}/>
              <span>إعادة توليد</span>
            </button>
          </div>
        </header>

        {/* Summary row */}
        <div className="b-summary">
          <div className="b-sum-item">
            <div className="b-sum-label">المنشورات</div>
            <div className="b-sum-val num">7</div>
          </div>
          <div className="b-sum-item">
            <div className="b-sum-label">فيديو</div>
            <div className="b-sum-val num" style={{color: 'var(--video)'}}>3</div>
          </div>
          <div className="b-sum-item">
            <div className="b-sum-label">صورة</div>
            <div className="b-sum-val num" style={{color: 'var(--image)'}}>2</div>
          </div>
          <div className="b-sum-item">
            <div className="b-sum-label">كاروسيل</div>
            <div className="b-sum-val num" style={{color: 'var(--carousel)'}}>2</div>
          </div>
          <div className="b-sum-item b-sum-grow">
            <div className="b-sum-label">معدل تفاعل متوقع للأسبوع</div>
            <div className="b-sum-meter">
              <div className="b-sum-meter-fill" style={{width: '72%'}} />
              <span className="num">٣.٦٪</span>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="b-grid">
          {/* Day headers */}
          <div className="b-corner" />
          {WEEK_DATA.map((d, i) => (
            <div key={i} className={`b-day-head ${d.dateNum === 29 ? 'is-today' : ''}`}>
              <div className="b-day-name">{d.day}</div>
              <div className="b-day-num num">{d.date}</div>
            </div>
          ))}

          {/* Rows */}
          {HOURS.map((h, ri) => (
            <React.Fragment key={h}>
              <div className="b-hour num">{String(h).padStart(2,'0')}:00</div>
              {WEEK_DATA.map((d, ci) => {
                const postHour = parseInt(d.time.split(':')[0], 10);
                const showHere = postHour === h || (postHour > h && postHour < h + 2 && ri === HOURS.findIndex(hr => hr <= postHour && hr + 2 > postHour));
                return (
                  <div key={ci} className="b-cell">
                    {postHour === h && <TimelinePost d={d} />}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        <div className="b-hint">
          <Icon path={I.spark} size={13}/>
          <span>اسحب المنشورات لإعادة الجدولة — أو اضغط فارغًا لإضافة منشور جديد</span>
        </div>
      </main>

      <style>{`
        .opt-b { display: flex; min-height: 100vh; background: var(--canvas); }
        .b-main { flex: 1; padding: 28px 36px 40px; max-width: 1280px; }

        .b-head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 22px; }
        .b-crumb { font-size: 12px; color: var(--ink-500); margin-bottom: 4px; font-weight: 500; }
        .b-title { font-size: 26px; font-weight: 700; color: var(--ink-950); letter-spacing: -0.02em; margin: 0; }

        .b-head-actions { display: flex; align-items: center; gap: 8px; }
        .b-seg { display: flex; background: var(--ink-100); border-radius: 10px; padding: 3px; }
        .b-seg button { padding: 6px 14px; font-size: 12.5px; font-weight: 500; border-radius: 7px; color: var(--ink-600); }
        .b-seg button.is-on { background: var(--surface); color: var(--ink-900); box-shadow: var(--shadow-sm); }
        .b-ghost { width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; color: var(--ink-600); background: var(--surface); border: 1px solid var(--line); }
        .b-ghost:hover { background: var(--ink-100); }
        .b-today { padding: 7px 14px; font-size: 12.5px; font-weight: 500; background: var(--surface); border: 1px solid var(--line); border-radius: 9px; color: var(--ink-800); }
        .b-divider { width: 1px; height: 22px; background: var(--line); margin: 0 4px; }
        .b-primary { display: flex; align-items: center; gap: 7px; padding: 8px 16px; background: var(--purple-600); color: #fff; border-radius: 9px; font-size: 13px; font-weight: 600; }
        .b-primary:hover { background: var(--purple-700); }

        .b-summary {
          display: flex;
          gap: 32px;
          padding: 16px 24px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 14px;
          margin-bottom: 20px;
          align-items: center;
        }
        .b-sum-label { font-size: 11px; color: var(--ink-500); margin-bottom: 4px; font-weight: 500; }
        .b-sum-val { font-size: 22px; font-weight: 700; color: var(--ink-900); letter-spacing: -0.01em; line-height: 1; }
        .b-sum-grow { flex: 1; min-width: 200px; }
        .b-sum-meter { display: flex; align-items: center; gap: 10px; }
        .b-sum-meter { position: relative; height: 8px; background: var(--ink-150); border-radius: 99px; }
        .b-sum-meter-fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, var(--purple-500), var(--purple-400)); border-radius: 99px; }
        .b-sum-meter span { position: absolute; inset-inline-end: 0; top: -22px; font-size: 12px; font-weight: 700; color: var(--purple-700); }

        .b-grid {
          display: grid;
          grid-template-columns: 60px repeat(7, 1fr);
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 16px;
          overflow: hidden;
        }
        .b-corner { background: var(--ink-50); border-bottom: 1px solid var(--line); }
        .b-day-head {
          padding: 14px 10px;
          text-align: center;
          border-bottom: 1px solid var(--line);
          border-inline-start: 1px solid var(--line);
          background: var(--ink-50);
        }
        .b-day-head.is-today { background: var(--purple-50); }
        .b-day-head.is-today .b-day-num { color: var(--purple-700); }
        .b-day-name { font-size: 11px; color: var(--ink-500); font-weight: 500; }
        .b-day-num { font-size: 14px; font-weight: 700; color: var(--ink-900); margin-top: 3px; letter-spacing: -0.01em; }

        .b-hour {
          padding: 14px 8px;
          text-align: center;
          font-size: 11px;
          color: var(--ink-400);
          border-bottom: 1px solid var(--line);
          background: var(--ink-50);
          font-weight: 500;
        }
        .b-cell {
          min-height: 80px;
          border-inline-start: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          padding: 6px;
          position: relative;
          background: repeating-linear-gradient(45deg, transparent 0 14px, rgba(0,0,0,0.01) 14px 15px);
          transition: background 0.12s;
        }
        .b-cell:hover { background: var(--purple-50); cursor: pointer; }

        .b-grid > *:nth-last-child(-n+8) { border-bottom: none; }

        .b-hint {
          margin-top: 14px;
          display: flex; align-items: center; gap: 8px;
          font-size: 12px; color: var(--ink-500);
          padding: 0 4px;
        }
      `}</style>
    </div>
  );
};

const TimelinePost = ({ d }) => {
  const m = TYPE_META[d.type];
  return (
    <div className="b-post" style={{
      background: m.tone,
      borderInlineEnd: `3px solid ${m.color}`,
    }}>
      <div className="b-post-meta">
        <span style={{color: m.color, display: 'inline-flex', alignItems: 'center'}}>
          <TypeIcon type={d.type} size={11} />
        </span>
        <span className="num b-post-time">{d.time}</span>
      </div>
      <div className="b-post-topic">{d.topic}</div>
      {d.tag && <div className="b-post-tag">مقترح</div>}
      <style>{`
        .b-post {
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 11.5px;
          cursor: grab;
          position: relative;
          height: 100%;
          transition: transform 0.12s;
        }
        .b-post:hover { transform: translateY(-1px); }
        .b-post-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        .b-post-time { font-size: 10.5px; color: var(--ink-600); font-weight: 600; }
        .b-post-topic {
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-900);
          line-height: 1.35;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .b-post-tag { position: absolute; top: 6px; inset-inline-start: 6px; font-size: 9px; color: var(--purple-700); font-weight: 700; background: rgba(255,255,255,.85); padding: 2px 6px; border-radius: 99px; }
      `}</style>
    </div>
  );
};

window.OptionB = OptionB;
