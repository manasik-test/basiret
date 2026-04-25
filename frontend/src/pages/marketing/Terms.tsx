import { LegalPage } from "@/components/page-templates/legal-page";

export default function TermsPage() {
  return (
    <LegalPage
      title={{ en: "Terms of Service", ar: "شروط الخدمة" }}
      updated={{ en: "Last updated: April 2026", ar: "آخر تحديث: أبريل 2026" }}
      intro={{
        en: "These terms govern your use of Basiret. They're written in plain language because legal jargon helps nobody. By creating an account, you agree to them.",
        ar: "تحكم هذه الشروط استخدامك لبصيرة. كُتبت بلغة واضحة لأن المصطلحات القانونية لا تفيد أحداً. بإنشائك حساباً، فأنت توافق عليها.",
      }}
      sections={[
        {
          heading: { en: "Your account", ar: "حسابك" },
          body: {
            en: `You're responsible for keeping your login credentials safe and for everything done from your account. If you think your account is compromised, email security@basiret.com and we'll help lock it down.

You must be 16 or older to create an account. The account is for you — don't share logins across your whole team; invite them as team members instead.`,
            ar: `أنت مسؤول عن الحفاظ على بيانات تسجيل الدخول الخاصة بك آمنة، وعن كل ما يتم من حسابك. إذا كنت تعتقد أن حسابك مخترق، راسل security@basiret.com وسنساعدك في قفله.

يجب أن تكون 16 عاماً أو أكبر لإنشاء حساب. الحساب لك — لا تشارك بيانات الدخول عبر فريقك بالكامل؛ ادعهم كأعضاء فريق بدلاً من ذلك.`,
          },
        },
        {
          heading: { en: "What you can do", ar: "ما يمكنك فعله" },
          body: {
            en: `Use Basiret to analyze social accounts you own or are authorized to manage. Connect as many accounts as your plan allows. Export your own data anytime.

Don't: scrape accounts you don't manage, reverse-engineer the product, resell our data, or use Basiret to violate any platform's terms of service.`,
            ar: `استخدم بصيرة لتحليل حسابات التواصل الاجتماعي التي تملكها أو مخوّل لإدارتها. اربط عدداً من الحسابات يسمح به اشتراكك. صدّر بياناتك في أي وقت.

لا تفعل: كشط حسابات لا تديرها، أو هندسة المنتج العكسية، أو إعادة بيع بياناتنا، أو استخدام بصيرة لانتهاك شروط خدمة أي منصة.`,
          },
        },
        {
          heading: { en: "Billing", ar: "الفوترة" },
          body: {
            en: `Paid plans are billed monthly or yearly in advance. You can cancel anytime — you'll keep access through the end of your paid period. We don't issue pro-rated refunds, but if something broke on our end we'll always make it right.

Price changes apply to your next renewal, with at least 30 days' notice.`,
            ar: `يتم إصدار فواتير الخطط المدفوعة شهرياً أو سنوياً مقدماً. يمكنك الإلغاء في أي وقت — ستحتفظ بالوصول حتى نهاية الفترة المدفوعة. لا نصدر استردادات تناسبية، لكن إذا انكسر شيء من جانبنا فسنصلحه دائماً.

تنطبق تغييرات الأسعار على تجديدك التالي، بإشعار مدته 30 يوماً على الأقل.`,
          },
        },
        {
          heading: { en: "Liability", ar: "المسؤولية" },
          body: {
            en: `We work hard to keep Basiret up and accurate, but we don't guarantee specific growth outcomes. Social platforms change their APIs — when they do, some features may be temporarily affected. We'll communicate openly when this happens.

Our total liability is limited to what you paid us in the 12 months before a claim.`,
            ar: `نعمل بجد لإبقاء بصيرة متاحة ودقيقة، لكننا لا نضمن نتائج نمو محددة. تغيّر المنصات الاجتماعية واجهات برمجة التطبيقات الخاصة بها — عندما يحدث ذلك، قد تتأثر بعض الميزات مؤقتاً. سنتواصل بصراحة عند حدوث ذلك.

إجمالي مسؤوليتنا محدود بما دفعته لنا في 12 شهراً قبل المطالبة.`,
          },
        },
        {
          heading: { en: "Questions", ar: "أسئلة" },
          body: {
            en: `Email legal@basiret.com for anything. We reply.`,
            ar: `راسل legal@basiret.com لأي شيء. نرد.`,
          },
        },
      ]}
    />
  );
}
