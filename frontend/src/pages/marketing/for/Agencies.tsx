import { Briefcase } from "lucide-react";
import { ProductPage } from "@/components/page-templates/product-page";

export default function AgenciesPage() {
  return (
    <ProductPage
      icon={Briefcase}
      accent="#A5DDEC"
      eyebrow={{ en: "For agencies", ar: "للوكالات" }}
      title={{
        en: "Ten clients, one dashboard, zero chaos",
        ar: "عشرة عملاء، لوحة واحدة، بدون فوضى",
      }}
      subtitle={{
        en: "Hand your account managers a single place to see every client's performance — with the next action already lined up for them.",
        ar: "امنح مديري حساباتك مكاناً واحداً لمشاهدة أداء كل عميل — مع الإجراء التالي جاهزاً لهم.",
      }}
      heroImage="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2000&auto=format&fit=crop"
      heroImageAlt={{
        en: "Agency team reviewing client work",
        ar: "فريق وكالة يراجع عمل العملاء",
      }}
      steps={[
        {
          title: { en: "Create a workspace per client", ar: "أنشئ مساحة عمل لكل عميل" },
          desc: {
            en: "Isolated data, separate permissions, clean reports — no mix-ups between accounts.",
            ar: "بيانات معزولة، صلاحيات منفصلة، تقارير نظيفة — بدون خلط بين الحسابات.",
          },
        },
        {
          title: { en: "Assign team members", ar: "عيّن أعضاء الفريق" },
          desc: {
            en: "Role-based access: account managers execute, strategists review, executives see summaries.",
            ar: "وصول حسب الدور: مديرو الحسابات ينفذون، الاستراتيجيون يراجعون، التنفيذيون يرون الملخصات.",
          },
        },
        {
          title: { en: "Deliver client-ready reports", ar: "قدّم تقارير جاهزة للعملاء" },
          desc: {
            en: "White-labeled PDFs with your logo. Monthly summaries generated automatically.",
            ar: "ملفات PDF بعلامتك البيضاء. ملخصات شهرية تُنشأ تلقائياً.",
          },
        },
      ]}
      bullets={[
        { en: "Unified multi-client dashboard with client health signals", ar: "لوحة موحدة متعددة العملاء مع إشارات صحة العميل" },
        { en: "Team workspaces with role-based permissions", ar: "مساحات عمل للفريق مع صلاحيات حسب الدور" },
        { en: "White-label client reports — your brand, not ours", ar: "تقارير عملاء بعلامة بيضاء — علامتك التجارية، لا علامتنا" },
        { en: "Approval workflows — draft, review, publish", ar: "سير عمل الموافقة — مسودة، مراجعة، نشر" },
        { en: "Client-ready action plans that prove the value you deliver", ar: "خطط عمل جاهزة للعملاء تثبت القيمة التي تقدمها" },
        { en: "Volume pricing — scales as you add clients", ar: "تسعير حسب الحجم — يتوسع مع إضافة العملاء" },
      ]}
      cta={{ label: { en: "Talk to sales", ar: "تواصل مع المبيعات" }, href: "/pricing" }}
      secondaryCta={{ label: { en: "See pricing", ar: "اطلع على الأسعار" }, href: "/pricing" }}
    />
  );
}
