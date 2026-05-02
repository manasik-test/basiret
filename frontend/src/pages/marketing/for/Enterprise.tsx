import { Building2 } from "lucide-react";
import { ProductPage } from "@/components/page-templates/product-page";

export default function EnterprisePage() {
  return (
    <ProductPage
      icon={Building2}
      accent="#5433c2"
      eyebrow={{ en: "For enterprise", ar: "للمؤسسات" }}
      title={{
        en: "Social intelligence at enterprise scale",
        ar: "ذكاء التواصل الاجتماعي بمستوى المؤسسات",
      }}
      subtitle={{
        en: "Regional brands, multi-market teams, compliance-heavy industries — Basiret gives you the same clarity on 200 accounts as we do on 2.",
        ar: "العلامات الإقليمية، الفرق متعددة الأسواق، الصناعات ذات المتطلبات التنظيمية — بصيرة تمنحك نفس الوضوح على 200 حساب كما على 2.",
      }}
      stepImages={[
        { src: "/marketing/dashboard-1440.png", alt: { en: "Enterprise dashboard", ar: "لوحة المؤسسة" } },
        { src: "/marketing/audience.png", alt: { en: "Audience governance", ar: "حوكمة الجمهور" } },
        { src: "/marketing/competitors.png", alt: { en: "Strategic intelligence", ar: "الذكاء الاستراتيجي" } },
      ]}
      steps={[
        {
          title: { en: "Dedicated onboarding", ar: "إعداد مخصص" },
          desc: {
            en: "A named solutions engineer wires Basiret into your brand structure, SSO, and data stack.",
            ar: "مهندس حلول مخصص يدمج بصيرة مع هيكل علامتك وتسجيل الدخول الموحد ومكدس البيانات.",
          },
        },
        {
          title: { en: "Govern at scale", ar: "حوكم على نطاق واسع" },
          desc: {
            en: "Role-based access, audit logs, and regional data residency for compliance-heavy teams.",
            ar: "وصول حسب الدور، سجلات تدقيق، إقامة بيانات إقليمية للفرق ذات المتطلبات التنظيمية.",
          },
        },
        {
          title: { en: "Scale with confidence", ar: "توسّع بثقة" },
          desc: {
            en: "Unlimited accounts, custom integrations, 99.9% SLA — your team is productive from day one.",
            ar: "حسابات غير محدودة، تكاملات مخصصة، SLA بنسبة 99.9% — فريقك منتج من اليوم الأول.",
          },
        },
      ]}
      bullets={[
        { en: "Unlimited accounts and brands under one workspace", ar: "حسابات وعلامات تجارية غير محدودة تحت مساحة عمل واحدة" },
        { en: "SSO (SAML), SCIM provisioning, audit logs", ar: "تسجيل دخول موحد (SAML)، تزويد SCIM، سجلات التدقيق" },
        { en: "Dedicated account manager + priority SLA-backed support", ar: "مدير حساب مخصص + دعم ذو أولوية مدعوم بـ SLA" },
        { en: "Custom integrations with your data warehouse and BI stack", ar: "تكاملات مخصصة مع مستودع بياناتك وحزمة BI" },
        { en: "Regional data residency and compliance (GDPR-ready)", ar: "إقامة البيانات الإقليمية والامتثال (جاهز لـ GDPR)" },
        { en: "White-glove onboarding — your team is productive day one", ar: "إعداد متميز — فريقك منتج من اليوم الأول" },
      ]}
      cta={{ label: { en: "Contact sales", ar: "تواصل مع المبيعات" }, href: "/pricing" }}
    />
  );
}
