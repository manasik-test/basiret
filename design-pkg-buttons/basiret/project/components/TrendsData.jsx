// Trends (الاتجاهات) — shared data
// Auto-filtered to user's industry (F&B in Riyadh as the canonical example)
// and geography (Saudi Arabia). Mix of: industry conversations, cultural moments,
// and macro market signals.

const TRENDS_USER = {
  industry: 'مأكولات ومشروبات',
  industryEn: 'F&B',
  city: 'الرياض',
  cityEn: 'Riyadh',
  country: 'المملكة العربية السعودية',
};

// Lifecycle phases
const PHASE = {
  rising:  { ar: 'صاعد',     fg: '#0d8a5b', bg: '#e6f5ee', dot: '#10a065' },
  peaking: { ar: 'ذروة',     fg: '#b8731a', bg: '#fbf1e0', dot: '#d4881e' },
  fading:  { ar: 'يتراجع',   fg: '#9b9aa6', bg: '#eeeef3', dot: '#9b9aa6' },
  steady:  { ar: 'ثابت',     fg: '#5b5e75', bg: '#eeeef3', dot: '#7c7f95' },
};

const CATEGORY = {
  topic:    { ar: 'محادثة',    en: 'topic',    color: '#7c5cef', tint: '#ede8ff' },
  cultural: { ar: 'موسم',      en: 'cultural', color: '#d4881e', tint: '#fbf1e0' },
  macro:    { ar: 'سوق',       en: 'macro',    color: '#0e7c8a', tint: '#dff0f2' },
  format:   { ar: 'صيغة',      en: 'format',   color: '#c44a8a', tint: '#fae3ee' },
};

// Spark generator — small ascending/peaking/fading patterns
const sp = (pattern) => pattern;

