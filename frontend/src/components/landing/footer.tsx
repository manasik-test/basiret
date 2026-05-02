import { Link } from "react-router-dom";
import { useI18n } from "@/lib/marketing-i18n";

type FooterLink = { en: string; ar: string; href: string };
type FooterSection = { en: string; ar: string; links: FooterLink[] };

const sections: FooterSection[] = [
  {
    en: "Product",
    ar: "المنتج",
    links: [
      { en: "Audience insights", ar: "رؤى الجمهور", href: "/features/audience" },
      { en: "Action plan", ar: "خطة العمل", href: "/features/action-plan" },
      { en: "Content planner", ar: "مخطط المحتوى", href: "/features/content-planner" },
      { en: "Pricing", ar: "الأسعار", href: "/pricing" },
    ],
  },
  {
    en: "Channels",
    ar: "المنصات",
    links: [
      { en: "Instagram", ar: "انستقرام", href: "/channels/instagram" },
      { en: "Facebook", ar: "فيسبوك", href: "/channels/facebook" },
      { en: "TikTok", ar: "تيك توك", href: "/channels/tiktok" },
      { en: "LinkedIn", ar: "لينكدإن", href: "/channels/linkedin" },
      { en: "X / Twitter", ar: "إكس / تويتر", href: "/channels/x" },
    ],
  },
  {
    en: "Made for",
    ar: "مصمم لـ",
    links: [
      { en: "Small businesses", ar: "الشركات الصغيرة", href: "/for/small-business" },
      { en: "Creators", ar: "المبدعون", href: "/for/creators" },
      { en: "Agencies", ar: "الوكالات", href: "/for/agencies" },
      { en: "Enterprise", ar: "المؤسسات", href: "/for/enterprise" },
    ],
  },
  {
    en: "Resources",
    ar: "الموارد",
    links: [
      { en: "Blog", ar: "المدونة", href: "/blog" },
      { en: "About us", ar: "من نحن", href: "/about" },
      { en: "Privacy", ar: "الخصوصية", href: "/privacy" },
      { en: "Terms", ar: "الشروط", href: "/terms" },
    ],
  },
];

export function Footer() {
  const { t, lang, dir } = useI18n();
  const tr = (en: string, ar: string) => (lang === "en" ? en : ar);

  return (
    <footer dir={dir} className="border-t border-gray-200 bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 sm:gap-12 md:grid-cols-5">
          <div className="sm:col-span-2 md:col-span-1">
            <Link to="/" className="text-lg font-bold text-[#484848]">
              Basiret <span className="text-[#5433c2]">|</span>{" "}
              <span className="font-tajawal">بصيرة</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-gray-500 leading-relaxed">
              {t(
                "Smart social media analytics for SME owners. Actions, not dashboards.",
                "تحليلات ذكية لوسائل التواصل لأصحاب المنشآت الصغيرة. خطوات عملية وليست لوحات تحكم."
              )}
            </p>
            <div className="mt-4 flex gap-3">
              {[
                { label: "X", href: "#" },
                { label: "In", href: "#" },
                { label: "Ig", href: "#" },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="flex size-9 items-center justify-center rounded-lg border border-gray-200 text-xs font-semibold text-gray-500 transition-all hover:border-[#5433c2]/30 hover:bg-[#5433c2]/5 hover:text-[#5433c2] cursor-pointer"
                >
                  {social.label}
                </a>
              ))}
            </div>
          </div>

          {sections.map((section, i) => (
            <div key={i}>
              <h4 className="mb-4 text-sm font-semibold text-[#484848]">
                {tr(section.en, section.ar)}
              </h4>
              <ul className="space-y-2.5">
                {section.links.map((link, j) => (
                  <li key={j}>
                    <Link
                      to={link.href}
                      className="text-sm text-gray-500 transition-colors hover:text-[#5433c2] cursor-pointer"
                    >
                      {tr(link.en, link.ar)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-gray-200 pt-8 text-center text-sm text-gray-500">
          <p>
            {t(
              `© ${new Date().getFullYear()} Basiret. All rights reserved.`,
              `© ${new Date().getFullYear()} بصيرة. جميع الحقوق محفوظة.`
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
