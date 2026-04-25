import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { ComponentType, SVGProps } from "react";
import { ArrowRight, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/marketing-i18n";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export type MarketingComingSoonProps = {
  eyebrow: { en: string; ar: string };
  title: { en: string; ar: string };
  subtitle: { en: string; ar: string };
  icon?: IconComponent;
};

/**
 * Marketing-site "coming soon" template (channels/x, channels/linkedin,
 * resources/templates, etc.). Distinct from the in-app ComingSoon page at
 * frontend/src/pages/ComingSoon.tsx which is for protected routes.
 */
export function MarketingComingSoon({ eyebrow, title, subtitle, icon: Icon = Sparkles }: MarketingComingSoonProps) {
  const { t, lang, dir } = useI18n();
  const tr = (b: { en: string; ar: string }) => (lang === "en" ? b.en : b.ar);

  return (
    <main dir={dir} className="pt-16 min-h-screen">
      <section className="relative flex items-center justify-center min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-br from-[#F5F3FF] via-white to-[#EEEDFE] py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(102,79,161,0.15) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(191,73,155,0.1) 0%, transparent 40%)",
          }}
        />
        <div className="relative mx-auto max-w-2xl px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
          >
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-[#664FA1]/10 text-[#664FA1]">
              <Icon className="size-7" />
            </div>
            <span className="mb-4 inline-block rounded-full bg-[#664FA1]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#664FA1]">
              {tr(eyebrow)}
            </span>
            <h1 className="mb-5 text-4xl font-bold leading-[1.1] tracking-tight text-[#484848] sm:text-5xl md:text-6xl">
              {tr(title)}
            </h1>
            <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-gray-600 sm:text-xl">
              {tr(subtitle)}
            </p>
            <form className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row" onSubmit={(e) => e.preventDefault()}>
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-gray-400 rtl:left-auto rtl:right-3" />
                <input
                  type="email"
                  placeholder={t("Enter your email...", "أدخل بريدك الإلكتروني...")}
                  className="h-12 w-full rounded-xl border border-gray-300 bg-white/90 backdrop-blur-sm ps-10 pe-4 text-base text-[#484848] placeholder:text-gray-400 focus:border-[#664FA1] focus:outline-none focus:ring-2 focus:ring-[#664FA1]/20 transition-all shadow-sm sm:text-sm"
                />
              </div>
              <Button
                type="submit"
                className="h-12 w-full rounded-xl bg-[#664FA1] px-6 font-semibold text-white hover:bg-[#5A4590] cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#664FA1]/25 sm:w-auto"
              >
                {t("Notify me", "نبّهني")}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Button>
            </form>
            <p className="mt-4 text-sm text-gray-500">
              {t("We'll email you the moment it's live.", "سنرسل لك بريداً إلكترونياً بمجرد إطلاقها.")}
            </p>
            <div className="mt-10">
              <Link
                to="/"
                className="text-sm text-[#664FA1] hover:text-[#5A4590] transition-colors"
              >
                {t("← Back to home", "← العودة إلى الرئيسية")}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
