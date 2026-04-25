import { FacebookIcon } from "@/components/ui/social-icons";
import { ProductPage } from "@/components/page-templates/product-page";

export default function FacebookChannelPage() {
  return (
    <ProductPage
      icon={FacebookIcon}
      accent="#1877F2"
      eyebrow={{ en: "Basiret for Facebook", ar: "بصيرة لفيسبوك" }}
      title={{
        en: "Make Facebook work for your business",
        ar: "اجعل فيسبوك يعمل لصالح عملك",
      }}
      subtitle={{
        en: "Pages, groups, and ads are still where your local customers spend time. Basiret shows you exactly what to post so they find you.",
        ar: "الصفحات والمجموعات والإعلانات لا يزال المكان الذي يقضي فيه عملاؤك المحليون وقتهم. بصيرة تريك بالضبط ما تنشر ليجدوك.",
      }}
      heroImage="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2000&auto=format&fit=crop"
      heroImageAlt={{
        en: "Small team collaborating on social strategy",
        ar: "فريق صغير يتعاون على استراتيجية التواصل",
      }}
      steps={[
        {
          title: { en: "Link your Page", ar: "اربط صفحتك" },
          desc: {
            en: "Pull Page insights, post history, and audience demographics from Facebook's official API.",
            ar: "اسحب رؤى الصفحة وسجل المنشورات وديموغرافيا الجمهور من واجهة فيسبوك الرسمية.",
          },
        },
        {
          title: { en: "See local signal clearly", ar: "شاهد الإشارات المحلية بوضوح" },
          desc: {
            en: "Basiret surfaces which posts pull in your city, neighborhood, and language group.",
            ar: "بصيرة تكشف أي المنشورات تجذب مدينتك وحيّك ومجموعتك اللغوية.",
          },
        },
        {
          title: { en: "Act on comments faster", ar: "تفاعل مع التعليقات أسرع" },
          desc: {
            en: "Unified inbox + suggested replies so you never leave a potential customer waiting.",
            ar: "صندوق وارد موحد + ردود مقترحة لكيلا تترك عميلاً محتملاً ينتظر.",
          },
        },
      ]}
      bullets={[
        { en: "Page reach and engagement trends week over week", ar: "اتجاهات وصول وتفاعل الصفحة أسبوعاً تلو الآخر" },
        { en: "Which post types pull in your audience — video, link, photo, text", ar: "أي أنواع المنشورات تجذب جمهورك — فيديو، رابط، صورة، نص" },
        { en: "Comment sentiment and response time tracking", ar: "تتبع مشاعر التعليقات ووقت الاستجابة" },
        { en: "Group activity insights — where the conversation is happening", ar: "رؤى نشاط المجموعات — أين تدور المحادثة" },
        { en: "Local audience breakdown by city and language", ar: "تفصيل الجمهور المحلي حسب المدينة واللغة" },
        { en: "Action plan tuned for SME owners and local businesses", ar: "خطة عمل مضبوطة لأصحاب المنشآت الصغيرة والأعمال المحلية" },
      ]}
      cta={{ label: { en: "Connect Facebook", ar: "اربط فيسبوك" }, href: "/register" }}
    />
  );
}
