import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Check, Users } from "lucide-react";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { useI18n } from "@/lib/marketing-i18n";

type TabDef = {
  id: string;
  en: {
    label: string;
    heading: string;
    desc: string;
    checks: readonly string[];
  };
  ar: {
    label: string;
    heading: string;
    desc: string;
    checks: readonly string[];
  };
  members: readonly { name: string; handle: string; followers: string; color: string }[];
};

const tabs: readonly TabDef[] = [
  {
    id: "creators",
    en: {
      label: "Creators",
      heading: "Built for content creators",
      desc: "Whether you're a solo creator or building a personal brand, Basiret helps you understand your audience and grow consistently.",
      checks: [
        "Discover your best posting times automatically",
        "Track follower growth across all platforms",
        "AI-suggested content ideas based on trends",
      ],
    },
    ar: {
      label: "المبدعون",
      heading: "مصمم لصنّاع المحتوى",
      desc: "سواء كنت صانع محتوى مستقل أو تبني علامة شخصية، بصيرة تساعدك على فهم جمهورك والنمو باستمرار.",
      checks: [
        "اكتشف أفضل أوقات النشر تلقائياً",
        "تتبع نمو المتابعين عبر جميع المنصات",
        "أفكار محتوى مقترحة بالذكاء الاصطناعي بناءً على الترندات",
      ],
    },
    members: [
      { name: "Sarah K.", handle: "@sarahcreates", followers: "125K", color: "from-fuchsia-400 to-pink-400" },
      { name: "Omar R.", handle: "@omarvisuals", followers: "89K", color: "from-purple-400 to-fuchsia-400" },
      { name: "Leila M.", handle: "@leilalife", followers: "210K", color: "from-pink-400 to-rose-400" },
    ],
  },
  {
    id: "smb",
    en: {
      label: "Small Businesses",
      heading: "Grow your business online",
      desc: "Stop wasting ad budget on guesswork. Basiret shows you exactly what your customers want to see.",
      checks: [
        "Competitor benchmarking and gap analysis",
        "ROI tracking for social campaigns",
        "Audience segmentation by purchase intent",
      ],
    },
    ar: {
      label: "الشركات الصغيرة",
      heading: "نمِّ أعمالك على الإنترنت",
      desc: "توقف عن إهدار ميزانية الإعلانات على التخمين. بصيرة تريك بالضبط ما يريد عملاؤك رؤيته.",
      checks: [
        "مقارنة المنافسين وتحليل الفجوات",
        "تتبع عائد الاستثمار لحملات التواصل",
        "تقسيم الجمهور حسب نية الشراء",
      ],
    },
    members: [
      { name: "Ahmed N.", handle: "@noorboutique", followers: "15K", color: "from-emerald-400 to-teal-400" },
      { name: "Fatima A.", handle: "@fatimabakes", followers: "32K", color: "from-green-400 to-emerald-400" },
      { name: "Khalid S.", handle: "@khalidtech", followers: "8K", color: "from-teal-400 to-cyan-400" },
    ],
  },
  {
    id: "agencies",
    en: {
      label: "Agencies",
      heading: "Manage multiple clients with ease",
      desc: "Handle dozens of accounts from one dashboard. Generate client-ready reports in seconds, not hours.",
      checks: [
        "Multi-client dashboard with team access",
        "White-label reporting and exports",
        "Automated monthly performance summaries",
      ],
    },
    ar: {
      label: "الوكالات",
      heading: "أدِر عملاء متعددين بسهولة",
      desc: "تعامل مع عشرات الحسابات من لوحة واحدة. أنشئ تقارير جاهزة للعملاء في ثوانٍ لا ساعات.",
      checks: [
        "لوحة متعددة العملاء مع وصول الفريق",
        "تقارير وتصدير بالعلامة البيضاء",
        "ملخصات أداء شهرية آلية",
      ],
    },
    members: [
      { name: "Nadia H.", handle: "@nadiaagency", followers: "45K", color: "from-blue-400 to-indigo-400" },
      { name: "Rami T.", handle: "@ramimedia", followers: "67K", color: "from-indigo-400 to-blue-400" },
      { name: "Layla Z.", handle: "@laylacreative", followers: "28K", color: "from-sky-400 to-blue-400" },
    ],
  },
] as const;

function TabContent({ tab, lang }: { tab: TabDef; lang: "en" | "ar" }) {
  const copy = tab[lang];
  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-14">
      <div>
        <h3 className="mb-4 text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
          {copy.heading}
        </h3>
        <p className="mb-7 text-base leading-relaxed text-white/80 sm:text-lg">
          {copy.desc}
        </p>
        <ul className="space-y-3.5">
          {copy.checks.map((check, i) => (
            <li key={i} className="flex items-start gap-3.5 text-base text-white/90">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#A5DDEC]/20 ring-1 ring-[#A5DDEC]/40">
                <Check className="size-3.5 text-[#A5DDEC]" />
              </span>
              {check}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-4">
        {tab.members.map((member, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            <div
              className={`flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${member.color} text-base font-semibold text-white shadow-md`}
            >
              {member.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-white">{member.name}</p>
              <p className="text-sm text-white/60">{member.handle}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Users className="size-4" />
              {member.followers}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SocialProof() {
  const { t, lang, dir } = useI18n();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const animatedTabs = tabs.map((tab) => ({
    id: tab.id,
    label: t(tab.en.label, tab.ar.label),
    content: <TabContent tab={tab} lang={lang} />,
  }));

  return (
    <section dir={dir} className="bg-[#F5F3FF] py-16 sm:py-28">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
          className="mb-10 text-center sm:mb-14"
        >
          <h2 className="mb-4 text-3xl font-bold text-[#484848] sm:text-4xl lg:text-5xl">
            {t("Whoever you are, we've got you covered", "أياً كنت، نحن نغطيك")}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-500 leading-relaxed">
            {t(
              "Basiret adapts to your unique needs, whether you're a solo creator or managing dozens of clients.",
              "بصيرة تتكيف مع احتياجاتك الفريدة، سواء كنت صانع محتوى مستقل أو تدير عشرات العملاء."
            )}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.1 }}
          className="mx-auto max-w-6xl"
        >
          <AnimatedTabs tabs={animatedTabs} />
        </motion.div>
      </div>
    </section>
  );
}
