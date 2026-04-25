import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import type { ComponentType, SVGProps } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/marketing-i18n";

export type Bilingual = { en: string; ar: string };

export type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export type ProductStep = {
  title: Bilingual;
  desc: Bilingual;
};

export type ProductPageProps = {
  eyebrow: Bilingual;
  title: Bilingual;
  subtitle: Bilingual;
  bullets: Bilingual[];
  icon?: IconComponent;
  accent?: string;
  heroImage?: string;
  heroImageAlt?: Bilingual;
  steps?: ProductStep[];
  cta?: { label: Bilingual; href: string };
  secondaryCta?: { label: Bilingual; href: string };
};

export function ProductPage({
  eyebrow,
  title,
  subtitle,
  bullets,
  icon: Icon,
  accent = "#664FA1",
  heroImage,
  heroImageAlt,
  steps,
  cta = { label: { en: "Start free", ar: "ابدأ مجاناً" }, href: "/register" },
  secondaryCta,
}: ProductPageProps) {
  const { t, lang, dir } = useI18n();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const tr = (b: Bilingual) => (lang === "en" ? b.en : b.ar);

  return (
    <main dir={dir} className="pt-16">
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F5F3FF] to-white py-16 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(102,79,161,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(102,79,161,0.04) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 15% 25%, ${accent}14 0%, transparent 45%), radial-gradient(circle at 85% 75%, ${accent}0D 0%, transparent 50%)`,
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
            className={
              heroImage
                ? "grid items-center gap-10 md:grid-cols-2 md:gap-14"
                : "text-center"
            }
          >
            <div className={heroImage ? "text-center md:text-start" : ""}>
              {Icon && (
                <div
                  className={`mb-6 flex size-14 items-center justify-center rounded-2xl ${
                    heroImage ? "mx-auto md:mx-0" : "mx-auto"
                  }`}
                  style={{ backgroundColor: `${accent}1A`, color: accent }}
                >
                  <Icon className="size-6" />
                </div>
              )}
              <span
                className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ color: accent }}
              >
                {tr(eyebrow)}
              </span>
              <h1 className="mb-6 text-4xl font-bold leading-[1.1] tracking-tight text-[#484848] sm:text-5xl md:text-6xl">
                {tr(title)}
              </h1>
              <p
                className={`mb-8 text-lg leading-relaxed text-gray-600 sm:text-xl ${
                  heroImage ? "md:mx-0" : "mx-auto max-w-2xl"
                }`}
              >
                {tr(subtitle)}
              </p>
              <div
                className={`flex flex-col items-center gap-3 sm:flex-row ${
                  heroImage ? "md:justify-start" : "justify-center"
                }`}
              >
                <Link to={cta.href}>
                  <Button
                    className="h-12 w-full cursor-pointer rounded-xl px-7 font-semibold text-white shadow-lg flex items-center gap-2 sm:w-auto"
                    style={{
                      backgroundColor: accent,
                      boxShadow: `0 10px 30px -10px ${accent}66`,
                    }}
                  >
                    {tr(cta.label)}
                    <ArrowRight className="size-4 rtl:rotate-180" />
                  </Button>
                </Link>
                {secondaryCta && (
                  <Link to={secondaryCta.href}>
                    <Button className="h-12 w-full cursor-pointer rounded-xl bg-white px-7 font-semibold text-[#484848] border border-gray-200 hover:bg-gray-50 sm:w-auto">
                      {tr(secondaryCta.label)}
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {heroImage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.15 }}
                className="relative"
              >
                <div
                  aria-hidden
                  className="absolute -inset-4 rounded-3xl opacity-40 blur-2xl"
                  style={{ backgroundColor: `${accent}40` }}
                />
                <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/50 shadow-[0_30px_80px_-20px_rgba(102,79,161,0.25)]">
                  <img
                    src={heroImage}
                    alt={heroImageAlt ? tr(heroImageAlt) : ""}
                    className="size-full object-cover"
                  />
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>

      {steps && steps.length > 0 && (
        <section className="bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ type: "spring", stiffness: 100, damping: 15 }}
              className="mb-12 text-center"
            >
              <span
                className="mb-3 inline-block text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ color: accent }}
              >
                {t("How it works", "كيف يعمل")}
              </span>
              <h2 className="text-3xl font-bold text-[#484848] sm:text-4xl">
                {t("Three steps. No learning curve.", "ثلاث خطوات. بدون منحنى تعلّم.")}
              </h2>
            </motion.div>
            <div className="grid gap-6 md:grid-cols-3 md:gap-8">
              {steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    type: "spring",
                    stiffness: 100,
                    damping: 15,
                    delay: i * 0.1,
                  }}
                  className="relative rounded-2xl border border-gray-200 bg-white p-6 sm:p-7"
                >
                  <div
                    className="mb-4 flex size-9 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: accent }}
                  >
                    {i + 1}
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-[#484848]">
                    {tr(step.title)}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
                    {tr(step.desc)}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-[#F5F3FF] py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
            className="mb-10 text-center text-2xl font-bold text-[#484848] sm:text-3xl"
          >
            {t("Everything you get", "كل ما تحصل عليه")}
          </motion.h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {bullets.map((bullet, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  type: "spring",
                  stiffness: 100,
                  damping: 15,
                  delay: i * 0.05,
                }}
                className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-5"
              >
                <span
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${accent}1A`, color: accent }}
                >
                  <Check className="size-3.5" />
                </span>
                <span className="text-sm leading-relaxed text-gray-700 sm:text-base">
                  {tr(bullet)}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
          >
            <h2 className="mb-4 text-3xl font-bold text-[#484848] sm:text-4xl">
              {t("Ready to try Basiret?", "جاهز لتجربة بصيرة؟")}
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-lg text-gray-500 leading-relaxed">
              {t(
                "Free forever plan. No credit card required.",
                "خطة مجانية للأبد. لا حاجة لبطاقة ائتمان."
              )}
            </p>
            <Link to={cta.href} className="inline-block">
              <Button
                className="h-12 cursor-pointer rounded-xl px-8 font-semibold text-white shadow-lg flex items-center gap-2"
                style={{
                  backgroundColor: accent,
                  boxShadow: `0 10px 30px -10px ${accent}66`,
                }}
              >
                {tr(cta.label)}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
