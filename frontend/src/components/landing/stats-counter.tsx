import { useRef, useEffect } from "react";
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { useI18n } from "@/lib/marketing-i18n";

function CountUpNumber({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => `${prefix}${Math.round(v).toLocaleString()}${suffix}`);

  useEffect(() => {
    if (isInView) {
      const controls = animate(count, target, {
        duration: 2,
        ease: [0.22, 1, 0.36, 1],
      });
      return controls.stop;
    }
  }, [isInView, target, count]);

  return <motion.span ref={ref}>{rounded}</motion.span>;
}

const stats = [
  {
    target: 100000,
    suffix: "+",
    en: { number: "100,000+", label: "People using Basiret" },
    ar: { number: "+100,000", label: "شخص يستخدم بصيرة" },
  },
  {
    target: 8700000,
    suffix: "+",
    prefix: "",
    en: { number: "8.7M+", label: "Posts analyzed last month" },
    ar: { number: "+8.7M", label: "منشور تم تحليله الشهر الماضي" },
  },
  {
    target: 11,
    suffix: "",
    en: { number: "11", label: "Social platforms supported" },
    ar: { number: "11", label: "منصة اجتماعية مدعومة" },
  },
] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 15 },
  },
} as const;

export function StatsCounter() {
  const { t, dir } = useI18n();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section dir={dir} className="relative -mt-12 z-20 px-4 sm:px-6">
      <motion.div
        ref={ref}
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        className="mx-auto max-w-4xl"
      >
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              whileHover={{
                scale: 1.04,
                boxShadow: "0 20px 40px -12px rgba(0, 0, 0, 0.08)",
                transition: { type: "spring", stiffness: 400, damping: 17 },
              }}
              className="cursor-default rounded-2xl border border-gray-200 bg-white px-8 py-6 text-center shadow-sm"
            >
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400">
                {t(stat.en.label, stat.ar.label)}
              </p>
              <p className="text-3xl font-bold text-[#484848] sm:text-4xl">
                {i === 1 ? (
                  <>{t("8.7M+", "+8.7M")}</>
                ) : (
                  <CountUpNumber target={i === 0 ? 100000 : 11} suffix={i === 0 ? "+" : ""} />
                )}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
