import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Send,
  Sparkles,
  MessageCircle,
  BarChart3,
  Calendar,
  Users,
} from "lucide-react";
import { useI18n } from "@/lib/marketing-i18n";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 15 },
  },
} as const;

function PublishAnimation() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 p-5">
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 21 }).map((_, i) => (
          <motion.div
            key={i}
            className="aspect-square rounded-md bg-white/20"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 + i * 0.04, type: "spring", stiffness: 200, damping: 15 }}
          />
        ))}
      </div>
      {[2, 8, 13, 17].map((idx, i) => (
        <motion.div
          key={idx}
          className="absolute rounded-md bg-white/90 shadow-lg"
          style={{
            width: "calc(100% / 7 - 6px)",
            aspectRatio: "1",
            top: `${Math.floor(idx / 7) * (100 / 3 + 2) + 20}px`,
            left: `${(idx % 7) * (100 / 7) + 3}%`,
          }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: [0, 1, 1, 0.7], y: [-10, 0, 0, 0] }}
          transition={{
            delay: 1.5 + i * 0.3,
            duration: 2,
            repeat: Infinity,
            repeatDelay: 3,
          }}
        />
      ))}
      <motion.div
        className="absolute bottom-4 left-4 right-4 flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 shadow-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, type: "spring", stiffness: 100, damping: 15 }}
      >
        <Calendar className="size-4 text-fuchsia-600" />
        <div className="h-2 flex-1 rounded-full bg-fuchsia-200" />
        <Send className="size-3.5 text-fuchsia-600" />
      </motion.div>
    </div>
  );
}

function CreateAnimation() {
  return (
    <div className="relative flex h-full w-full flex-col gap-3 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="flex items-center gap-3 rounded-lg bg-white/90 px-4 py-3 shadow-sm"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 + i * 0.2, type: "spring", stiffness: 100, damping: 15 }}
        >
          <Sparkles className="size-4 shrink-0 text-emerald-600" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2 rounded-full bg-emerald-200" style={{ width: `${75 - i * 15}%` }} />
            <div className="h-1.5 rounded-full bg-gray-200" style={{ width: `${90 - i * 10}%` }} />
          </div>
        </motion.div>
      ))}
      <motion.div
        className="absolute top-3 right-3"
        animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <Sparkles className="size-6 text-white/60" />
      </motion.div>
    </div>
  );
}

function CommunityAnimation() {
  return (
    <div className="relative flex h-full w-full flex-col gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 p-5">
      {[
        { align: "self-start", w: "70%", delay: 0.8 },
        { align: "self-end", w: "55%", delay: 1.1 },
        { align: "self-start", w: "60%", delay: 1.4 },
      ].map((msg, i) => (
        <motion.div
          key={i}
          className={`flex items-center gap-2 rounded-xl bg-white/90 px-3 py-2.5 shadow-sm ${msg.align}`}
          style={{ maxWidth: msg.w }}
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: msg.delay, type: "spring", stiffness: 120, damping: 12 }}
        >
          <MessageCircle className="size-3.5 shrink-0 text-amber-600" />
          <div className="flex-1 space-y-1">
            <div className="h-1.5 rounded-full bg-amber-200" style={{ width: "80%" }} />
            <div className="h-1.5 rounded-full bg-gray-200" style={{ width: "50%" }} />
          </div>
        </motion.div>
      ))}
      <motion.div
        className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full bg-white text-xs font-bold text-amber-600"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        3
      </motion.div>
    </div>
  );
}

function AnalyzeAnimation() {
  const barHeights = [40, 65, 50, 80, 55, 90, 70];
  return (
    <div className="relative flex h-full w-full flex-col justify-end overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-5">
      <div className="flex items-end gap-2 h-32">
        {barHeights.map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-t-md bg-white/80"
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ delay: 0.8 + i * 0.1, type: "spring", stiffness: 80, damping: 12 }}
          />
        ))}
      </div>
      <motion.div
        className="mt-3 flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 shadow-md"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8, type: "spring", stiffness: 100, damping: 15 }}
      >
        <BarChart3 className="size-4 text-blue-600" />
        <div className="h-2 flex-1 rounded-full bg-blue-200" />
        <span className="text-xs font-bold text-blue-600">+42%</span>
      </motion.div>
    </div>
  );
}

const smallFeatures = [
  {
    icon: Calendar,
    color: "text-violet-600 bg-violet-100",
    en: { title: "Smart Scheduling", desc: "Auto-post at the best times for engagement" },
    ar: { title: "جدولة ذكية", desc: "نشر تلقائي في أفضل أوقات التفاعل" },
  },
  {
    icon: Users,
    color: "text-pink-600 bg-pink-100",
    en: { title: "Team Collaboration", desc: "Review and approve posts together" },
    ar: { title: "تعاون الفريق", desc: "مراجعة واعتماد المنشورات معاً" },
  },
] as const;

