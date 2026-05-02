import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/marketing-i18n";

type Plan = {
  highlighted: boolean;
  monthly: number;
  yearly: number;
  custom?: boolean;
  cta_target: string;
  en: {
    name: string;
    desc: string;
    features: readonly string[];
    cta: string;
  };
  ar: {
    name: string;
    desc: string;
    features: readonly string[];
    cta: string;
  };
};

const plans: readonly Plan[] = [
  {
    highlighted: false,
    monthly: 0,
    yearly: 0,
    cta_target: "/register",
    en: {
      name: "Free",
      desc: "Perfect for getting started",
      features: [
        "Basic audience insights",
        "1 social media account",
        "5 action recommendations/month",
        "7-day data history",
        "Email support",
      ],
      cta: "Get Started",
    },
    ar: {
      name: "مجاني",
      desc: "مثالي للبداية",
      features: [
        "رؤى أساسية عن الجمهور",
        "حساب واحد على وسائل التواصل",
        "5 توصيات عملية شهرياً",
        "سجل بيانات 7 أيام",
        "دعم عبر البريد الإلكتروني",
      ],
      cta: "ابدأ الآن",
    },
  },
  {
    highlighted: true,
    monthly: 29,
    yearly: 24,
    cta_target: "/register",
    en: {
      name: "Pro",
      desc: "For serious growth",
      features: [
        "Full behavior analysis",
        "5 social media accounts",
        "Unlimited action recommendations",
        "Competitor pulse tracking",
        "Audience segmentation",
        "Growth timeline & analytics",
        "Priority support",
      ],
      cta: "Start Pro Trial",
    },
    ar: {
      name: "احترافي",
      desc: "للنمو الجاد",
      features: [
        "تحليل سلوك كامل",
        "5 حسابات على وسائل التواصل",
        "توصيات عملية غير محدودة",
        "تتبع نبض المنافسين",
        "تقسيم الجمهور",
        "مسار النمو والتحليلات",
        "دعم ذو أولوية",
      ],
      cta: "ابدأ النسخة الاحترافية",
    },
  },
  {
    highlighted: false,
    monthly: 0,
    yearly: 0,
    custom: true,
    cta_target: "/for/enterprise",
    en: {
      name: "Enterprise",
      desc: "Custom solutions for large teams",
      features: [
        "Everything in Pro",
        "Unlimited social media accounts",
        "Dedicated account manager",
        "Custom integrations & API access",
        "SSO & advanced security",
        "SLA-backed uptime",
      ],
      cta: "Contact Us",
    },
    ar: {
      name: "المؤسسات",
      desc: "حلول مخصصة للفرق الكبيرة",
      features: [
        "كل ما في الخطة الاحترافية",
        "حسابات تواصل اجتماعي غير محدودة",
        "مدير حساب مخصص",
        "تكاملات مخصصة ووصول API",
        "تسجيل دخول موحد وأمان متقدم",
        "ضمان وقت التشغيل (SLA)",
      ],
      cta: "تواصل معنا",
    },
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } },
} as const;

export function Pricing() {
  const { t, dir } = useI18n();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section id="pricing" dir={dir} className="bg-white py-16 sm:py-24">
      <div ref={ref} className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
          className="mb-12 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold text-[#484848] sm:text-4xl lg:text-5xl">
            {t("Simple, transparent pricing", "أسعار بسيطة وشفافة")}
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-500 leading-relaxed">
            {t(
              "Start free. Upgrade when you're ready to grow faster.",
              "ابدأ مجاناً. ارتقِ عندما تكون مستعداً للنمو بشكل أسرع."
            )}
          </p>

          <div className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-[#F5F3FF] p-1">
            <button
              onClick={() => setIsYearly(false)}
              className={`relative rounded-full px-5 py-2 text-sm font-medium transition-colors cursor-pointer ${
                !isYearly ? "text-[#484848]" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {!isYearly && (
                <motion.div
                  layoutId="pricing-toggle"
                  className="absolute inset-0 rounded-full bg-white border border-gray-200 shadow-sm"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10">{t("Monthly", "شهري")}</span>
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`relative rounded-full px-5 py-2 text-sm font-medium transition-colors cursor-pointer ${
                isYearly ? "text-[#484848]" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {isYearly && (
                <motion.div
                  layoutId="pricing-toggle"
                  className="absolute inset-0 rounded-full bg-white border border-gray-200 shadow-sm"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                {t("Yearly", "سنوي")}
                <span className="ml-1.5 text-xs text-[#5433c2] font-semibold">{t("Save 17%", "وفّر 17%")}</span>
              </span>
            </button>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid gap-6 md:grid-cols-3"
        >
          {plans.map((plan, i) => {
            const p = plan.highlighted;
            const price = plan.monthly === 0 ? 0 : (isYearly ? plan.yearly : plan.monthly);
            const period = plan.monthly === 0 ? "" : (isYearly ? t("/mo, billed yearly", "/شهرياً، يُدفع سنوياً") : t("/month", "/شهرياً"));
            return (
              <motion.div
                key={i}
                variants={cardVariants}
                className={`relative overflow-hidden rounded-2xl p-6 cursor-default transition-shadow sm:p-8 ${
                  p
                    ? "border-2 border-[#5433c2] bg-white shadow-xl shadow-[#5433c2]/10"
                    : "border border-gray-200 bg-white hover:shadow-md"
                }`}
              >
                {p && (
                  <div className="mb-4 flex justify-center">
                    <Badge className="bg-[#5433c2] text-white font-semibold hover:bg-[#5433c2] border-transparent px-3 py-1 cursor-default uppercase tracking-wider text-[10px]">
                      {t("Most Popular", "الأكثر شعبية")}
                    </Badge>
                  </div>
                )}
                <h3 className="text-lg font-semibold text-[#484848]">
                  {t(plan.en.name, plan.ar.name)}
                </h3>
                <p className="mb-6 text-sm text-gray-500">
                  {t(plan.en.desc, plan.ar.desc)}
                </p>
                <div className="mb-8 flex items-baseline gap-1 min-h-[3rem]">
                  {plan.custom ? (
                    <span className="text-3xl font-bold text-[#484848]">
                      {t("Custom", "مخصّص")}
                    </span>
                  ) : (
                    <>
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={price}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          className="text-4xl font-bold text-[#484848]"
                        >
                          ${price}
                        </motion.span>
                      </AnimatePresence>
                      <span className="text-sm text-gray-500">{period}</span>
                    </>
                  )}
                </div>
                <ul className="mb-8 space-y-3">
                  {(t(plan.en.features.join("|||"), plan.ar.features.join("|||"))).split("|||").map(
                    (feature, j) => (
                      <li key={j} className="flex items-start gap-3 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-[#5433c2]" />
                        <span className="text-gray-600">{feature}</span>
                      </li>
                    )
                  )}
                </ul>
                <Link to={plan.cta_target}>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
                    <Button
                      className={`w-full h-11 cursor-pointer transition-all duration-200 ${
                        p
                          ? "bg-[#5433c2] text-white font-semibold hover:bg-[#4527a8] shadow-lg shadow-[#5433c2]/25"
                          : "bg-[#F5F3FF] text-[#484848] font-semibold border border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {t(plan.en.cta, plan.ar.cta)}
                    </Button>
                  </motion.div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
