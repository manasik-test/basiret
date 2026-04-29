import { Users } from "lucide-react";
import { ProductPage } from "@/components/page-templates/product-page";

export default function AudiencePage() {
  return (
    <ProductPage
      icon={Users}
      accent="#5433c2"
      eyebrow={{ en: "Audience Insights", ar: "رؤى الجمهور" }}
      title={{
        en: "Know exactly who's watching you",
        ar: "اعرف بالضبط من يشاهدك",
      }}
      subtitle={{
        en: "Basiret reads your audience like a detective — their age, interests, when they scroll, and what makes them hit follow. Real behavior, not vanity metrics.",
        ar: "بصيرة تقرأ جمهورك كمحقق — أعمارهم، اهتماماتهم، متى يتصفحون، وما يجعلهم يضغطون على المتابعة. سلوك حقيقي، لا مقاييس سطحية.",
      }}
      heroImage="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2000&auto=format&fit=crop"
      heroImageAlt={{
        en: "Analytics dashboard on a laptop",
        ar: "لوحة تحليلات على حاسوب محمول",
      }}
      steps={[
        {
          title: { en: "Connect your accounts", ar: "اربط حساباتك" },
          desc: {
            en: "One-click OAuth with Instagram, Facebook, TikTok — no passwords, no scraping.",
            ar: "ربط بنقرة واحدة مع انستقرام وفيسبوك وتيك توك — بدون كلمات مرور، بدون كشط.",
          },
        },
        {
          title: { en: "Basiret reads the signals", ar: "بصيرة تقرأ الإشارات" },
          desc: {
            en: "We analyze engagement patterns across every post to build personas from real behavior.",
            ar: "نحلل أنماط التفاعل عبر كل منشور لبناء شخصيات من سلوك حقيقي.",
          },
        },
        {
          title: { en: "See your audience clearly", ar: "رَ جمهورك بوضوح" },
          desc: {
            en: "Age, location, language, interests, best times online — all in one view.",
            ar: "العمر، الموقع، اللغة، الاهتمامات، أفضل أوقات الاتصال — كلها في عرض واحد.",
          },
        },
      ]}
      bullets={[
        { en: "Detailed audience personas built from real engagement patterns", ar: "شخصيات جمهور مفصلة مبنية من أنماط تفاعل حقيقية" },
        { en: "Demographic breakdown by age, location, and language", ar: "تفصيل ديموغرافي حسب العمر والموقع واللغة" },
        { en: "Best posting times calculated from when YOUR audience is active", ar: "أفضل أوقات النشر محسوبة من متى يكون جمهورك نشطاً" },
        { en: "Interest signals — what topics your followers actually engage with", ar: "إشارات الاهتمام — ما المواضيع التي يتفاعل معها متابعوك فعلاً" },
        { en: "Growth vs. churn — see who's sticking and who's slipping away", ar: "النمو مقابل الانسحاب — شاهد من يبقى ومن يبتعد" },
        { en: "Cross-platform view — the full picture across Instagram, TikTok, Facebook", ar: "عرض متعدد المنصات — الصورة الكاملة عبر انستقرام وتيك توك وفيسبوك" },
      ]}
      cta={{ label: { en: "Start free", ar: "ابدأ مجاناً" }, href: "/register" }}
      secondaryCta={{ label: { en: "See pricing", ar: "اطلع على الأسعار" }, href: "/pricing" }}
    />
  );
}
