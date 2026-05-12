// Home (الرئيسية) Dashboard — Basiret
// Same style language as My Posts G (cockpit + floating Ask Basiret)

const PRI_META = {
  urgent: { label: 'عاجل', bg: 'oklch(0.96 0.05 30)', fg: 'oklch(0.5 0.17 30)' },
  today: { label: 'اليوم', bg: 'oklch(0.96 0.06 280)', fg: 'var(--purple-700)' },
  week: { label: 'هذا الأسبوع', bg: 'var(--ink-100)', fg: 'var(--ink-700)' }
};

const ACTION_META = {
  sentiment: { label: 'المشاعر', icon: <path d="M12 21s-7-4.5-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.5-7 10-7 10z" />, bg: 'oklch(0.96 0.05 30)', fg: 'oklch(0.5 0.17 30)' },
  consistency: { label: 'الانتظام', icon: I.clock, bg: 'oklch(0.96 0.06 60)', fg: 'oklch(0.5 0.13 60)' },
  schedule: { label: 'وقت ذهبي', icon: <path d="M13 2 4 14h7v8l9-12h-7z" />, bg: 'oklch(0.96 0.06 280)', fg: 'var(--purple-700)' },
  competitor: { label: 'المنافسون', icon: <><circle cx="9" cy="9" r="3" /><path d="M3 21a6 6 0 0 1 12 0" /><circle cx="17" cy="8" r="2.5" /><path d="M14.5 21a4 4 0 0 1 7.5-2" /></>, bg: 'oklch(0.95 0.05 200)', fg: 'oklch(0.5 0.13 200)' },
  audience: { label: 'الجمهور', icon: I.wand, bg: 'oklch(0.95 0.06 285)', fg: 'var(--purple-700)' },
  plan: { label: 'خطة المحتوى', icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>, bg: 'var(--ink-100)', fg: 'var(--ink-700)' }
};