export function Features() {
  const { t, dir } = useI18n();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="features" dir={dir} className="bg-[#F5F3FF] py-16 sm:py-24">
      <div ref={ref} className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
          className="mb-12 text-center sm:mb-16"
        >
          <h2 className="mb-4 text-3xl font-bold text-[#484848] sm:text-4xl lg:text-5xl">
            {t("Everything you need to grow", "كل ما تحتاجه للنمو")}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-500 leading-relaxed">
            {t(
              "Powerful features designed specifically for SME owners who want results, not reports.",
              "مميزات قوية مصممة خصيصاً لأصحاب المنشآت الصغيرة الذين يريدون نتائج لا تقارير."
            )}
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid gap-4 md:grid-cols-2"
        >
          <motion.div
            variants={cardVariants}
            whileHover={{
              scale: 1.02,
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.08)",
              transition: { type: "spring", stiffness: 400, damping: 17 },
            }}
            className="group cursor-default overflow-hidden rounded-2xl border border-gray-200 bg-white transition-colors hover:border-gray-300"
          >
            <div className="h-52 sm:h-60">
              <PublishAnimation />
            </div>
            <div className="p-6">
              <span className="inline-block rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-semibold text-fuchsia-700">
                {t("Publish", "النشر")}
              </span>
              <h3 className="mt-3 text-lg font-bold text-[#484848] sm:text-xl">
                {t("Schedule & publish everywhere", "جدوِل وانشر في كل مكان")}
              </h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                {t(
                  "Plan your content calendar and publish to Instagram, TikTok, LinkedIn, X, and more.",
                  "خطط لتقويم المحتوى وانشر على انستقرام وتيك توك ولينكدإن وإكس والمزيد."
                )}
              </p>
            </div>
          </motion.div>

          <motion.div
            variants={cardVariants}
            whileHover={{
              scale: 1.02,
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.08)",
              transition: { type: "spring", stiffness: 400, damping: 17 },
            }}
            className="group cursor-default overflow-hidden rounded-2xl border border-gray-200 bg-white transition-colors hover:border-gray-300"
          >
            <div className="h-52 sm:h-60">
              <CreateAnimation />
            </div>
            <div className="p-6">
              <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                {t("Create", "الإنشاء")}
              </span>
              <h3 className="mt-3 text-lg font-bold text-[#484848] sm:text-xl">
                {t("Turn any idea into the perfect post", "حوّل أي فكرة إلى منشور مثالي")}
              </h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                {t(
                  "AI-powered content creation. Generate captions, hashtags, and visuals tailored to your brand.",
                  "إنشاء محتوى بالذكاء الاصطناعي. أنشئ نصوصاً وهاشتاقات ومرئيات مصممة لعلامتك التجارية."
                )}
              </p>
            </div>
          </motion.div>

          <motion.div
            variants={cardVariants}
            whileHover={{
              scale: 1.01,
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.08)",
              transition: { type: "spring", stiffness: 400, damping: 17 },
            }}
            className="group cursor-default overflow-hidden rounded-2xl border border-gray-200 bg-white transition-colors hover:border-gray-300 md:col-span-2"
          >
            <div className="grid md:grid-cols-2">
              <div className="p-6 sm:p-8 flex flex-col justify-center">
                <span className="inline-block w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  {t("Community", "المجتمع")}
                </span>
                <h3 className="mt-3 text-lg font-bold text-[#484848] sm:text-2xl">
                  {t("Reply to comments in a flash", "رد على التعليقات بسرعة البرق")}
                </h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed sm:text-base">
                  {t(
                    "Engage with your audience at 10x speed from one dashboard. Manage comments, DMs, and mentions across all platforms.",
                    "تفاعل مع جمهورك بسرعة 10 أضعاف من لوحة واحدة. أدِر التعليقات والرسائل والإشارات عبر جميع المنصات."
                  )}
                </p>
              </div>
              <div className="h-52 sm:h-64 md:h-auto">
                <CommunityAnimation />
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={cardVariants}
            whileHover={{
              scale: 1.02,
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.08)",
              transition: { type: "spring", stiffness: 400, damping: 17 },
            }}
            className="group cursor-default overflow-hidden rounded-2xl border border-gray-200 bg-white transition-colors hover:border-gray-300"
          >
            <div className="h-48 sm:h-52">
              <AnalyzeAnimation />
            </div>
            <div className="p-6">
              <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                {t("Analyze", "التحليل")}
              </span>
              <h3 className="mt-3 text-lg font-bold text-[#484848] sm:text-xl">
                {t("Answers, not just analytics", "إجابات وليس مجرد تحليلات")}
              </h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                {t(
                  "Get actionable insights instead of raw data. Know exactly what to change to grow.",
                  "احصل على رؤى عملية بدلاً من البيانات الخام. اعرف بالضبط ما يجب تغييره للنمو."
                )}
              </p>
            </div>
          </motion.div>

          <div className="flex flex-col gap-4">
            {smallFeatures.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <motion.div
                  key={i}
                  variants={cardVariants}
                  whileHover={{
                    scale: 1.03,
                    boxShadow: "0 20px 50px -15px rgba(0, 0, 0, 0.08)",
                    transition: { type: "spring", stiffness: 400, damping: 17 },
                  }}
                  className="flex-1 cursor-default rounded-2xl border border-gray-200 bg-white p-6 transition-colors hover:border-gray-300"
                >
                  <div className={`mb-3 flex size-10 items-center justify-center rounded-xl ${feat.color}`}>
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-base font-bold text-[#484848]">
                    {t(feat.en.title, feat.ar.title)}
                  </h3>
                  <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
                    {t(feat.en.desc, feat.ar.desc)}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
