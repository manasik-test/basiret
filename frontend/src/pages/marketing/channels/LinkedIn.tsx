import { LinkedInIcon } from "@/components/ui/social-icons";
import { MarketingComingSoon } from "@/components/page-templates/coming-soon";

export default function LinkedInChannelPage() {
  return (
    <MarketingComingSoon
      icon={LinkedInIcon}
      eyebrow={{ en: "Coming soon", ar: "قريباً" }}
      title={{
        en: "Basiret for LinkedIn",
        ar: "بصيرة للينكدإن",
      }}
      subtitle={{
        en: "LinkedIn support is in active development. We're tuning the B2B signals — lead quality, ICP reach, and post resurfacing — so it'll be worth the wait.",
        ar: "دعم لينكدإن قيد التطوير النشط. نضبط إشارات B2B — جودة العملاء المحتملين، وصول ICP، وإعادة ظهور المنشورات — لتكون تستحق الانتظار.",
      }}
    />
  );
}
