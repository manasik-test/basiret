// Floating "Ask Basiret" FAB + expandable panel
// Used across all main pages. Depends on Icon + I from shared.jsx.

const MPGAskFab = () => {
  const [open, setOpen] = React.useState(false);
  const [msgs, setMsgs] = React.useState([
    { from: 'ai', text: 'مرحباً! اسألني أي شيء عن منشوراتك ومحتواك.' },
  ]);
  const [val, setVal] = React.useState('');

  const send = (text) => {
    if (!text.trim()) return;
    setMsgs(m => [...m, { from: 'u', text }, { from: 'ai', text: 'أحلل البيانات الآن… سأعود إليك بالنتيجة خلال لحظات.' }]);
    setVal('');
  };

  return (
    <React.Fragment>
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
    </React.Fragment>
  );
};

window.MPGAskFab = MPGAskFab;
