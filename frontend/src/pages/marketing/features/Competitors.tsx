import { Radar } from "lucide-react";
import { MarketingComingSoon } from "@/components/page-templates/coming-soon";

export default function CompetitorsPage() {
  return (
    <MarketingComingSoon
      icon={Radar}
      eyebrow={{ en: "Coming soon", ar: "قريباً" }}
      title={{
        en: "Competitor tracking",
        ar: "تتبع المنافسين",
      }}
      subtitle={{
        en: "Watch what your rivals post, what works for them, and where they're losing — so you can move faster. We're polishing it now.",
        ar: "راقب ما ينشره منافسوك، ما ينجح لهم، وأين يخسرون — لتتحرك أسرع. نحن نصقلها الآن.",
      }}
    />
  );
}
