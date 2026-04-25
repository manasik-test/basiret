import { LegalPage } from "@/components/page-templates/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage
      title={{ en: "Privacy Policy", ar: "سياسة الخصوصية" }}
      updated={{ en: "Last updated: April 2026", ar: "آخر تحديث: أبريل 2026" }}
      intro={{
        en: "Your data is yours. We only access what we need to make Basiret work, we never sell it, and we never post on your behalf. This policy explains exactly what we collect, why, and how we protect it.",
        ar: "بياناتك ملكك. نحن نصل فقط إلى ما نحتاجه لجعل بصيرة تعمل، لا نبيعها أبداً، ولا ننشر نيابة عنك أبداً. توضح هذه السياسة بالضبط ما نجمعه ولماذا وكيف نحميه.",
      }}
      sections={[
        {
          heading: { en: "What we collect", ar: "ما نجمعه" },
          body: {
            en: `When you sign up, we collect your email and name. When you connect a social account, we read your public metrics (posts, reach, engagement, audience demographics) through official platform APIs. We do NOT read private messages, and we do NOT have permission to post on your behalf.

We also collect basic usage data (pages visited, features used) to improve the product. You can opt out of product analytics in your account settings.`,
            ar: `عند التسجيل، نجمع بريدك الإلكتروني واسمك. عند ربط حساب تواصل اجتماعي، نقرأ مقاييسك العامة (المنشورات، الوصول، التفاعل، ديموغرافيا الجمهور) عبر واجهات برمجة التطبيقات الرسمية للمنصات. لا نقرأ الرسائل الخاصة، وليس لدينا إذن للنشر نيابة عنك.

نجمع أيضاً بيانات استخدام أساسية (الصفحات التي تمت زيارتها، الميزات المستخدمة) لتحسين المنتج. يمكنك إلغاء الاشتراك في تحليلات المنتج من إعدادات حسابك.`,
          },
        },
        {
          heading: { en: "How we use your data", ar: "كيف نستخدم بياناتك" },
          body: {
            en: `Your social metrics are analyzed to give you insights and action recommendations. That analysis runs on our infrastructure and the results are only visible to you and anyone you explicitly invite to your workspace.

We use aggregated, fully anonymized patterns to improve our recommendation engine — no individual data leaves your account.`,
            ar: `يتم تحليل مقاييسك الاجتماعية لإعطائك رؤى وتوصيات عملية. يعمل هذا التحليل على بنيتنا التحتية والنتائج مرئية فقط لك ولأي شخص تدعوه صراحةً إلى مساحة عملك.

نستخدم أنماطاً مجمّعة ومجهولة الهوية تماماً لتحسين محرك التوصيات لدينا — لا تغادر أي بيانات فردية حسابك.`,
          },
        },
        {
          heading: { en: "Data storage & security", ar: "تخزين البيانات والأمان" },
          body: {
            en: `Data is encrypted in transit (TLS 1.3) and at rest (AES-256). We host on secure infrastructure in audited data centers. Access to production data is restricted to engineers on-call and logged for audit.

We do not sell, rent, or trade your data. Ever.`,
            ar: `يتم تشفير البيانات أثناء النقل (TLS 1.3) وأثناء التخزين (AES-256). نستضيف على بنية تحتية آمنة في مراكز بيانات مدققة. الوصول إلى بيانات الإنتاج مقيد بالمهندسين المناوبين ومسجل للتدقيق.

لا نبيع أو نؤجر أو نتاجر ببياناتك. أبداً.`,
          },
        },
        {
          heading: { en: "Your rights", ar: "حقوقك" },
          body: {
            en: `You can export or delete all your data from the account settings page at any time. If you cancel, we keep your data available for 30 days in case you come back, then delete it.

For questions, contact privacy@basiret.com.`,
            ar: `يمكنك تصدير أو حذف جميع بياناتك من صفحة إعدادات الحساب في أي وقت. إذا ألغيت، نحتفظ ببياناتك متاحة لمدة 30 يوماً في حال عدت، ثم نحذفها.

للأسئلة، تواصل مع privacy@basiret.com.`,
          },
        },
      ]}
    />
  );
}