const TRENDS = [
  // Rising topics in F&B
  {
    id: 't1', cat: 'topic', phase: 'rising',
    title: 'كافيهات صحراوية مفتوحة بعد المغرب',
    sub: 'محتوى ليلي في مواقع غير تقليدية',
    volume: 12400, momentum: '+182%', daysIn: 3,
    spark: sp([2,3,3,5,8,11,18]),
    why: 'هاشتاقات #ليلة_في_البر ارتفعت ٤x في ٧ أيام — ومنشورات منافسيك حول الفكرة تجاوزت متوسطها بـ ٢.٧x',
    examples: 12, examplesUsers: ['@manga.cafe', '@ma3een', '@fenjan_riy'],
    angles: [
      'صور كاميرتك تحت النجوم في موقعك المفتوح',
      'حوار مع أحد روّادك: ليش يأتي بعد المغرب؟',
      'كاروسيل: ٥ مشروبات تناسب الجو الليلي',
    ],
    timeToAct: '٤–٧ أيام', tag: 'فرصة الآن',
  },
  {
    id: 't2', cat: 'topic', phase: 'peaking',
    title: 'مقارنات "السعر مقابل القيمة"',
    sub: 'مستهلك ٢٠٢٦ يفصّل قبل الشراء',
    volume: 28800, momentum: '+64%', daysIn: 11,
    spark: sp([5,8,12,18,22,24,23]),
    why: 'تفاعل المنشورات التي توضح "لماذا السعر؟" ارتفع ١٥٠٪ بعد موجة شكاوى التضخم على X.',
    examples: 24, examplesUsers: ['@noor_brand', '@raid_co'],
    angles: [
      'تفصيل تكلفة كوب القهوة عندك',
      'فيديو ٣٠ث: مكوّنات الحبة من المزرعة للكوب',
      'منشور قصير: "لماذا سعرنا أعلى من غيرنا"',
    ],
    timeToAct: '٧–١٠ أيام', tag: 'فعّال',
  },
  {
    id: 't3', cat: 'topic', phase: 'rising',
    title: 'وصفات الماتشا بنكهات سعودية',
    sub: 'دمج الفروقات الإقليمية',
    volume: 4900, momentum: '+340%', daysIn: 5,
    spark: sp([1,1,2,3,5,9,14]),
    why: 'منشورات #ماتشا_سعودي تضاعفت ٣x — جمهورك ٢٤–٣٤ يبحث عن خلطات غير مكررة',
    examples: 7,
    angles: [
      'ماتشا بهيل كاروسيل وصفة',
      'ريلز: محاولة دمج الماتشا مع القهوة العربية',
    ],
    timeToAct: '١٠–١٤ يوم', tag: 'موضوع جديد',
  },
  {
    id: 't4', cat: 'topic', phase: 'fading',
    title: 'محتوى "تحدي ٧٥ يوم"',
    sub: 'يفقد قوته بعد ذروة فبراير',
    volume: 7200, momentum: '-42%', daysIn: 38,
    spark: sp([22,20,18,15,12,9,7]),
    why: 'انخفاض البحث ٤٢٪ هذا الشهر. لو خططت له، أجّله.',
    examples: 18,
    angles: [],
    timeToAct: 'تجاوز هذا', tag: 'متراجع',
  },

  // Cultural / seasonal
  {
    id: 'c1', cat: 'cultural', phase: 'rising',
    title: 'اليوم الوطني السعودي ٩٦',
    sub: '٢٣ سبتمبر — بعد ٢٨ يوم',
    volume: 184000, momentum: '+95%', daysIn: 14,
    spark: sp([8,10,14,18,24,30,38]),
    why: 'حملات قهوة بنكهات وطنية حقّقت ٣x في ٢٠٢٥. نافذة الإعداد المثالية: من الآن إلى ١٠ سبتمبر.',
    examples: 0,
    angles: [
      'منيو محدود: ٣ مشروبات بألوان العَلَم',
      'فيديو: قصة قهوتك من المزارع السعوديين',
      'كولاب مع فنّان محلي على الأكواب',
    ],
    timeToAct: '٢١ يوم للإعداد', tag: 'موسم كبير',
    daysAway: 28,
  },
  {
    id: 'c2', cat: 'cultural', phase: 'rising',
    title: 'موسم الرياض ٢٠٢٦',
    sub: 'يفتتح ٢٠ أكتوبر — بعد ٥٥ يوم',
    volume: 92000, momentum: '+38%', daysIn: 21,
    spark: sp([12,14,16,19,22,26,32]),
    why: 'حركة جمهورك ترتفع ٤٠٪ خلال الموسم. منشورات عن المواقع القريبة من الفعاليات تتفوق.',
    examples: 0,
    angles: [
      'دليل سريع: كافيهات بمشي قريبة من بوليفارد',
      'كاروسيل: خطط ليلتك في الموسم',
    ],
    timeToAct: '٤٥ يوم', tag: 'تخطيط مبكر',
    daysAway: 55,
  },
  {
    id: 'c3', cat: 'cultural', phase: 'peaking',
    title: 'حر الصيف الشديد',
    sub: 'ذروة الطقس في الرياض هذا الأسبوع',
    volume: 61000, momentum: '+22%', daysIn: 10,
    spark: sp([18,20,22,24,25,26,26]),
    why: 'محتوى المشروبات الباردة وحلول التبريد يقفز ١٢٠٪ في الذروة الحرارية. مسموح الآن.',
    examples: 32,
    angles: [
      'فيديو: مشروب جليدي في ٣٠ ثانية',
      'استطلاع: أبرد مشروب على المنيو',
    ],
    timeToAct: '٥–٧ أيام', tag: 'طقس',
    daysAway: 0,
  },
  {
    id: 'c4', cat: 'cultural', phase: 'rising',
    title: 'مباراة السعودية × أستراليا',
    sub: 'تصفيات كأس العالم — ٥ سبتمبر',
    volume: 145000, momentum: '+58%', daysIn: 6,
    spark: sp([6,9,14,20,28,38,42]),
    why: 'حركة البث المباشر في الكافيهات ترتفع ٢x في أيام المباريات. عروض المشاهدة الجماعية تتصدّر.',
    examples: 4,
    angles: [
      'إعلان شاشة عرض في الكافيه',
      'منيو خاص بالمباراة',
    ],
    timeToAct: '١٠ أيام', tag: 'رياضة',
    daysAway: 10,
  },

  // Macro market signals
  {
    id: 'm1', cat: 'macro', phase: 'rising',
    title: 'تنظيم جديد: شفافية المنشأ',
    sub: 'وزارة التجارة — ساري ١ نوفمبر',
    volume: 8400, momentum: '+86%', daysIn: 4,
    spark: sp([1,2,3,5,8,11,15]),
    why: 'متطلب جديد بذكر بلد منشأ القهوة على المنيو. منافسوك بدأوا التحضير. كن أول من يتواصل به مع الجمهور.',
    examples: 3,
    angles: [
      'منشور توعوي: من أين تأتي حبوبنا',
      'كاروسيل: خريطة المنشأ على ٣ مستويات',
    ],
    timeToAct: '٦٠ يوم', tag: 'تنظيم',
  },
  {
    id: 'm2', cat: 'macro', phase: 'rising',
    title: 'ارتفاع تكلفة الحبوب البرازيلية ١٤٪',
    sub: 'إشارة سوق — تأثير ٦٠ يوم',
    volume: 5600, momentum: '+44%', daysIn: 9,
    spark: sp([2,3,4,6,8,9,11]),
    why: 'منشورات شفافية الأسعار تحقّق ٢.٤x متوسط التفاعل عند موجات التضخم. اشرح قبل أن يُفسَّر عنك.',
    examples: 6,
    angles: [
      'منشور: كيف نحمي السعر دون خفض الجودة',
      'ريلز قصير: رحلة الحبة من ساو باولو إلى كوبك',
    ],
    timeToAct: '٢١ يوم', tag: 'إشارة سوق',
  },
  {
    id: 'm3', cat: 'macro', phase: 'steady',
    title: 'نمو طلب القهوة المختصة ١٨٪/سنة',
    sub: 'تقرير الغرفة التجارية ٢٠٢٦',
    volume: 3200, momentum: '+12%', daysIn: 90,
    spark: sp([8,9,9,10,10,11,11]),
    why: 'اتجاه طويل المدى. استخدمه كأساس لمحتوى تعليمي مستمر، لا كحملة واحدة.',
    examples: 22,
    angles: [
      'سلسلة "ما الفرق؟": مختصة مقابل تجارية',
      'كاروسيل أسبوعي: تذوّق طريقة جديدة',
    ],
    timeToAct: 'مستمر', tag: 'اتجاه طويل',
  },
];

