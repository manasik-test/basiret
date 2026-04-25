import { Bot } from "lucide-react";
import { MarketingComingSoon } from "@/components/page-templates/coming-soon";

export default function AiAdvisorPage() {
  return (
    <MarketingComingSoon
      icon={Bot}
      eyebrow={{ en: "Coming soon", ar: "قريباً" }}
      title={{
        en: "Ask Basiret anything",
        ar: "اسأل بصيرة أي شيء",
      }}
      subtitle={{
        en: "A chat advisor that knows your numbers inside-out — ask 'why are my reels down?' and get a real answer, not a dashboard.",
        ar: "مستشار محادثة يعرف أرقامك من الداخل — اسأل 'لماذا ريلزي تراجعت؟' واحصل على إجابة حقيقية، لا لوحة تحكم.",
      }}
    />
  );
}
