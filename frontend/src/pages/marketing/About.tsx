import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Compass,
  Languages,
  Lock,
  Sparkles,
  HeartHandshake,
  GraduationCap,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/marketing-i18n";

export default function AboutPage() {
  const { lang, dir } = useI18n();
  const tr = (en: string, ar: string) => (lang === "en" ? en : ar);

  const values = [
    {
      icon: Languages,
      title: { en: "Multilingual from day one", ar: "متعدد اللغات منذ اليوم الأول" },
      body: {
        en: "Arabic and English are both first-class citizens. The interface is RTL-ready, the AI understands both languages, and every comment is classified in the language it was written in — not translated and approximated.",
        ar: "العربية والإنجليزية لغتان أساسيتان معاً. الواجهة مهيّأة للقراءة من اليمين إلى اليسار، والذكاء الاصطناعي يفهم اللغتين، وكل تعليق يُصنَّف باللغة التي كُتب بها — لا تتم ترجمته أو تقريب معناه.",
      },
    },
    {
      icon: Lock,
      title: { en: "Your data is yours", ar: "بياناتك ملك لك" },
      body: {
        en: "We never sell, rent, or trade personal data. We never train third-party AI models on your individual content. Tokens are encrypted at the application layer, data lives in the EU, and you can export or delete everything in two clicks.",
        ar: "نحن لا نبيع البيانات الشخصية ولا نؤجّرها ولا نتاجر بها أبداً، ولا ندرّب نماذج ذكاء اصطناعي خارجية على محتواك الفردي. تُشفَّر الرموز على طبقة التطبيق، وتُخزَّن البيانات في الاتحاد الأوروبي، ويمكنك تصدير أو حذف كل شيء بنقرتين.",
      },
    },
    {
      icon: Sparkles,
      title: { en: "Actions, not dashboards", ar: "إجراءات، لا لوحات تحكّم" },
      body: {
        en: "Other tools throw 30 charts at you and call it analytics. Basiret tells you the three things to do today, why they matter, and what changed since last week. Five focused minutes, then back to running your business.",
        ar: "أدوات أخرى ترميك بـ 30 رسماً بيانياً وتسمّي ذلك تحليلات. بصيرة تخبرك بالأشياء الثلاثة التي عليك فعلها اليوم، ولماذا تهم، وما الذي تغيّر منذ الأسبوع الماضي. خمس دقائق مركّزة، ثم تعود لإدارة عملك.",
      },
    },
    {
      icon: HeartHandshake,
      title: { en: "Built for owners, not agencies", ar: "صُمّم لأصحاب الأعمال لا للوكالات" },
      body: {
        en: "Basiret is priced and designed for the owner of a small shop, the freelance photographer, the family-run café — people who post their own content and don't have a marketing team. Pro is less than a weekly coffee run.",
        ar: "بصيرة مُسعَّرة ومُصمَّمة لصاحب المحل الصغير، والمصوّر المستقل، والمقهى العائلي — الأشخاص الذين ينشرون محتواهم بأنفسهم ولا يملكون فريق تسويق. خطة Pro بأقل من قهوة أسبوع.",
      },
    },
  ];

  const stats = [
    { value: "11", label: { en: "Product screens", ar: "شاشة في المنتج" } },
    { value: "EN + AR", label: { en: "Full bilingual UI", ar: "واجهة ثنائية اللغة كاملة" } },
    { value: "100%", label: { en: "Test coverage on critical paths", ar: "تغطية اختبار للمسارات الحرجة" } },
    { value: "EU", label: { en: "Where your data lives", ar: "موقع تخزين بياناتك" } },
  ];

  return (
    <main dir={dir} className="pt-16">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F5F3FF] via-white to-white py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#5433c2]/20 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#5433c2] backdrop-blur"
          >
            <Compass className="size-3.5" />
            {tr("About Basiret", "نبذة عن بصيرة")}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="text-4xl font-bold leading-tight tracking-tight text-[#484848] sm:text-5xl md:text-6xl"
          >
            {tr(
              "Insight, in any language, for the people who actually run the business.",
              "بصيرة، بأي لغة، للأشخاص الذين يديرون العمل فعلاً."
            )}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600"
          >
            {tr(
              "Basiret is an AI-powered social media analytics product built for small businesses and creators in Arabic-speaking and bilingual markets — the audiences that the big tools were never designed for.",
              "بصيرة منتج لتحليلات وسائل التواصل الاجتماعي مدعوم بالذكاء الاصطناعي، صُمِّم خصيصاً للشركات الصغيرة وصُنّاع المحتوى في الأسواق الناطقة بالعربية والمتعدّدة اللغات — وهي جمهور لم تُصمَّم له الأدوات الكبرى أصلاً."
            )}
          </motion.p>
        </div>
      </section>

      {/* Mission */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-[#F5F3FF]/40 p-8 sm:p-12">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#5433c2]">
              {tr("Our mission", "مهمتنا")}
            </p>
            <h2 className="mb-5 text-2xl font-bold text-[#484848] sm:text-3xl">
              {tr(
                "Make insight accessible — without the marketing degree, the agency retainer, or the language barrier.",
                "أن نجعل البصيرة في متناول الجميع — بدون شهادة في التسويق أو وكالة بأجر شهري أو حاجز لغوي."
              )}
            </h2>
            <p className="text-base leading-relaxed text-gray-600 sm:text-lg">
              {tr(
                `The owner of a coffee shop in Muscat shouldn't need to know what "engagement velocity" means to grow on Instagram. They should open one screen, see the three things worth doing today, do them in five minutes, and get back to making coffee. That's what Basiret is built to do — and we do it in the language our customers actually speak.`,
                `صاحب مقهى في مسقط لا يجب أن يعرف معنى "سرعة التفاعل" لينمو على إنستغرام. عليه أن يفتح شاشة واحدة، ويرى الأشياء الثلاثة التي تستحق العمل عليها اليوم، ويُنجزها في خمس دقائق، ثم يعود لتحضير القهوة. هذا ما صُمّمت بصيرة لفعله — ونحن نفعله باللغة التي يتحدّثها عملاؤنا فعلاً.`
              )}
            </p>
          </div>
        </div>
      </section>

      {/* The differentiator */}
      <section className="bg-[#F5F3FF]/40 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#5433c2]">
            {tr("What makes us different", "ما يميّزنا")}
          </p>
          <h2 className="mb-5 text-2xl font-bold text-[#484848] sm:text-3xl">
            {tr(
              "Per-comment multilingual sentiment analysis — the one feature Meta Business Suite doesn't offer.",
              "تحليل مشاعر متعدد اللغات لكل تعليق على حدة — الميزة الوحيدة التي لا توفّرها أدوات Meta للأعمال."
            )}
          </h2>
          <p className="mb-6 text-base leading-relaxed text-gray-600 sm:text-lg">
            {tr(
              `Most analytics tools count comments. Meta Business Suite shows you raw text and totals. Basiret reads every comment — Arabic or English — through a multilingual classifier (XLM-RoBERTa, the model used by academic researchers), labels it positive, neutral, or negative, and shows you the comment feed colour-coded by sentiment with Arabic text rendered right-to-left automatically.`,
              `معظم أدوات التحليلات تكتفي بعدّ التعليقات. وأدوات Meta للأعمال تعرض لك النص الخام والمجاميع. بصيرة تقرأ كل تعليق — عربي أو إنجليزي — عبر مُصنِّف متعدد اللغات (XLM-RoBERTa، النموذج الذي يستخدمه الباحثون الأكاديميون)، وتُصنّفه إيجابياً أو محايداً أو سلبياً، وتعرض لك خلاصة التعليقات مُلوَّنة حسب المشاعر مع عرض النص العربي من اليمين إلى اليسار تلقائياً.`
            )}
          </p>
          <p className="text-base leading-relaxed text-gray-600 sm:text-lg">
            {tr(
              "It means a small business in Riyadh finally knows whether its launch post is being celebrated or quietly dragged in the comments — without copying every comment into Google Translate.",
              "هذا يعني أن مشروعاً صغيراً في الرياض يستطيع أخيراً معرفة ما إذا كان منشور إطلاقه يُحتفى به أم يُنتقد بهدوء في التعليقات — بدون نسخ كل تعليق إلى Google Translate."
            )}
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#5433c2]">
              {tr("Our principles", "مبادئنا")}
            </p>
            <h2 className="text-3xl font-bold text-[#484848] sm:text-4xl">
              {tr("Four things we don't compromise on", "أربعة أشياء لا نتنازل عنها")}
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {values.map((v) => {
              const Icon = v.icon;
              return (
                <div
                  key={v.title.en}
                  className="rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:border-[#5433c2]/30 hover:shadow-lg sm:p-8"
                >
                  <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-[#5433c2]/10 text-[#5433c2]">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mb-2 text-lg font-semibold text-[#484848]">
                    {tr(v.title.en, v.title.ar)}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-600">
                    {tr(v.body.en, v.body.ar)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-[#F5F3FF]/40 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid gap-8 rounded-3xl border border-gray-200 bg-white px-6 py-10 sm:grid-cols-2 sm:px-10 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.value} className="text-center">
                <div className="mb-2 text-3xl font-bold text-[#5433c2] sm:text-4xl">
                  {s.value}
                </div>
                <div className="text-xs font-medium leading-snug text-gray-500 sm:text-sm">
                  {tr(s.label.en, s.label.ar)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-10 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#5433c2]/10 text-[#5433c2]">
              <GraduationCap className="size-5" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#5433c2]">
              {tr("Our story", "قصتنا")}
            </p>
          </div>
          <h2 className="mb-6 text-3xl font-bold text-[#484848] sm:text-4xl">
            {tr(
              "From a graduation project to a product that ships every week.",
              "من مشروع تخرّج إلى منتج يُحدَّث كل أسبوع."
            )}
          </h2>
          <div className="space-y-5 text-base leading-relaxed text-gray-600 sm:text-lg">
            <p>
              {tr(
                "Basiret started as a senior capstone project at Near East University — a question, really: why is every meaningful analytics product built around English-speaking users with marketing budgets, when the people who need it most are running shops in Arabic-speaking markets with no marketing team at all?",
                "بدأت بصيرة مشروع تخرّج في جامعة الشرق الأدنى — في الحقيقة كانت سؤالاً: لماذا تُبنى كل منتجات التحليلات الجادّة حول مستخدمين يتحدّثون الإنجليزية ولديهم ميزانيات تسويق، بينما من يحتاجونها أكثر هم أصحاب محلات في أسواق عربية بدون فريق تسويق إطلاقاً؟"
              )}
            </p>
            <p>
              {tr(
                "We built the answer: a multi-tenant analytics platform that connects to Instagram Business, runs every comment through an academic-grade multilingual sentiment classifier, and turns the noise into three actions a day. The product shipped, paying customers signed up, and Leader Smart Technology — a company registered in the Sultanate of Oman — was incorporated to operate it.",
                "وبنينا الإجابة: منصّة تحليلات متعدّدة المستأجرين ترتبط بـ Instagram Business، وتُمرِّر كل تعليق عبر مُصنِّف مشاعر متعدّد اللغات بمستوى أكاديمي، وتُحوِّل الضوضاء إلى ثلاث إجراءات يومية. أُطلق المنتج، واشترك عملاء يدفعون، وأُسِّست شركة Leader Smart Technology — مسجَّلة في سلطنة عُمان — لتشغيله."
              )}
            </p>
            <p>
              {tr(
                "We're a small team. We answer our own support emails. We ship features when they're ready, not when a quarter ends. And we keep the price honest because we know who our customer is — the owner who's open at 7am and closing at 11pm, not the agency with a Slack workspace full of growth analysts.",
                "نحن فريق صغير. نردّ على رسائل الدعم بأنفسنا. نُطلق الميزات حين تجهز، لا حين ينتهي ربع العام. ونحافظ على أسعار صادقة لأننا نعرف عميلنا — صاحب العمل الذي يفتح الساعة 7 صباحاً ويُغلق الساعة 11 مساءً، لا الوكالة التي تملك Slack مليء بمحلّلي النمو."
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Operator info */}
      <section className="bg-white pb-16 sm:pb-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-6 sm:p-8">
            <h3 className="mb-3 text-base font-semibold text-[#484848]">
              {tr("Operator and contact", "المُشغِّل والتواصل")}
            </h3>
            <div className="space-y-1 text-sm leading-relaxed text-gray-600">
              <p>
                <span className="font-medium text-[#484848]">
                  {tr("Operator: ", "المُشغِّل: ")}
                </span>
                {tr(
                  "Leader Smart Technology, registered in the Sultanate of Oman.",
                  "Leader Smart Technology، مسجَّلة في سلطنة عُمان."
                )}
              </p>
              <p>
                <span className="font-medium text-[#484848]">
                  {tr("General: ", "عام: ")}
                </span>
                <a
                  href="mailto:contact@basiret.co"
                  className="text-[#5433c2] hover:underline"
                >
                  contact@basiret.co
                </a>
              </p>
              <p>
                <span className="font-medium text-[#484848]">
                  {tr("Privacy & data requests: ", "الخصوصية وطلبات البيانات: ")}
                </span>
                <a
                  href="mailto:contact@basiret.co"
                  className="text-[#5433c2] hover:underline"
                >
                  contact@basiret.co
                </a>
              </p>
              <p className="pt-2 text-xs text-gray-500">
                {tr(
                  "See our Privacy Policy and Terms of Service for the full legal detail.",
                  "اطّلع على سياسة الخصوصية وشروط الخدمة للحصول على التفاصيل القانونية الكاملة."
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-[#5433c2] to-[#4527a8] py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            {tr("Try it for free. Stay if it earns the price.", "جرّبها مجاناً. وابقَ إذا استحقّت ثمنها.")}
          </h2>
          <p className="mb-8 text-base leading-relaxed text-white/80 sm:text-lg">
            {tr(
              "Set up takes ten minutes. The Starter plan is free forever. No credit card.",
              "الإعداد يستغرق عشر دقائق. خطة Starter مجانية للأبد. لا حاجة لبطاقة ائتمان."
            )}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/register">
              <Button className="bg-white text-[#5433c2] hover:bg-gray-100 font-semibold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]">
                {tr("Start free", "ابدأ مجاناً")}
                <ArrowRight className="ms-2 size-4 rtl:rotate-180" />
              </Button>
            </Link>
            <Link
              to="/pricing"
              className="text-sm font-medium text-white/90 transition-colors hover:text-white"
            >
              {tr("See pricing", "اطلع على الأسعار")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
