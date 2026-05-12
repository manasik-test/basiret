// Refined sidebar — same info architecture, tighter hierarchy, cleaner icons
const Sidebar = ({ active = 'content-plan' }) => {
  const nav = [
    { id: 'home',         label: 'الرئيسية',     icon: 'home' },
    { id: 'posts',        label: 'منشوراتي',     icon: 'grid' },
    { id: 'audience',     label: 'جمهوري',      icon: 'users' },
    { id: 'content-plan', label: 'خطة المحتوى',  icon: 'calendar' },
    { id: 'competitors',  label: 'المنافسون',    icon: 'compass' },
    { id: 'sentiment',    label: 'المشاعر',      icon: 'heart' },
    { id: 'trends',       label: 'الاتجاهات',    icon: 'trending' },
    { id: 'goals',        label: 'أهدافي',      icon: 'target' },
    { id: 'settings',     label: 'الإعدادات',    icon: 'settings' },
  ];

  return (
    <aside className="sb">
      <div className="sb-brand">
        <div className="sb-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
            <circle cx="12" cy="12" r="3.2" fill="currentColor"/>
          </svg>
        </div>
        <div className="sb-brand-txt">
          <div className="sb-brand-name">بصيرة</div>
          <div className="sb-brand-sub">Basiret</div>
        </div>
      </div>

      <nav className="sb-nav">
        {nav.map(item => (
          <button key={item.id} className={`sb-item ${active === item.id ? 'is-active' : ''}`}>
            <SBIcon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sb-foot">
        <button className="sb-upgrade">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 3l2.4 5.6L20 10l-4 4 1 6-5-3-5 3 1-6-4-4 5.6-1.4L12 3z" fill="currentColor"/>
          </svg>
          <span>الترقية إلى Pro</span>
        </button>
        <div className="sb-user">
          <div className="sb-avatar">TA</div>
          <div className="sb-user-txt">
            <div className="sb-user-name">Tasyeer Abdalla</div>
            <div className="sb-user-plan">خطة مجانية</div>
          </div>
        </div>
      </div>

      <style>{`
        .sb {
          width: 240px;
          background: var(--surface);
          border-inline-start: 1px solid var(--line);
          display: flex;
          flex-direction: column;
          padding: 22px 16px 18px;
          height: 100vh;
          position: sticky;
          top: 0;
          flex-shrink: 0;
        }
        .sb-brand {
          display: flex; align-items: center; gap: 10px;
          padding: 4px 8px 22px;
        }
        .sb-logo {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, var(--purple-600), var(--purple-400));
          color: #fff; display: grid; place-items: center;
        }
        .sb-brand-name { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; color: var(--ink-900); }
        .sb-brand-sub  { font-size: 11px; color: var(--ink-400); font-family: 'Inter', sans-serif; letter-spacing: 0.08em; text-transform: uppercase; }

        .sb-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; margin-top: 4px; }
        .sb-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          color: var(--ink-600);
          font-size: 14px; font-weight: 500;
          transition: background 0.12s, color 0.12s;
          text-align: start;
        }
        .sb-item svg { flex-shrink: 0; }
        .sb-item:hover { background: var(--ink-100); color: var(--ink-900); }
        .sb-item.is-active {
          background: var(--purple-50);
          color: var(--purple-700);
          font-weight: 600;
        }
        .sb-item.is-active svg { color: var(--purple-600); }

        .sb-foot { display: flex; flex-direction: column; gap: 12px; padding-top: 14px; border-top: 1px solid var(--line); }
        .sb-upgrade {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 10px 14px;
          border-radius: 10px;
          background: var(--ink-900);
          color: #fff;
          font-size: 13px; font-weight: 600;
          transition: background 0.12s;
        }
        .sb-upgrade:hover { background: var(--ink-800); }
        .sb-upgrade svg { color: var(--purple-300); }

        .sb-user {
          display: flex; align-items: center; gap: 10px;
          padding: 4px 4px;
        }
        .sb-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--purple-100); color: var(--purple-700);
          display: grid; place-items: center;
          font-size: 12px; font-weight: 700; font-family: 'Inter', sans-serif;
        }
        .sb-user-name { font-size: 13px; font-weight: 600; color: var(--ink-900); line-height: 1.2; }
        .sb-user-plan { font-size: 11px; color: var(--ink-500); }
      `}</style>
    </aside>
  );
};

// Minimal, consistent icon set (1.6 stroke, 20px)
const SBIcon = ({ name }) => {
  const s = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    home:      <><path d="M3 10.5L12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5" /></>,
    grid:      <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    users:     <><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.2a3.2 3.2 0 010 6.4"/><path d="M18 14.5c2 .7 3 2.5 3 5.5"/></>,
    calendar:  <><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17"/><path d="M8 3v4M16 3v4"/></>,
    compass:   <><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5L13.5 13.5L8.5 15.5L10.5 10.5L15.5 8.5z"/></>,
    heart:     <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.7A4 4 0 0119 10c0 5.5-7 10-7 10z"/>,
    trending:  <><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></>,
    target:    <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></>,
    spark:     <><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M12 8l1.5 2.5L16 12l-2.5 1.5L12 16l-1.5-2.5L8 12l2.5-1.5L12 8z" fill="currentColor" stroke="none"/></>,
    settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></>,
  };
  return <svg {...s}>{paths[name] || null}</svg>;
};

Object.assign(window, { Sidebar, SBIcon });
