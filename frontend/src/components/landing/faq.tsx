import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { useI18n } from "@/lib/marketing-i18n";

const faqs = [
  {
    en: { q: "What makes Basiret different from other analytics tools?", a: "Most analytics tools give you charts and data. Basiret gives you specific actions — it tells you exactly what to post, when to post, and who to target based on real audience behavior patterns." },
    ar: { q: "ما الذي يميّز بصيرة عن أدوات التحليل الأخرى؟", a: "معظم أدوات التحليل تعطيك رسومات بيانية وبيانات. بصيرة تعطيك خطوات محددة — تخبرك بالضبط ماذا تنشر ومتى تنشر ومن تستهدف بناءً على أنماط سلوك الجمهور الحقيقية." },
  },
  {
    en: { q: "Which social media platforms do you support?", a: "We currently support Instagram, X (formerly Twitter), TikTok, and LinkedIn. Facebook and YouTube support is coming soon." },
    ar: { q: "ما المنصات الاجتماعية التي تدعمونها؟", a: "ندعم حالياً انستقرام وإكس (تويتر سابقاً) وتيك توك ولينكدإن. دعم فيسبوك ويوتيوب قريباً." },
  },
  {
    en: { q: "Is my data safe with Basiret?", a: "Absolutely. We use bank-level encryption and never sell your data. We only read your public social media metrics — we never post on your behalf or access private messages." },
    ar: { q: "هل بياناتي آمنة مع بصيرة؟", a: "بالتأكيد. نستخدم تشفيراً بمستوى البنوك ولا نبيع بياناتك أبداً. نقرأ فقط مقاييسك العامة على وسائل التواصل — لا ننشر نيابة عنك ولا نصل إلى الرسائل الخاصة." },
  },
  {
    en: { q: "Can I cancel my subscription anytime?", a: "Yes, you can cancel anytime with no questions asked. Your data will be available for 30 days after cancellation." },
    ar: { q: "هل يمكنني إلغاء اشتراكي في أي وقت؟", a: "نعم، يمكنك الإلغاء في أي وقت بدون أي أسئلة. ستكون بياناتك متاحة لمدة 30 يوماً بعد الإلغاء." },
  },
  {
    en: { q: "Do I need technical knowledge to use Basiret?", a: "Not at all. Basiret is designed for business owners, not data scientists. Connect your accounts and start getting recommendations in minutes." },
    ar: { q: "هل أحتاج معرفة تقنية لاستخدام بصيرة؟", a: "لا على الإطلاق. بصيرة مصممة لأصحاب الأعمال وليس لعلماء البيانات. اربط حساباتك وابدأ بتلقي التوصيات في دقائق." },
  },
] as const;

export function FAQ() {
  const { t, dir } = useI18n();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="faq" dir={dir} className="bg-white py-16 sm:py-24">
      <div ref={ref} className="mx-auto max-w-3xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
          className="mb-12 text-center sm:mb-16"
        >
          <h2 className="mb-4 text-3xl font-bold text-[#484848] sm:text-4xl lg:text-5xl">
            {t("Frequently asked questions", "الأسئلة الشائعة")}
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed">
            {t("Everything you need to know about Basiret", "كل ما تحتاج معرفته عن بصيرة")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.1 }}
          className="rounded-2xl border border-gray-200 bg-white p-2"
        >
          <Accordion>
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-[#484848] hover:no-underline text-base px-4">
                  {t(faq.en.q, faq.ar.q)}
                </AccordionTrigger>
                <AccordionContent className="px-4">
                  <p className="text-gray-500 leading-relaxed">{t(faq.en.a, faq.ar.a)}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