// Calendar moments — next 12 weeks
const CULTURAL_CALENDAR = [
  { date: 'اليوم',         label: 'حر الذروة',          weight: 'high',   id: 'c3', daysAway: 0 },
  { date: 'بعد ١٠ أيام',    label: 'مباراة السعودية',    weight: 'high',   id: 'c4', daysAway: 10 },
  { date: 'بعد ٢٨ يوم',     label: 'اليوم الوطني ٩٦',    weight: 'huge',   id: 'c1', daysAway: 28 },
  { date: 'بعد ٤٥ يوم',     label: 'بداية موسم الرياض',  weight: 'huge',   id: 'c2', daysAway: 45 },
  { date: 'بعد ٦٠ يوم',     label: 'تنظيم وزارة التجارة', weight: 'med',    id: 'm1', daysAway: 60 },
  { date: 'بعد ٧٢ يوم',     label: 'بداية الشتاء',       weight: 'med',    id: null, daysAway: 72 },
];

// Industry summary stats for hero
const TRENDS_SUMMARY = {
  newToday: 4,
  rising: 7,
  peaking: 3,
  fading: 2,
  topMomentum: 'وصفات الماتشا بنكهات سعودية',
  topMomentumPct: '+340%',
  bigSeason: 'اليوم الوطني ٩٦',
  bigSeasonDays: 28,
};

Object.assign(window, { TRENDS, PHASE, CATEGORY, TRENDS_USER, CULTURAL_CALENDAR, TRENDS_SUMMARY });
