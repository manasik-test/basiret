import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";
import { useI18n } from "@/lib/marketing-i18n";

type Bilingual = { en: string; ar: string };
type CellValue = boolean | Bilingual;

type Row = {
  feature: Bilingual;
  values: [CellValue, CellValue, CellValue];
};

const planHeaders: Bilingual[] = [
  { en: "Free", ar: "مجاني" },
  { en: "Pro", ar: "احترافي" },
  { en: "Enterprise", ar: "المؤسسات" },
];

const rows: Row[] = [
  {
    feature: { en: "Connected social accounts", ar: "حسابات التواصل المتصلة" },
    values: [
      { en: "1", ar: "1" },
      { en: "5", ar: "5" },
      { en: "Unlimited", ar: "غير محدود" },
    ],
  },
  {
    feature: { en: "Action recommendations", ar: "التوصيات العملية" },
    values: [
      { en: "5 / month", ar: "5 / شهرياً" },
      { en: "Unlimited", ar: "غير محدود" },
      { en: "Unlimited", ar: "غير محدود" },
    ],
  },
  {
    feature: { en: "Data history", ar: "سجل البيانات" },
    values: [
      { en: "7 days", ar: "7 أيام" },
      { en: "12 months", ar: "12 شهراً" },
      { en: "Unlimited", ar: "غير محدود" },
    ],
  },
  {
    feature: { en: "Audience persona insights", ar: "رؤى شخصيات الجمهور" },
    values: [false, true, true],
  },
  {
    feature: { en: "Per-comment sentiment analysis", ar: "تحليل المشاعر لكل تعليق" },
    values: [false, true, true],
  },
  {
    feature: { en: "AI weekly insights & report", ar: "الرؤى الأسبوعية بالذكاء الاصطناعي" },
    values: [false, true, true],
  },
  {
    feature: { en: "AI caption generator", ar: "مُولِّد نصوص المنشورات" },
    values: [false, true, true],
  },
  {
    feature: { en: "Audience segmentation (K-means)", ar: "شرائح الجمهور" },
    values: [false, true, true],
  },
  {
    feature: { en: "Content recommendations", ar: "توصيات المحتوى" },
    values: [false, true, true],
  },
  {
    feature: { en: "Competitor tracking", ar: "تتبع المنافسين" },
    values: [false, true, true],
  },
  {
    feature: { en: "Team workspaces & roles", ar: "مساحات الفرق والأدوار" },
    values: [false, false, true],
  },
  {
    feature: { en: "White-label PDF reports", ar: "تقارير PDF بعلامة بيضاء" },
    values: [false, false, true],
  },
  {
    feature: { en: "SSO (SAML) & audit logs", ar: "تسجيل دخول موحّد وسجلات تدقيق" },
    values: [false, false, true],
  },
  {
    feature: { en: "Dedicated account manager", ar: "مدير حساب مخصص" },
    values: [false, false, true],
  },
  {
    feature: { en: "SLA-backed uptime", ar: "ضمان وقت التشغيل (SLA)" },
    values: [false, false, true],
  },
  {
    feature: { en: "Support", ar: "الدعم" },
    values: [
      { en: "Email", ar: "بريد إلكتروني" },
      { en: "Priority", ar: "أولوية" },
      { en: "24/7 dedicated", ar: "مخصص 24/7" },
    ],
  },
];

export function ComparisonTable() {
  const { t, lang, dir } = useI18n();
  const tr = (b: Bilingual) => (lang === "en" ? b.en : b.ar);

  return (
    <section dir={dir} className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
          className="mb-10 text-center"
        >
          <h2 className="mb-3 text-3xl font-bold text-[#484848] sm:text-4xl">
            {t("Compare every feature", "قارن كل ميزة")}
          </h2>
          <p className="mx-auto max-w-2xl text-base text-gray-500 sm:text-lg">
            {t(
              "A side-by-side breakdown so you can pick the plan that fits.",
              "مقارنة جنباً إلى جنب لاختيار الخطة الأنسب لك."
            )}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
          className="overflow-x-auto rounded-2xl border border-gray-200 bg-white"
        >
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th
                  scope="col"
                  className={`border-b border-gray-200 px-4 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6 ${
                    lang === "ar" ? "text-right" : "text-left"
                  }`}
                >
                  {t("Features", "الميزات")}
                </th>
                {planHeaders.map((h, idx) => (
                  <th
                    key={h.en}
                    scope="col"
                    className={`border-b border-gray-200 px-4 py-4 text-center text-sm font-semibold sm:px-6 ${
                      idx === 1 ? "text-[#5433c2]" : "text-[#484848]"
                    }`}
                  >
                    {tr(h)}
                    {idx === 1 && (
                      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-[#5433c2]/70">
                        {t("Most Popular", "الأكثر شعبية")}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.feature.en}
                  className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                >
                  <td
                    className={`px-4 py-3.5 text-sm text-gray-700 sm:px-6 ${
                      lang === "ar" ? "text-right" : "text-left"
                    }`}
                  >
                    {tr(row.feature)}
                  </td>
                  {row.values.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-4 py-3.5 text-center text-sm sm:px-6 ${
                        j === 1 ? "bg-[#5433c2]/[0.03]" : ""
                      }`}
                    >
                      {typeof cell === "boolean" ? (
                        cell ? (
                          <Check
                            className={`mx-auto size-4 ${
                              j === 1 ? "text-[#5433c2]" : "text-emerald-500"
                            }`}
                            aria-label={t("Included", "متاح")}
                          />
                        ) : (
                          <Minus
                            className="mx-auto size-4 text-gray-300"
                            aria-label={t("Not included", "غير متاح")}
                          />
                        )
                      ) : (
                        <span className="text-gray-700">{tr(cell)}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <div className="mt-10 flex flex-col items-center justify-center gap-2 text-center sm:flex-row sm:gap-4">
          <p className="text-sm text-gray-500 sm:text-base">
            {t("Not sure which plan is right for you?", "لست متأكداً من الخطة المناسبة؟")}
          </p>
          <a
            href="mailto:contact@basiret.co"
            className="inline-flex items-center gap-2 rounded-full bg-[#5433c2] px-5 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#4527a8] hover:shadow-lg"
          >
            {t("Contact us", "تواصل معنا")}
          </a>
        </div>
      </div>
    </section>
  );
}
