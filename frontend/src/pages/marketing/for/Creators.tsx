import { UserCircle } from "lucide-react";
import { ProductPage } from "@/components/page-templates/product-page";

export default function CreatorsPage() {
  return (
    <ProductPage
      icon={UserCircle}
      accent="#BF499B"
      eyebrow={{ en: "For creators", ar: "للمبدعين" }}
      title={{
        en: "Spend less time staring at analytics",
        ar: "اقضِ وقتاً أقل في التحديق في التحليلات",
      }}
      subtitle={{
        en: "Your job is to create. Basiret reads the numbers for you, spots what's landing, and tells you what to make next — across Instagram, TikTok, and beyond.",
        ar: "مهمتك هي الإبداع. بصيرة تقرأ الأرقام نيابة عنك، تكتشف ما ينجح، وتخبرك بما تصنع بعد ذلك — عبر انستقرام وتيك توك وما بعدها.",
      }}
      heroImage="https://images.unsplash.com/photo-1548783307-f63adc3f200b?q=80&w=2000&auto=format&fit=crop"
      heroImageAlt={{
        en: "Creator filming content at their desk",
        ar: "مبدع يصور محتوى على مكتبه",
      }}
      steps={[
        {
          title: { en: "Sync every platform", ar: "زامن كل منصة" },
          desc: {
            en: "Your Reels, TikToks, and Shorts all in one view — no more tab-juggling.",
            ar: "كل ريلزاتك وتيك توكاتك وشورتس في عرض واحد — لا مزيد من تبديل التبويبات.",
          },
        },
        {
          title: { en: "Find your winning formula", ar: "اعثر على وصفتك الرابحة" },
          desc: {
            en: "Hook types, video length, thumbnail style — Basiret isolates what consistently performs.",
            ar: "أنواع المقدمات، طول الفيديو، أسلوب الصورة المصغرة — بصيرة تعزل ما يعمل باستمرار.",
          },
        },
        {
          title: { en: "Create with confidence", ar: "أنشئ بثقة" },
          desc: {
            en: "Daily content ideas based on YOUR top performers plus what's currently trending.",
            ar: "أفكار محتوى يومية مبنية على أفضل منشوراتك وما يرتاد حالياً.",
          },
        },
      ]}
      bullets={[
        { en: "Hook analysis — which openings keep people watching", ar: "تحليل المقدمات — أي المقدمات تبقي الناس يشاهدون" },
        { en: "Cross-platform view — your best post on Reels might crush on TikTok", ar: "عرض متعدد المنصات — أفضل منشور ريلز قد ينجح على تيك توك" },
        { en: "Content ideas based on your own top performers + trending topics", ar: "أفكار محتوى مبنية على أفضل منشوراتك + المواضيع الرائجة" },
        { en: "Audience growth tracker — know which posts pull in new follows", ar: "متتبع نمو الجمهور — اعرف أي المنشورات تجلب متابعين جدد" },
        { en: "Engagement quality, not just likes — comments, shares, saves", ar: "جودة التفاعل، لا الإعجابات فقط — التعليقات والمشاركات والحفظ" },
        { en: "Brand-deal-ready reports for your partnerships", ar: "تقارير جاهزة للعروض التجارية من أجل شراكاتك" },
      ]}
      cta={{ label: { en: "Start free", ar: "ابدأ مجاناً" }, href: "/register" }}
    />
  );
}
