import { Sparkles } from "lucide-react";
import { ProductPage } from "@/components/page-templates/product-page";

export default function ActionPlanPage() {
  return (
    <ProductPage
      icon={Sparkles}
      accent="#BF499B"
      eyebrow={{ en: "Action Plan", ar: "خطة العمل" }}
      title={{
        en: "Three actions a day. That's it.",
        ar: "ثلاثة إجراءات يومياً. هذا كل شيء.",
      }}
      subtitle={{
        en: "Every morning, Basiret gives you exactly 3 things to do — with the data behind each one. No dashboards to decode. Just do them and watch your numbers move.",
        ar: "كل صباح، تعطيك بصيرة 3 أشياء للقيام بها بالضبط — مع البيانات وراء كل منها. لا لوحات تحكم لفك رموزها. فقط قم بها وشاهد أرقامك تتحرك.",
      }}
      stepImages={[
        { src: "/marketing/prod-home.png", alt: { en: "Daily action plan home", ar: "الصفحة الرئيسية لخطة العمل" } },
        { src: "/marketing/dashboard-1440.png", alt: { en: "Performance dashboard", ar: "لوحة الأداء" } },
        { src: "/marketing/myposts.png", alt: { en: "My posts performance", ar: "أداء منشوراتي" } },
      ]}
      steps={[
        {
          title: { en: "Morning scan", ar: "فحص الصباح" },
          desc: {
            en: "Basiret reviews your last 7 days of data and spots the three highest-leverage moves for today.",
            ar: "تراجع بصيرة بيانات آخر 7 أيام وتكتشف الحركات الثلاث الأعلى تأثيراً لليوم.",
          },
        },
        {
          title: { en: "Do the three", ar: "قم بالثلاثة" },
          desc: {
            en: "Five minutes total. Post a specific format, reply to X comments, adjust Y in your bio — Basiret tells you which and why.",
            ar: "خمس دقائق إجمالاً. انشر صيغة محددة، ردّ على X تعليقاً، عدّل Y في سيرتك — بصيرة تخبرك بالماذا والسبب.",
          },
        },
        {
          title: { en: "Watch results compound", ar: "شاهد النتائج تتراكم" },
          desc: {
            en: "Weekly review shows which actions drove growth. Basiret learns and refines your plan.",
            ar: "المراجعة الأسبوعية تظهر الإجراءات التي قادت النمو. بصيرة تتعلم وتصقل خطتك.",
          },
        },
      ]}
      bullets={[
        { en: "A focused daily plan — never more than 3 actions", ar: "خطة يومية مركّزة — لا تتجاوز 3 إجراءات" },
        { en: "Each action explains its 'why' with audience data", ar: "كل إجراء يشرح 'لماذا' مع بيانات الجمهور" },
        { en: "Prioritized by potential impact on growth", ar: "مرتبة حسب التأثير المحتمل على النمو" },
        { en: "Check off as you go — Basiret learns what works for you", ar: "ضع علامة أثناء عملك — بصيرة تتعلم ما يناسبك" },
        { en: "Weekly review shows which actions drove real results", ar: "المراجعة الأسبوعية تُظهر الإجراءات التي أسفرت عن نتائج حقيقية" },
        { en: "Works in 5 minutes a day — built for busy owners", ar: "يعمل في 5 دقائق يومياً — مصمم لأصحاب الأعمال المشغولين" },
      ]}
      cta={{ label: { en: "Start free", ar: "ابدأ مجاناً" }, href: "/register" }}
      secondaryCta={{ label: { en: "How it works", ar: "كيف يعمل" }, href: "/" }}
    />
  );
}
