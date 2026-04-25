import { Music2 } from "lucide-react";
import { ProductPage } from "@/components/page-templates/product-page";

export default function TikTokChannelPage() {
  return (
    <ProductPage
      icon={Music2}
      accent="#664FA1"
      eyebrow={{ en: "Basiret for TikTok", ar: "بصيرة لتيك توك" }}
      title={{
        en: "Crack the TikTok algorithm",
        ar: "افهم خوارزمية تيك توك",
      }}
      subtitle={{
        en: "Hook, hold, payoff — Basiret breaks down every video and tells you what to fix for the next one. Data-backed, not vibes-based.",
        ar: "المقدمة، الإبقاء، الختام — بصيرة تحلل كل فيديو وتخبرك ما تصلح في التالي. مدعومة بالبيانات، لا بالأحاسيس.",
      }}
      heroImage="https://images.unsplash.com/photo-1506543730435-e2c1d4553a84?q=80&w=2000&auto=format&fit=crop"
      heroImageAlt={{
        en: "Creator filming a short video",
        ar: "مبدع يصور فيديو قصير",
      }}
      steps={[
        {
          title: { en: "Connect TikTok", ar: "اربط تيك توك" },
          desc: {
            en: "Link your Business account in one click — we pull performance metrics from the official API.",
            ar: "اربط حسابك التجاري بنقرة واحدة — نسحب مقاييس الأداء من الواجهة الرسمية.",
          },
        },
        {
          title: { en: "Watch-time audit", ar: "تدقيق وقت المشاهدة" },
          desc: {
            en: "See the exact second viewers drop off — and what the top-retaining hooks have in common.",
            ar: "شاهد الثانية بالضبط التي ينسحب فيها المشاهدون — وما يشترك فيه أفضل المقدمات.",
          },
        },
        {
          title: { en: "Ride the right sounds", ar: "اركب الأصوات الصحيحة" },
          desc: {
            en: "Trending audio filtered for YOUR niche — not the whole For You page.",
            ar: "صوت رائج مُفلتر لمجالك — لا لصفحة For You بأكملها.",
          },
        },
      ]}
      bullets={[
        { en: "Hook retention — see exactly where viewers drop off", ar: "الاحتفاظ بالمقدمة — شاهد أين ينسحب المشاهدون بالضبط" },
        { en: "Trending sounds relevant to YOUR niche, not everyone's", ar: "أصوات رائجة ذات صلة بمجالك، لا بمجال الجميع" },
        { en: "Average watch time and completion rate per video", ar: "متوسط وقت المشاهدة ومعدل الإكمال لكل فيديو" },
        { en: "FYP visibility — how often you're hitting the For You Page", ar: "ظهور For You — كم مرة تصل إلى صفحة For You" },
        { en: "Comment trends — what your audience is saying and asking", ar: "اتجاهات التعليقات — ما يقوله جمهورك ويسأل عنه" },
        { en: "Best posting windows for your specific audience", ar: "أفضل نوافذ النشر لجمهورك المحدد" },
      ]}
      cta={{ label: { en: "Connect TikTok", ar: "اربط تيك توك" }, href: "/register" }}
    />
  );
}
