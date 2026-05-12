// Shared data, type badges, helpers for all three options

const WEEK_DATA = [
  { day: 'الأحد',     date: '٢٦ أبريل', dateNum: 26, type: 'carousel', topic: 'قصص عملاء: 3 نتائج من المنصة',     time: '18:00', engagement: 3.1, thumb: 'violet' },
  { day: 'الإثنين',   date: '٢٧ أبريل', dateNum: 27, type: 'image',    topic: 'اقتباس ملهم للأسبوع',              time: '09:00', engagement: 2.4, thumb: 'cream' },
  { day: 'الثلاثاء',  date: '٢٨ أبريل', dateNum: 28, type: 'video',    topic: 'خلف الكواليس: كيف نصنع المحتوى',   time: '16:00', engagement: 4.2, thumb: 'peach' },
  { day: 'الأربعاء',  date: '٢٩ أبريل', dateNum: 29, type: 'video',    topic: 'نصائح سريعة لنمو الحساب',         time: '16:00', engagement: 5.0, thumb: 'purple', tag: 'مقترح' },
  { day: 'الخميس',    date: '٣٠ أبريل', dateNum: 30, type: 'carousel', topic: 'مقارنة: قبل وبعد التسويق الذكي',   time: '18:00', engagement: 3.6, thumb: 'mint' },
  { day: 'الجمعة',    date: '١ مايو',   dateNum: 1,  type: 'image',    topic: 'استطلاع: ما الأصعب في محتواك؟',    time: '11:00', engagement: 2.8, thumb: 'sky' },
  { day: 'السبت',     date: '٢ مايو',   dateNum: 2,  type: 'video',    topic: 'درس مصغّر: كتابة عنوان يجذب',      time: '16:00', engagement: 4.4, thumb: 'lavender' },
];

const TYPE_META = {
  video:    { ar: 'فيديو',  en: 'Video',    color: 'var(--video)',    tone: 'rgba(234, 105, 90, 0.1)' },
  image:    { ar: 'صورة',   en: 'Image',    color: 'var(--image)',    tone: 'rgba(70, 168, 158, 0.1)' },
  carousel: { ar: 'كاروسيل', en: 'Carousel', color: 'var(--carousel)', tone: 'rgba(124, 92, 239, 0.1)' },
};

const TypeIcon = ({ type, size = 14 }) => {
  const s = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (type === 'video') return <svg {...s}><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>;
  if (type === 'image') return <svg {...s}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/></svg>;
  if (type === 'carousel') return <svg {...s}><rect x="7" y="5" width="12" height="14" rx="2"/><path d="M4 7v10M22 9v6" opacity=".55"/></svg>;
  return null;
};

const TypePill = ({ type, size = 'md' }) => {
  const m = TYPE_META[type];
  const pad = size === 'sm' ? '3px 8px' : '4px 10px';
  const fs = size === 'sm' ? 11 : 12;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: pad, borderRadius: 999,
      background: m.tone, color: m.color,
      fontSize: fs, fontWeight: 600, letterSpacing: '-0.005em',
    }}>
      <TypeIcon type={type} size={size === 'sm' ? 11 : 13} />
      {m.ar}
    </span>
  );
};

// Monochrome thumbnail placeholder — tonal, not slop
const Thumb = ({ variant = 'purple', children, h = 120 }) => {
  const bgs = {
    violet:   'linear-gradient(135deg, #ede8ff 0%, #c0b0ff 100%)',
    cream:    'linear-gradient(135deg, #fbf6ed 0%, #f0e4cc 100%)',
    peach:    'linear-gradient(135deg, #fbeee7 0%, #f2c8b4 100%)',
    purple:   'linear-gradient(135deg, #e8e0ff 0%, #9b82f5 100%)',
    mint:     'linear-gradient(135deg, #e4f4ee 0%, #b8e0ce 100%)',
    sky:      'linear-gradient(135deg, #e5eef9 0%, #b8cfe7 100%)',
    lavender: 'linear-gradient(135deg, #f3eefb 0%, #d5c4ee 100%)',
  };
  return (
    <div style={{
      height: h,
      borderRadius: 12,
      background: bgs[variant] || bgs.purple,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.22) 0 1px, transparent 1px 14px)',
      }} />
      {children}
    </div>
  );
};

// Small UI utilities
const Icon = ({ path, size = 16, stroke = 1.7 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);

const I = {
  clock:    <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  spark:    <path d="M12 3v3M12 18v3M4.2 7.2l2 2M17.8 14.8l2 2M3 12h3M18 12h3M4.2 16.8l2-2M17.8 9.2l2-2" />,
  plus:     <><path d="M12 5v14M5 12h14"/></>,
  chevL:    <polyline points="15 18 9 12 15 6"/>,
  chevR:    <polyline points="9 18 15 12 9 6"/>,
  more:     <><circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/></>,
  search:   <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>,
  filter:   <path d="M3 5h18M6 12h12M10 19h4"/>,
  trend:    <><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></>,
  check:    <polyline points="20 6 9 17 4 12" />,
  pencil:   <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></>,
  wand:     <><path d="M15 4V2M15 10V8M11 6h2M17 6h2"/><path d="M3 21l12-12"/><path d="M12 6l2 2"/></>,
};

Object.assign(window, { WEEK_DATA, TYPE_META, TypePill, TypeIcon, Thumb, Icon, I });
