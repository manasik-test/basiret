import { XIcon } from "@/components/ui/social-icons";
import { MarketingComingSoon } from "@/components/page-templates/coming-soon";

export default function XChannelPage() {
  return (
    <MarketingComingSoon
      icon={XIcon}
      eyebrow={{ en: "Coming soon", ar: "قريباً" }}
      title={{
        en: "Basiret for X / Twitter",
        ar: "بصيرة لإكس / تويتر",
      }}
      subtitle={{
        en: "X integration is coming — impression-per-follower tracking, thread performance, and the reply patterns that actually grow your account.",
        ar: "تكامل إكس قادم — تتبع الانطباعات لكل متابع، أداء السلاسل، وأنماط الردود التي تنمي حسابك فعلاً.",
      }}
    />
  );
}
