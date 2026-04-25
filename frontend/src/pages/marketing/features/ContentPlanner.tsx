import { Calendar } from "lucide-react";
import { ProductPage } from "@/components/page-templates/product-page";

export default function ContentPlannerPage() {
  return (
    <ProductPage
      icon={Calendar}
      accent="#664FA1"
      eyebrow={{ en: "Content Planner", ar: "مخطط المحتوى" }}
      title={{
        en: "Plan a month of posts in an hour",
        ar: "خطط لمحتوى شهر كامل في ساعة",
      }}
      subtitle={{
        en: "A calendar that tells you what to post and when. Drag, drop, schedule — or let Basiret suggest the whole week based on what your audience actually responds to.",
        ar: "تقويم يخبرك بما تنشر ومتى. اسحب، أسقط، جدول — أو دع بصيرة تقترح الأسبوع كاملاً بناءً على ما يستجيب له جمهورك فعلاً.",
      }}
      heroImage="https://images.unsplash.com/photo-1493552152660-f915ab47ae9d?q=80&w=2000&auto=format&fit=crop"
      heroImageAlt={{
        en: "Desk with planner and phone",
        ar: "مكتب به مخطط وهاتف",
      }}
      steps={[
        {
          title: { en: "Pick your pillars", ar: "اختر محاورك" },
          desc: {
            en: "Tell Basiret the 3–5 themes your brand owns. Everything else auto-aligns.",
            ar: "أخبر بصيرة بالـ 3-5 محاور التي تمثّل علامتك. كل شيء آخر يتماشى تلقائياً.",
          },
        },
        {
          title: { en: "Get a month of ideas", ar: "احصل على أفكار شهر" },
          desc: {
            en: "AI-drafted captions, hashtags, and timing — you edit in place or accept with one click.",
            ar: "نصوص وهاشتاقات وتوقيت مُولَّدة بالذكاء الاصطناعي — عدّلها في مكانها أو اقبلها بنقرة.",
          },
        },
        {
          title: { en: "Schedule and forget", ar: "جدوِل وانسَ" },
          desc: {
            en: "One-click publishing to all channels with smart time slots based on YOUR audience.",
            ar: "نشر بنقرة واحدة إلى جميع القنوات مع فترات زمنية ذكية مبنية على جمهورك.",
          },
        },
      ]}
      bullets={[
        { en: "Visual calendar across all your connected platforms", ar: "تقويم مرئي عبر جميع منصاتك المتصلة" },
        { en: "Suggested posting times based on when your audience is online", ar: "أوقات نشر مقترحة بناءً على متى يكون جمهورك متصلاً" },
        { en: "AI-generated captions and hashtags ready to edit", ar: "نصوص وهاشتاقات مولّدة بالذكاء الاصطناعي جاهزة للتعديل" },
        { en: "Content templates for launches, sales, and seasonal campaigns", ar: "قوالب محتوى للإطلاقات والعروض والحملات الموسمية" },
        { en: "Bulk schedule with drag-and-drop rescheduling", ar: "جدولة مجمعة مع إعادة جدولة بالسحب والإفلات" },
        { en: "Approval workflows for teams and agency clients", ar: "سير عمل الموافقة للفرق وعملاء الوكالات" },
      ]}
      cta={{ label: { en: "Start free", ar: "ابدأ مجاناً" }, href: "/register" }}
    />
  );
}
