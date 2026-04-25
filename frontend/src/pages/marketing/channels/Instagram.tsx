import { InstagramIcon } from "@/components/ui/social-icons";
import { ProductPage } from "@/components/page-templates/product-page";

export default function InstagramChannelPage() {
  return (
    <ProductPage
      icon={InstagramIcon}
      accent="#D62976"
      eyebrow={{ en: "Basiret for Instagram", ar: "بصيرة لانستقرام" }}
      title={{
        en: "Grow on Instagram without guessing",
        ar: "انمُ على انستقرام دون تخمين",
      }}
      subtitle={{
        en: "Reels, carousels, Stories, Lives — we track them all and tell you which format, time, and topic moves your numbers.",
        ar: "ريلز، كاروسيل، ستوريز، لايف — نتتبعها جميعاً ونخبرك بأي شكل ووقت وموضوع يحرك أرقامك.",
      }}
      heroImage="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=2000&auto=format&fit=crop"
      heroImageAlt={{
        en: "Creator reviewing Instagram performance",
        ar: "مبدع يراجع أداء انستقرام",
      }}
      steps={[
        {
          title: { en: "Connect Instagram", ar: "اربط انستقرام" },
          desc: {
            en: "OAuth with your Business or Creator account — 30 seconds, no password sharing.",
            ar: "OAuth مع حسابك التجاري أو حساب المبدع — 30 ثانية، بدون مشاركة كلمة المرور.",
          },
        },
        {
          title: { en: "Basiret analyzes Reels, Stories, Posts", ar: "بصيرة تحلل الريلز والستوريز والمنشورات" },
          desc: {
            en: "Hook retention, tap-forwards, saves, shares — the real signals, not the vanity ones.",
            ar: "الاحتفاظ بالمقدمة، النقرات إلى الأمام، الحفظ، المشاركات — الإشارات الحقيقية، لا السطحية.",
          },
        },
        {
          title: { en: "Get weekly Instagram plays", ar: "احصل على خطط انستقرام أسبوعية" },
          desc: {
            en: "Which Reel to reshare, which carousel to make, which caption style is landing this week.",
            ar: "أي ريلز لإعادة مشاركتها، أي كاروسيل لصنعها، أي أسلوب نص ينجح هذا الأسبوع.",
          },
        },
      ]}
      bullets={[
        { en: "Reels performance broken down by hook, retention, and shares", ar: "أداء الريلز مفصل حسب المقدمة والاحتفاظ والمشاركات" },
        { en: "Carousel vs. Reels vs. Stories — what's working for YOUR audience", ar: "كاروسيل مقابل ريلز مقابل ستوريز — ما الذي ينجح لجمهورك" },
        { en: "Best posting times down to the hour", ar: "أفضل أوقات النشر حتى الساعة" },
        { en: "Hashtag reach tracking — ditch the ones that don't work", ar: "تتبع وصول الهاشتاقات — تخلَّ عن التي لا تعمل" },
        { en: "Story views, taps forward, and drop-off rates", ar: "مشاهدات الستوريز والنقرات إلى الأمام ومعدلات التسرب" },
        { en: "Growth recommendations you can act on today", ar: "توصيات نمو يمكنك تنفيذها اليوم" },
      ]}
      cta={{ label: { en: "Connect Instagram", ar: "اربط انستقرام" }, href: "/register" }}
    />
  );
}
