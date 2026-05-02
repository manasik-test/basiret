import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/marketing-i18n";

type Bilingual = { en: string; ar: string };

type CTAMarqueeProps = {
  accent?: string;
  primaryCta?: { label: Bilingual; href: string };
  secondaryCta?: { label: Bilingual; href: string };
};

const features: Bilingual[] = [
  { en: "Audience insights", ar: "رؤى الجمهور" },
  { en: "Action plan", ar: "خطة العمل" },
  { en: "Content planner", ar: "مخطط المحتوى" },
  { en: "Sentiment analysis", ar: "تحليل المشاعر" },
  { en: "AI advisor", ar: "مستشار الذكاء الاصطناعي" },
  { en: "Competitor tracking", ar: "تتبع المنافسين" },
];

function VerticalMarquee({
  children,
  speed = 24,
  className,
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("group flex flex-col overflow-hidden", className)}
      style={{ ["--duration" as string]: `${speed}s` } as React.CSSProperties}
    >
      <div className="flex shrink-0 flex-col animate-marquee-vertical">
        {children}
      </div>
      <div
        className="flex shrink-0 flex-col animate-marquee-vertical"
        aria-hidden="true"
      >
        {children}
      </div>
    </div>
  );
}

export function CTAMarquee({
  accent = "#5433c2",
  primaryCta = { label: { en: "Start free", ar: "ابدأ مجاناً" }, href: "/register" },
  secondaryCta = { label: { en: "See pricing", ar: "اطلع على الأسعار" }, href: "/pricing" },
}: CTAMarqueeProps) {
  const { t, lang, dir } = useI18n();
  const tr = (b: Bilingual) => (lang === "en" ? b.en : b.ar);
  const marqueeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = marqueeRef.current;
    if (!container) return;

    let frameId = 0;
    const update = () => {
      const items = container.querySelectorAll<HTMLElement>(".marquee-item");
      const rect = container.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      items.forEach((item) => {
        const ir = item.getBoundingClientRect();
        const itemCenterY = ir.top + ir.height / 2;
        const distance = Math.abs(centerY - itemCenterY);
        const maxDistance = rect.height / 2;
        const normalized = Math.min(distance / maxDistance, 1);
        item.style.opacity = (1 - normalized * 0.8).toString();
      });
      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <section
      dir={dir}
      className="relative overflow-hidden bg-white py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left content */}
          <div className="max-w-xl space-y-6 animate-fade-in-up">
            <span
              className="inline-block text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: accent }}
            >
              {t("Ready to grow?", "هل أنت جاهز للنمو؟")}
            </span>
            <h2 className="text-4xl font-bold leading-[1.1] tracking-tight text-[#484848] sm:text-5xl md:text-6xl">
              {t("Grow your social presence with confidence", "نَمِّ حضورك على وسائل التواصل بثقة")}
            </h2>
            <p className="text-lg leading-relaxed text-gray-600 sm:text-xl">
              {t(
                "Join thousands of creators and businesses who trust Basiret to grow smarter with actions, not dashboards.",
                "انضم إلى آلاف صنّاع المحتوى والشركات الذين يثقون ببصيرة للنمو بذكاء عبر الإجراءات لا لوحات التحكم."
              )}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to={primaryCta.href}>
                <button
                  className="group relative inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    backgroundColor: accent,
                    boxShadow: `0 10px 30px -10px ${accent}66`,
                  }}
                >
                  <span className="relative z-10">{tr(primaryCta.label)}</span>
                  <ArrowRight className="relative z-10 size-4 rtl:rotate-180" />
                </button>
              </Link>
              <Link to={secondaryCta.href}>
                <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-[#484848] transition-all duration-200 hover:bg-gray-50 hover:scale-[1.02] active:scale-[0.98]">
                  {tr(secondaryCta.label)}
                </button>
              </Link>
            </div>
          </div>

          {/* Right marquee */}
          <div
            ref={marqueeRef}
            className="relative h-[440px] sm:h-[520px] lg:h-[600px]"
          >
            <div className="relative size-full">
              <VerticalMarquee speed={26} className="h-full">
                {features.map((f, idx) => (
                  <div
                    key={idx}
                    className="marquee-item py-6 text-center text-3xl font-light tracking-tight sm:text-4xl lg:text-5xl"
                    style={{ color: accent }}
                  >
                    {tr(f)}
                  </div>
                ))}
              </VerticalMarquee>
              {/* Top vignette */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-white via-white/70 to-transparent" />
              {/* Bottom vignette */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-white via-white/70 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
