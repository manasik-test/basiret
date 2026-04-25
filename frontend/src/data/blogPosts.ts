import type { BlogPostMeta } from "@/components/page-templates/blog-layout";

export type BlogPostFull = BlogPostMeta & {
  body: { en: string; ar: string };
};

export const posts: BlogPostFull[] = [
  {
    slug: "5-minute-daily-social-media-routine",
    title: {
      en: "The 5-minute daily social media routine that actually grows your account",
      ar: "روتين التواصل الاجتماعي اليومي من 5 دقائق الذي ينمي حسابك فعلاً",
    },
    excerpt: {
      en: "You don't need two hours a day. You need three deliberate actions — and the data behind each one. Here's how the pros do it.",
      ar: "لا تحتاج ساعتين يومياً. تحتاج 3 إجراءات مدروسة — مع البيانات وراء كل منها. هكذا يفعلها المحترفون.",
    },
    date: "2026-04-12",
    readingTime: { en: "6 min read", ar: "6 دقائق قراءة" },
    category: { en: "Playbook", ar: "دليل عمل" },
    cover:
      "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=2000&auto=format&fit=crop",
    body: {
      en: `Most small-business owners we talk to say the same thing: "I don't have time to post." Fair. But here's what we noticed — the accounts that grow fastest aren't the ones spending hours. They're the ones spending five focused minutes, every day.

Here's the pattern we keep seeing:

Minute 1 — Check yesterday's top post. Not the likes. Look at saves and shares. Those are the signals that told the algorithm this piece of content was worth resurfacing.

Minute 2 — Reply to your most recent five comments. Real replies, not emojis. Comments that get real replies trigger the algorithm to show your post to more people. This is free distribution.

Minute 3 — Post one thing. Not three. One. Ideally something in the same format that worked yesterday.

Minute 4 — Check your DMs. Potential customers. Answer them like they're standing in your shop.

Minute 5 — Write down one thing you noticed today. Something the audience reacted to, or didn't. This becomes your playbook.

That's it. No dashboards. No spreadsheets. Just five minutes, repeated for 90 days. The compound effect will surprise you.`,
      ar: `معظم أصحاب الأعمال الصغيرة الذين نتحدث معهم يقولون الشيء ذاته: "ليس لدي وقت للنشر." عادل. لكن إليك ما لاحظناه — الحسابات التي تنمو أسرع ليست تلك التي تقضي ساعات. بل تلك التي تقضي خمس دقائق مركّزة، كل يوم.

إليك النمط الذي نراه دائماً:

الدقيقة 1 — تفقد أفضل منشور من الأمس. ليس الإعجابات. انظر إلى الحفظ والمشاركات. هذه هي الإشارات التي تخبر الخوارزمية أن هذا المحتوى يستحق إعادة الظهور.

الدقيقة 2 — ردّ على آخر خمسة تعليقات. ردود حقيقية، لا رموز تعبيرية. التعليقات التي تحصل على ردود حقيقية تجعل الخوارزمية تعرض منشورك لعدد أكبر من الناس. هذا توزيع مجاني.

الدقيقة 3 — انشر شيئاً واحداً. ليس ثلاثة. واحد. والأفضل بنفس الشكل الذي نجح أمس.

الدقيقة 4 — تفقد رسائلك. عملاء محتملون. جاوبهم وكأنهم يقفون في محلك.

الدقيقة 5 — اكتب شيئاً واحداً لاحظته اليوم. شيء تفاعل معه الجمهور، أو لم يتفاعل. هذا سيصبح دليل عملك.

هذا كل شيء. لا لوحات تحكم. لا جداول بيانات. فقط خمس دقائق، مكررة لمدة 90 يوماً. التأثير المركب سيفاجئك.`,
    },
  },
  {
    slug: "vanity-metrics-vs-signals-that-matter",
    title: {
      en: "Vanity metrics vs. signals that actually matter",
      ar: "المقاييس السطحية مقابل الإشارات التي تهم فعلاً",
    },
    excerpt: {
      en: "Likes feel good. They don't grow accounts. Here are the five numbers we obsess over at Basiret — and why they predict growth.",
      ar: "الإعجابات تشعرك بالسعادة. لكنها لا تنمي الحسابات. إليك الأرقام الخمسة التي نركز عليها في بصيرة — ولماذا تتنبأ بالنمو.",
    },
    date: "2026-03-28",
    readingTime: { en: "4 min read", ar: "4 دقائق قراءة" },
    category: { en: "Insights", ar: "رؤى" },
    cover:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2000&auto=format&fit=crop",
    body: {
      en: `There's a pattern across every platform we support: likes are noise. The signals that actually correlate with account growth are saves, shares, completion rate, profile visits from a post, and reply-to-view ratio.

Saves mean the content is useful — something people want to come back to. Shares mean the content travels — free distribution happens when someone recommends you. Completion rate (on Reels, TikTok) tells the algorithm "this held attention" — which is the #1 thing the algorithm rewards.

Profile visits from a post are the clearest intent signal you can get. Someone watched, then clicked. That's a warm lead. And reply-to-view ratio tells you whether your content is provoking thought or just passing by.

Track these. Ignore the rest. The ratio you care about isn't likes to followers — it's saves to views. Aim for 1% or better on every post.`,
      ar: `هناك نمط عبر كل منصة ندعمها: الإعجابات ضوضاء. الإشارات التي ترتبط فعلاً بنمو الحساب هي الحفظ، والمشاركات، ومعدل الإكمال، وزيارات الملف الشخصي من منشور، ونسبة الردود إلى المشاهدات.

الحفظ يعني أن المحتوى مفيد — شيء يريد الناس العودة إليه. المشاركات تعني أن المحتوى يسافر — التوزيع المجاني يحدث عندما يوصي أحدهم بك. معدل الإكمال (على الريلز وتيك توك) يخبر الخوارزمية "هذا حافظ على الانتباه" — وهو الشيء رقم 1 الذي تكافئه الخوارزمية.

زيارات الملف الشخصي من منشور هي أوضح إشارة نية يمكنك الحصول عليها. شخص شاهد، ثم نقر. هذا عميل محتمل دافئ. ونسبة الردود إلى المشاهدات تخبرك ما إذا كان محتواك يثير التفكير أم يمر فقط.

تتبع هذه. تجاهل الباقي. النسبة التي تهمك ليست الإعجابات إلى المتابعين — بل الحفظ إلى المشاهدات. استهدف 1% أو أفضل على كل منشور.`,
    },
  },
];
