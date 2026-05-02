import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import type { ComponentType, SVGProps } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CTAMarquee } from "@/components/landing/cta-marquee";
import { useI18n } from "@/lib/marketing-i18n";

export type Bilingual = { en: string; ar: string };

export type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export type ProductStep = {
  title: Bilingual;
  desc: Bilingual;
};

export type StepImage = {
  src: string;
  alt: Bilingual;
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
  stepImages?: StepImage[];
  cta?: { label: Bilingual; href: string };
  secondaryCta?: { label: Bilingual; href: string };
};

export function ProductPage({
  eyebrow,
  title,
  subtitle,
  bullets,
  icon: Icon,
  accent = "#5433c2",
  steps,
  stepImages,
  cta = { label: { en: "Start free", ar: "ابدأ مجاناً" }, href: "/register" },
  secondaryCta,
}: ProductPageProps) {
  const { t, lang, dir } = useI18n();
  const heroRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true, amount: 0.1 });

  const tr = (b: Bilingual) => (lang === "en" ? b.en : b.ar);

  return (
    <main dir={dir} className="pt-16">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F5F3FF] to-white py-20 sm:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(84,51,194,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(84,51,194,0.04) 1px, transparent 1px)",
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
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <motion.div
            ref={heroRef}
            initial={{ opacity: 0, y: 30 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
          >
            {Icon && (
              <div
                className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl"
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
            <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl">
              {tr(subtitle)}
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
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
          </motion.div>
        </div>
      </section>

      {/* ALTERNATING SECTIONS */}
      {steps && steps.length > 0 && (
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            {steps.slice(0, 3).map((step, i) => {
              const reverse = i % 2 === 1;
              const image = stepImages?.[i];
              return (
                <AlternatingRow
                  key={i}
                  index={i}
                  step={step}
                  image={image}
                  accent={accent}
                  reverse={reverse}
                  tr={tr}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* EVERYTHING YOU GET — bento grid */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
            className="mb-12 text-center"
          >
            <span
              className="mb-3 inline-block text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: accent }}
            >
              {t("Everything you get", "كل ما تحصل عليه")}
            </span>
            <h2 className="text-3xl font-bold text-[#484848] sm:text-4xl md:text-5xl">
              {t("All your tools, in one place.", "كل أدواتك في مكان واحد.")}
            </h2>
          </motion.div>
          <BentoGrid bullets={bullets} accent={accent} tr={tr} />
        </div>
      </section>

      {/* CTA + VERTICAL MARQUEE */}
      <CTAMarquee
        accent={accent}
        primaryCta={cta}
        secondaryCta={secondaryCta}
      />
    </main>
  );
}

function AlternatingRow({
  index,
  step,
  image,
  accent,
  reverse,
  tr,
}: {
  index: number;
  step: ProductStep;
  image: StepImage | undefined;
  accent: string;
  reverse: boolean;
  tr: (b: Bilingual) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ type: "spring", stiffness: 100, damping: 15 }}
      className={`grid items-center gap-10 py-14 md:gap-16 md:py-20 lg:grid-cols-2 ${
        index < 2 ? "border-b border-gray-100" : ""
      }`}
    >
      <div className={reverse ? "lg:order-2" : "lg:order-1"}>
        <span
          className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ color: accent }}
        >
          <span
            className="flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            {index + 1}
          </span>
          {tr({ en: `Step ${index + 1}`, ar: `الخطوة ${index + 1}` })}
        </span>
        <h2 className="mb-4 text-3xl font-bold leading-tight text-[#484848] sm:text-4xl">
          {tr(step.title)}
        </h2>
        <p className="text-base leading-relaxed text-gray-600 sm:text-lg">
          {tr(step.desc)}
        </p>
      </div>

      <div className={reverse ? "lg:order-1" : "lg:order-2"}>
        {image ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-2 shadow-xl shadow-black/5">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-gray-50">
              <img
                src={image.src}
                alt={tr(image.alt)}
                loading="lazy"
                decoding="async"
                className="size-full object-cover object-top"
              />
            </div>
          </div>
        ) : (
          <div
            className="flex aspect-[16/10] items-center justify-center rounded-3xl border border-gray-200 bg-gradient-to-br from-[#F5F3FF] to-white"
            style={{ color: accent }}
          >
            <span className="text-7xl font-bold opacity-20">{index + 1}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

type BentoVariant = {
  span: string;
  bg: "dark" | "light" | "tinted" | "gradient";
  size: "lg" | "md" | "sm";
};

const bentoLayout: BentoVariant[] = [
  { span: "md:col-span-7", bg: "dark", size: "lg" },
  { span: "md:col-span-5", bg: "light", size: "md" },
  { span: "md:col-span-4", bg: "tinted", size: "sm" },
  { span: "md:col-span-4", bg: "light", size: "sm" },
  { span: "md:col-span-4", bg: "tinted", size: "sm" },
  { span: "md:col-span-12", bg: "gradient", size: "md" },
];

function BentoGrid({
  bullets,
  accent,
  tr,
}: {
  bullets: Bilingual[];
  accent: string;
  tr: (b: Bilingual) => string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
      {bullets.slice(0, 6).map((bullet, i) => {
        const variant = bentoLayout[i] ?? bentoLayout[bentoLayout.length - 1];
        return (
          <BentoCard
            key={i}
            bullet={bullet}
            variant={variant}
            accent={accent}
            index={i}
            tr={tr}
          />
        );
      })}
    </div>
  );
}

function BentoCard({
  bullet,
  variant,
  accent,
  index,
  tr,
}: {
  bullet: Bilingual;
  variant: BentoVariant;
  accent: string;
  index: number;
  tr: (b: Bilingual) => string;
}) {
  const text = tr(bullet);
  // Split on em dash if present, so longer bullets get a title + supporting line
  const parts = text.split(/\s+—\s+/);
  const title = parts[0];
  const desc = parts.length > 1 ? parts.slice(1).join(" — ") : null;

  const minHeight =
    variant.size === "lg"
      ? "min-h-[260px] md:min-h-[280px]"
      : variant.size === "md"
        ? "min-h-[200px] md:min-h-[220px]"
        : "min-h-[180px] md:min-h-[200px]";

  const titleSize =
    variant.size === "lg"
      ? "text-2xl sm:text-3xl md:text-4xl"
      : variant.size === "md"
        ? "text-xl sm:text-2xl md:text-3xl"
        : "text-lg sm:text-xl md:text-2xl";

  let containerClass = "";
  let titleClass = "";
  let descClass = "";
  let chipBg = "";
  let chipColor = accent;
  let decorElement: React.ReactNode = null;

  if (variant.bg === "dark") {
    containerClass = "bg-[#1a1a1a] text-white";
    titleClass = "text-white";
    descClass = "text-white/70";
    chipBg = "rgba(255,255,255,0.12)";
    chipColor = "#ffffff";
    decorElement = (
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -end-12 size-48 rounded-full opacity-25 blur-3xl"
        style={{ backgroundColor: accent }}
      />
    );
  } else if (variant.bg === "tinted") {
    containerClass = "border border-gray-200";
    containerClass += "";
    titleClass = "text-[#484848]";
    descClass = "text-gray-600";
    chipBg = `${accent}1A`;
  } else if (variant.bg === "gradient") {
    containerClass = "border border-gray-200 text-[#484848]";
    titleClass = "text-[#484848]";
    descClass = "text-gray-600";
    chipBg = "rgba(255,255,255,0.7)";
    decorElement = (
      <>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 end-0 hidden w-1/3 rounded-r-3xl opacity-30 md:block"
          style={{
            background: `radial-gradient(circle at 80% 50%, ${accent}33 0%, transparent 70%)`,
          }}
        />
      </>
    );
  } else {
    containerClass = "border border-gray-200 bg-white";
    titleClass = "text-[#484848]";
    descClass = "text-gray-600";
    chipBg = `${accent}1A`;
  }

  const tintedStyle =
    variant.bg === "tinted"
      ? { backgroundColor: `${accent}0D` }
      : variant.bg === "gradient"
        ? {
            background: `linear-gradient(135deg, #ffffff 0%, ${accent}10 100%)`,
          }
        : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{
        type: "spring",
        stiffness: 100,
        damping: 15,
        delay: index * 0.05,
      }}
      className={`relative col-span-1 ${variant.span} flex flex-col justify-between overflow-hidden rounded-3xl p-6 sm:p-8 ${containerClass} ${minHeight}`}
      style={tintedStyle}
    >
      {decorElement}
      <div className="relative z-10">
        <span
          className="mb-5 inline-flex size-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: chipBg, color: chipColor }}
        >
          <Check className="size-5" strokeWidth={2.5} />
        </span>
      </div>
      <div className="relative z-10">
        <h3
          className={`mb-2 font-bold leading-[1.15] tracking-tight ${titleSize} ${titleClass}`}
        >
          {title}
        </h3>
        {desc && (
          <p className={`text-sm leading-relaxed sm:text-base ${descClass}`}>
            {desc}
          </p>
        )}
      </div>
    </motion.div>
  );
}
