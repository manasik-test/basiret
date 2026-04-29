import { Store } from "lucide-react";
import { ProductPage } from "@/components/page-templates/product-page";

export default function SmallBusinessPage() {
  return (
    <ProductPage
      icon={Store}
      accent="#5433c2"
      eyebrow={{ en: "For small businesses", ar: "للشركات الصغيرة" }}
      title={{
        en: "Grow your business without hiring a marketing team",
        ar: "نمِّ عملك دون توظيف فريق تسويق",
      }}
      subtitle={{
        en: "You run the shop, answer DMs, handle suppliers, AND post online? Basiret cuts social media down to 5 focused minutes a day. You'll still know exactly what to do.",
        ar: "أنت تدير المحل، تردّ على الرسائل، تتعامل مع الموردين، وتنشر أيضاً؟ بصيرة تختصر وسائل التواصل إلى 5 دقائق مركّزة يومياً. وستظل تعرف بالضبط ما تفعله.",
      }}
      heroImage="https://images.unsplash.com/photo-1703622377707-29bc9409aaf2?q=80&w=2000&auto=format&fit=crop"
      heroImageAlt={{
        en: "Small business owner managing their shop",
        ar: "صاحب عمل صغير يدير محله",
      }}
      steps={[
        {
          title: { en: "Set up in 10 minutes", ar: "جهّز في 10 دقائق" },
          desc: {
            en: "Connect your social accounts, tell Basiret your city and industry — done.",
            ar: "اربط حسابات التواصل، أخبر بصيرة بمدينتك ومجالك — انتهى.",
          },
        },
        {
          title: { en: "Do 3 things each morning", ar: "قم بـ 3 أشياء كل صباح" },
          desc: {
            en: "Your focused plan is waiting. Five minutes — post, reply, adjust. Back to running the business.",
            ar: "خطتك المركّزة تنتظر. خمس دقائق — انشر، ردّ، عدّل. وعد لإدارة العمل.",
          },
        },
        {
          title: { en: "Watch local growth compound", ar: "شاهد النمو المحلي يتراكم" },
          desc: {
            en: "Weekly report: what worked, new followers by city, saves and shares that drive foot traffic.",
            ar: "تقرير أسبوعي: ما الذي نجح، المتابعون الجدد حسب المدينة، الحفظ والمشاركات التي تقود الزيارات.",
          },
        },
      ]}
      bullets={[
        { en: "Built for owners, not marketers — no jargon, no dashboards to decode", ar: "مصمم لأصحاب الأعمال لا للمسوقين — بدون مصطلحات، بدون لوحات تحكم لفك رموزها" },
        { en: "5-minute daily action plan — do 3 things, move on with your day", ar: "خطة عمل يومية من 5 دقائق — قم بـ 3 أشياء وتابع يومك" },
        { en: "Local audience focus — your real customers in your real city", ar: "التركيز على الجمهور المحلي — عملاؤك الحقيقيون في مدينتك الحقيقية" },
        { en: "Inbox triage — comments, DMs, and reviews in one place", ar: "فرز صندوق الوارد — التعليقات والرسائل والمراجعات في مكان واحد" },
        { en: "Affordable — starts free, Pro is less than a weekly coffee run", ar: "بأسعار معقولة — مجاني للبدء، والخطة الاحترافية أقل من قهوة الأسبوع" },
        { en: "Set it up in 10 minutes. Grow for the next 10 years.", ar: "جهّزها في 10 دقائق. وانمُ للعشر سنوات القادمة." },
      ]}
      cta={{ label: { en: "Start free — no credit card", ar: "ابدأ مجاناً — بدون بطاقة" }, href: "/register" }}
      secondaryCta={{ label: { en: "See pricing", ar: "اطلع على الأسعار" }, href: "/pricing" }}
    />
  );
}