const HomeApp = () => {
  return (
    <div dir="rtl" className="hm">
      <Sidebar active="home" />
      <main className="hm-main">

        {/* Header */}
        <header className="hm-head">
          <div>
            <div className="hm-crumb"></div>
            <h1>مرحباً Tasyeer <span className="hm-wave">👋</span></h1>
            <p>إليك نظرة شاملة على أداء حسابك — ٣ نقاط تستحق انتباهك اليوم.</p>
          </div>
          <div className="hm-head-r">
            <div className="hm-seg">
              <button>٧ أيام</button>
              <button className="is-on">٣٠ يوم</button>
              <button>٩٠ يوم</button>
            </div>
          </div>
        </header>

        {/* KPI strip */}
        <section className="hm-kpi">
          <div className="hm-kpi-card hm-kpi--hero">
            <div className="hm-kpi-k">صحة نموك</div>
            <div className="hm-kpi-ring">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="10" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="#fff" strokeWidth="10" strokeDasharray="314" strokeDashoffset="110" strokeLinecap="round" transform="rotate(-90 60 60)" />
              </svg>
              <div className="hm-kpi-ring-c">
                <span className="num">٦٥</span>
                <em>/١٠٠</em>
              </div>
            </div>
            <div className="hm-kpi-d up">↑ <span className="num">+٨</span> نقاط هذا الشهر</div>
          </div>
          <div className="hm-kpi-card">
            <div className="hm-kpi-k">إجمالي التفاعل</div>
            <div className="hm-kpi-v num">٩.٦٪</div>
            <div className="hm-kpi-d up">↑ <span className="num">+١.٢٪</span></div>
            <div className="hm-kpi-spark">
              {[3, 5, 4, 6, 5, 8, 7, 9, 8, 10, 9, 12].map((h, i) => <div key={i} style={{ height: `${h * 5 + 15}%` }} />)}
            </div>
          </div>
          <div className="hm-kpi-card">
            <div className="hm-kpi-k">وصول</div>
            <div className="hm-kpi-v num">٤٨.٢K</div>
            <div className="hm-kpi-d up">↑ <span className="num">+٨٪</span></div>
            <div className="hm-kpi-spark">
              {[4, 5, 4, 6, 7, 6, 8, 7, 9, 8, 10, 11].map((h, i) => <div key={i} style={{ height: `${h * 5 + 15}%` }} />)}
            </div>
          </div>
          <div className="hm-kpi-card">
            <div className="hm-kpi-k">منشور هذا الشهر</div>
            <div className="hm-kpi-v num">٣٥</div>
            <div className="hm-kpi-d up">↑ <span className="num">+٥</span></div>
            <div className="hm-kpi-spark">
              {[2, 3, 3, 4, 3, 5, 4, 6, 5, 4, 6, 7].map((h, i) => <div key={i} style={{ height: `${h * 6 + 15}%` }} />)}
            </div>
          </div>
        </section>

        {/* AI highlight — Next best action */}
        <section className="hm-nba">
          <div className="hm-nba-l">
            <span className="hm-nba-av">✦</span>
            <div>
              <div className="hm-nba-k">التوصية الأهم اليوم</div>
              <div className="hm-nba-t">
                <strong>استكشف ٣ مواضيع جديدة</strong> — جمهورك أكبر من محتواك. نتوقع نمواً <b className="num">+١٧٪</b> إذا نوّعت شرائح المحتوى هذا الأسبوع.
              </div>
            </div>
          </div>
          <button className="hm-nba-btn">
            ابدأ الآن
            <Icon path={I.chevL} size={12} />
          </button>
        </section>

        {/* Actions for today */}
        <section className="hm-actions">
          <div className="hm-actions-head">
            <div>
              <h3>أعمال اليوم</h3>
              <p>مرتّبة حسب الأولوية — مستخلصة من نشاط حسابك ومنافسيك وجمهورك</p>
            </div>
            <div className="hm-actions-stats">
              <span><b className="num">٢</b> عاجل</span>
              <span><b className="num">٣</b> اليوم</span>
              <span><b className="num">١</b> هذا الأسبوع</span>
            </div>
          </div>

          <div className="hm-actions-list">
            {[
            {
              pri: 'urgent', source: 'sentiment',
              title: '٢ تعليقات سلبية تنتظر الرد منذ ٤ ساعات',
              why: 'منشور التحديث · ردّ الآن قبل أن ينتشر التذمّر',
              cta: 'افتح المشاعر', impact: 'حماية السمعة', time: '٥ د'
            },
            {
              pri: 'urgent', source: 'consistency',
              title: 'لم تنشر منذ ٣ أيام — معدّلك ٤ منشورات أسبوعياً',
              why: 'الانتظام أحد عوامل صحة النمو الأربعة',
              cta: 'إنشاء منشور', impact: 'صحة النمو ↑', time: '١٥ د'
            },
            {
              pri: 'today', source: 'schedule',
              title: 'وقت ذهبي اليوم: الثلاثاء ١٦:٠٠',
              why: '+٢٢٪ احتمال وصول لجمهورك مقارنة بالباقي',
              cta: 'جدولة منشور فيديو', impact: 'وصول +٢٢٪', time: '١٠ د'
            },
            {
              pri: 'today', source: 'competitor',
              title: 'منافس @raid_co نشر "قبل/بعد" — تفاعل ٣x متوسطه',
              why: 'هذا الأسلوب أعطاك أعلى تفاعل أيضاً الأسبوع الماضي',
              cta: 'افتح المنافسين', impact: 'فرصة محتوى', time: '٧ د'
            },
            {
              pri: 'today', source: 'audience',
              title: 'جمهورك أكبر من محتواك بنسبة ١٧٪',
              why: 'استكشف ٣ مواضيع جديدة لتطابق نمو المتابعين',
              cta: 'افتح أسأل بصيرة', impact: 'نمو محتمل', time: '١٠ د'
            },
            {
              pri: 'week', source: 'plan',
              title: 'خطة الأسبوع القادم لم تُعتمد',
              why: '٧ منشورات مقترحة بانتظار مراجعتك',
              cta: 'مراجعة الخطة', impact: 'استمرارية', time: '٢٠ د'
            }].
            map((a, i) => {
              const meta = ACTION_META[a.source];
              const pri = PRI_META[a.pri];
              return (
                <article key={i} className={`hm-act hm-act--${a.pri}`}>
                  <div className="hm-act-pri" style={{ background: pri.bg, color: pri.fg }}>
                    <span className="hm-act-pri-dot" style={{ background: pri.fg }} />
                    {pri.label}
                  </div>
                  <div className="hm-act-body">
                    <div className="hm-act-title">{a.title}</div>
                    <div className="hm-act-why">
                      <span className="hm-act-src">{meta.label}</span>
                      <span className="hm-act-dot">·</span>
                      <span>{a.why}</span>
                    </div>
                  </div>
                  <div className="hm-act-meta">
                    <span className="hm-act-impact">{a.impact}</span>
                    <span className="hm-act-time num">⏱ {a.time}</span>
                  </div>
                  <button className="hm-act-cta">
                    {a.cta}
                    <Icon path={I.chevL} size={11} />
                  </button>
                </article>);

            })}
          </div>
        </section>

        {/* 2-col grid */}
        <div className="hm-grid">
          {/* LEFT col */}
          <div className="hm-col">
            {/* What worked */}
            <section className="hm-card">
              <div className="hm-card-head">
                <div>
                  <h3>ما الذي ينجح</h3>
                  <p>أنماط من تحليل منشوراتك الأخيرة</p>
                </div>
                <button className="hm-link">عرض منشوراتي ↩</button>
              </div>
              <ul className="hm-bullets">
                <li><span className="hm-dot good" /><div>منشورات الفيديو تحصل على أعلى تفاعل</div></li>
                <li><span className="hm-dot warn" /><div>المشاعر محايدة في الغالب — CTA واضح يمكن أن يساعد</div></li>
                <li><span className="hm-dot bad" /><div>لم تنشر هذا الأسبوع منذ ٣ أيام</div></li>
                <li><span className="hm-dot good" /><div>مزيج المحتوى متوازن عبر الأنماط</div></li>
              </ul>
            </section>

          </div>

          {/* RIGHT col */}
          <div className="hm-col">
            {/* Health breakdown */}
            <section className="hm-card">
              <div className="hm-card-head">
                <div>
                  <h3>تفاصيل صحة نموك</h3>
                  <p>العوامل الأربعة التي تحدد النتيجة</p>
                </div>
                <div className="hm-score">
                  <span className="num">٦٥</span><em>/١٠٠</em>
                </div>
              </div>
              <div className="hm-health">
                {[
                { k: 'ملاءمة الجمهور', v: 29, hint: 'نسبة استبدال إيجابية في المنشورات المتحفّظة', tone: 'bad' },
                { k: 'أداء إنستغرام', v: 9, hint: 'متوسط التفاعل لكل منشور مقارنة بمعيار ١٠٠ تفاعل', tone: 'bad' },
                { k: 'الانتظام', v: 0, hint: 'آخر منشور: ٤ سبتمبر ٢٠٢٥', tone: 'bad' },
                { k: 'تنوّع المحتوى', v: 100, hint: 'مزيج من الصور والفيديوهات والكاروسيل', tone: 'good' }].
                map((row, i) =>
                <div key={i} className="hm-hr">
                    <div className="hm-hr-top">
                      <div className="hm-hr-k">{row.k}</div>
                      <div className={`hm-hr-v num ${row.tone}`}>{row.v}٪</div>
                    </div>
                    <div className="hm-hr-track">
                      <div className={`hm-hr-fill ${row.tone}`} style={{ width: `${row.v}%` }} />
                    </div>
                    <div className="hm-hr-hint">{row.hint}</div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Floating Ask Basiret — reuses MPGAskFab */}
        <MPGAskFab />
      </main>

      <style>{`
        .hm { display:flex; min-height:100vh; background:var(--canvas); }
        .hm-main { flex:1; padding:30px 40px 48px; display:flex; flex-direction:column; gap:22px; max-width:1520px; }

        /* Header */
        .hm-head { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; }
        .hm-crumb { font-size:12px; color:var(--ink-500); font-weight:500; margin-bottom:8px; }
        .hm-head h1 { font-size:30px; font-weight:700; color:var(--ink-950); letter-spacing:-0.025em; margin:0 0 6px; line-height:1.2; }
        .hm-wave { display:inline-block; animation:hm-wave 2.4s ease-in-out infinite; transform-origin:70% 70%; }
        @keyframes hm-wave { 0%,60%,100% { transform:rotate(0); } 10%,30%,50% { transform:rotate(14deg); } 20%,40% { transform:rotate(-8deg); } }
        .hm-head p { font-size:13.5px; color:var(--ink-600); margin:0; max-width:560px; line-height:1.5; }
        .hm-head-r { display:flex; gap:10px; align-items:center; }
        .hm-seg { display:flex; background:var(--ink-100); border-radius:10px; padding:3px; }
        .hm-seg button { padding:7px 14px; font-size:12.5px; border-radius:7px; color:var(--ink-600); font-weight:500; }
        .hm-seg button.is-on { background:var(--surface); color:var(--ink-900); font-weight:600; box-shadow:var(--shadow-sm); }
        .hm-new { display:inline-flex; align-items:center; gap:6px; padding:9px 16px; background:var(--purple-600); color:#fff; border-radius:10px; font-size:12.5px; font-weight:600; box-shadow:0 6px 16px -6px rgba(99,65,224,.5); }
        .hm-new:hover { background:var(--purple-700); }

        /* KPI strip */
        .hm-kpi { display:grid; grid-template-columns:1.3fr 1fr 1fr 1fr; gap:14px; }
        .hm-kpi-card { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:20px 22px; display:flex; flex-direction:column; gap:8px; position:relative; overflow:hidden; }
        .hm-kpi--hero { background:linear-gradient(135deg, var(--purple-800), oklch(0.28 0.14 285)); color:#fff; border:none; flex-direction:row; align-items:center; gap:20px; padding:18px 22px; }
        .hm-kpi--hero .hm-kpi-k { color:rgba(255,255,255,.92); margin:0 0 6px; font-weight:600; }
        .hm-kpi--hero .hm-kpi-d { color:#fff; font-weight:600; }
        .hm-kpi--hero .hm-kpi-d.up { color:oklch(0.92 0.18 150); }
        .hm-kpi-k { font-size:11.5px; color:var(--ink-500); font-weight:500; }
        .hm-kpi-v { font-size:28px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; line-height:1; }
        .hm-kpi-d { font-size:12px; font-weight:600; color:var(--ink-600); }
        .hm-kpi-d.up { color:oklch(0.5 0.15 155); }
        .hm-kpi-spark { display:flex; gap:3px; align-items:flex-end; height:34px; margin-top:auto; }
        .hm-kpi-spark > div { flex:1; background:var(--purple-200); border-radius:2px 2px 0 0; min-height:3px; }

        .hm-kpi-ring { position:relative; width:92px; height:92px; flex-shrink:0; }
        .hm-kpi-ring svg { width:100%; height:100%; }
        .hm-kpi-ring-c { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; line-height:1; }
        .hm-kpi-ring-c .num { font-size:28px; font-weight:700; letter-spacing:-0.02em; }
        .hm-kpi-ring-c em { font-style:normal; font-size:11px; opacity:.85; font-weight:500; margin-top:3px; font-family:var(--mono); }
        .hm-kpi--hero > div:last-child { flex:1; }

        /* NBA banner */
        .hm-nba { background:linear-gradient(135deg, var(--purple-50), oklch(0.97 0.03 280)); border:1px solid var(--purple-200); border-radius:16px; padding:18px 22px; display:flex; justify-content:space-between; align-items:center; gap:16px; }
        .hm-nba-l { display:flex; gap:14px; align-items:center; flex:1; }
        .hm-nba-av { width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg, var(--purple-500), var(--purple-700)); color:#fff; display:grid; place-items:center; font-size:17px; font-weight:700; box-shadow:0 6px 18px -4px rgba(99,65,224,.5); flex-shrink:0; }
        .hm-nba-k { font-size:11px; font-weight:700; color:var(--purple-700); margin-bottom:4px; letter-spacing:0.02em; }
        .hm-nba-t { font-size:13.5px; color:var(--ink-900); line-height:1.55; font-weight:500; }
        .hm-nba-t strong { color:var(--ink-950); font-weight:700; }
        .hm-nba-t b { color:oklch(0.5 0.15 155); font-weight:700; }
        .hm-nba-btn { padding:10px 16px; background:var(--purple-600); color:#fff; border-radius:10px; font-size:12.5px; font-weight:600; display:inline-flex; align-items:center; gap:5px; flex-shrink:0; box-shadow:0 6px 16px -6px rgba(99,65,224,.5); }
        .hm-nba-btn:hover { background:var(--purple-700); }

        /* Actions for today */
        .hm-actions { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:22px; }
        .hm-actions-head { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; margin-bottom:14px; }
        .hm-actions-head h3 { font-size:15px; font-weight:700; color:var(--ink-950); margin:0 0 3px; letter-spacing:-0.005em; }
        .hm-actions-head p { font-size:12px; color:var(--ink-500); margin:0; }
        .hm-actions-stats { display:flex; gap:14px; font-size:11.5px; color:var(--ink-600); font-weight:500; }
        .hm-actions-stats span { display:inline-flex; align-items:baseline; gap:4px; }
        .hm-actions-stats b { color:var(--ink-950); font-weight:700; font-size:14px; letter-spacing:-0.005em; }

        .hm-actions-list { display:flex; flex-direction:column; gap:6px; }
        .hm-act { display:grid; grid-template-columns:72px minmax(0,1fr) 130px 150px; gap:14px; align-items:center; padding:14px 16px; border-radius:12px; border:1px solid var(--line); background:var(--surface); transition:all .15s; min-height:64px; }
        .hm-act:hover { border-color:var(--purple-300); background:var(--ink-50); }
        .hm-act--urgent { border-color:oklch(0.88 0.06 30); background:oklch(0.99 0.01 30); }
        .hm-act--urgent:hover { border-color:oklch(0.75 0.13 30); background:oklch(0.97 0.03 30); }

        .hm-act-pri { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:99px; font-size:10.5px; font-weight:700; letter-spacing:0.01em; justify-self:start; white-space:nowrap; }
        .hm-act-pri-dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
        .hm-act--urgent .hm-act-pri-dot { animation:hm-pulse 1.6s ease-in-out infinite; }
        @keyframes hm-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.6; transform:scale(1.3); } }

        .hm-act-icon { width:32px; height:32px; border-radius:9px; display:grid; place-items:center; }
        .hm-act-body { min-width:0; text-align:start; }
        .hm-act-title { font-size:13.5px; font-weight:600; color:var(--ink-950); line-height:1.45; margin-bottom:4px; text-wrap:pretty; }
        .hm-act-why { font-size:11.5px; color:var(--ink-600); display:flex; align-items:center; gap:6px; flex-wrap:wrap; line-height:1.4; }
        .hm-act-src { font-weight:600; color:var(--ink-700); }
        .hm-act-dot { color:var(--ink-300); }

        .hm-act-meta { display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:4px; padding-inline-start:14px; border-inline-start:1px solid var(--line); }
        .hm-act-impact { font-size:11px; font-weight:600; color:oklch(0.5 0.15 155); white-space:nowrap; }
        .hm-act-time { font-size:10.5px; color:var(--ink-500); font-weight:500; white-space:nowrap; }

        .hm-act-cta { padding:9px 14px; border-radius:9px; background:var(--ink-900); color:#fff; font-size:11.5px; font-weight:600; display:inline-flex; align-items:center; justify-content:center; gap:5px; white-space:nowrap; width:100%; }
        .hm-act-cta:hover { background:var(--purple-700); }
        .hm-act--urgent .hm-act-cta { background:oklch(0.55 0.17 30); }
        .hm-act--urgent .hm-act-cta:hover { background:oklch(0.48 0.18 30); }

        /* Grid */
        .hm-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; align-items:flex-start; }
        .hm-col { display:flex; flex-direction:column; gap:14px; }

        .hm-card { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:22px; }
        .hm-card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:16px; }
        .hm-card-head h3 { font-size:15px; font-weight:700; color:var(--ink-950); margin:0 0 3px; letter-spacing:-0.005em; }
        .hm-card-head p { font-size:12px; color:var(--ink-500); margin:0; }
        .hm-link { font-size:12px; color:var(--purple-700); font-weight:500; }

        /* Bullets */
        .hm-bullets { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:4px; }
        .hm-bullets li { display:flex; gap:12px; align-items:center; padding:10px 12px; border-radius:10px; font-size:13.5px; color:var(--ink-800); line-height:1.5; }
        .hm-bullets li:hover { background:var(--ink-50); }
        .hm-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .hm-dot.good { background:oklch(0.65 0.15 155); box-shadow:0 0 0 3px oklch(0.92 0.08 155); }
        .hm-dot.warn { background:oklch(0.75 0.15 75);  box-shadow:0 0 0 3px oklch(0.95 0.08 75); }
        .hm-dot.bad  { background:oklch(0.65 0.2 30);   box-shadow:0 0 0 3px oklch(0.93 0.08 30); }

        /* Patterns */
        .hm-patterns { display:flex; flex-direction:column; gap:8px; }
        .hm-pattern { display:flex; gap:16px; align-items:center; padding:14px 16px; border-radius:12px; background:var(--ink-50); border:1px solid var(--line); transition:background 0.15s; }
        .hm-pattern:hover { background:var(--ink-100); }
        .hm-pattern-pct { font-size:18px; font-weight:700; letter-spacing:-0.01em; flex-shrink:0; min-width:42px; }
        .hm-pattern-body { flex:1; }
        .hm-pattern-title { font-size:13px; font-weight:600; color:var(--ink-900); font-family:var(--mono); letter-spacing:-0.005em; margin-bottom:6px; }
        .hm-pattern-tags { display:flex; gap:6px; }
        .hm-pattern-tags span { padding:2px 9px; border-radius:99px; background:var(--surface); border:1px solid var(--line); font-size:10.5px; color:var(--ink-600); font-weight:500; }

        /* Next post card */
        .hm-nxt { position:relative; overflow:hidden; }
        .hm-nxt::before { content:''; position:absolute; top:0; inset-inline:0; height:3px; background:linear-gradient(90deg, var(--purple-400), var(--purple-700)); }
        .hm-nxt-time { display:flex; align-items:center; gap:14px; padding:16px 18px; background:var(--purple-50); border-radius:12px; margin-bottom:14px; }
        .hm-nxt-time > svg { color:var(--purple-700); flex-shrink:0; }
        .hm-nxt-when { font-size:16px; font-weight:700; color:var(--ink-950); letter-spacing:-0.005em; }
        .hm-nxt-sub { font-size:11.5px; color:var(--ink-600); margin-top:2px; }
        .hm-nxt-reach { margin-inline-start:auto; text-align:center; padding:6px 14px; background:var(--surface); border-radius:10px; border:1px solid var(--purple-200); }
        .hm-nxt-reach .num { display:block; font-size:15px; font-weight:700; color:oklch(0.5 0.15 155); letter-spacing:-0.005em; }
        .hm-nxt-reach em { font-style:normal; font-size:10.5px; color:var(--ink-500); font-weight:500; }
        .hm-nxt-acts { display:flex; gap:8px; }
        .hm-btn { flex:1; padding:11px; border-radius:10px; font-size:12.5px; font-weight:600; }
        .hm-btn.primary { background:var(--ink-900); color:#fff; }
        .hm-btn.primary:hover { background:var(--ink-800); }
        .hm-btn.ghost { background:transparent; color:var(--ink-700); border:1px solid var(--line-strong); }
        .hm-btn.ghost:hover { background:var(--ink-50); }

        /* Health card */
        .hm-score { text-align:end; }
        .hm-score .num { font-size:26px; font-weight:700; color:var(--purple-700); letter-spacing:-0.015em; }
        .hm-score em { font-style:normal; font-size:11px; color:var(--ink-500); font-weight:500; font-family:var(--mono); }
        .hm-health { display:flex; flex-direction:column; gap:14px; }
        .hm-hr-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
        .hm-hr-k { font-size:13px; font-weight:600; color:var(--ink-900); }
        .hm-hr-v { font-size:13px; font-weight:700; letter-spacing:-0.005em; }
        .hm-hr-v.good { color:oklch(0.5 0.15 155); }
        .hm-hr-v.bad  { color:oklch(0.6 0.2 30); }
        .hm-hr-track { height:7px; background:var(--ink-100); border-radius:99px; overflow:hidden; margin-bottom:6px; }
        .hm-hr-fill { height:100%; border-radius:99px; transition:width .6s cubic-bezier(.2,.8,.2,1); }
        .hm-hr-fill.good { background:oklch(0.65 0.15 155); }
        .hm-hr-fill.bad  { background:oklch(0.65 0.2 30); }
        .hm-hr-hint { font-size:11.5px; color:var(--ink-500); line-height:1.5; }
      `}</style>
    </div>);

};

window.HomeApp = HomeApp;