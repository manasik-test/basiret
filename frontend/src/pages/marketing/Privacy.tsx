import { LegalPage } from "@/components/page-templates/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage
      title={{ en: "Privacy Policy", ar: "سياسة الخصوصية" }}
      updated={{ en: "Last updated: April 2026", ar: "آخر تحديث: أبريل 2026" }}
      intro={{
        en: `Your data is yours. Basiret only accesses what we need to make the service work, we never sell it, and we never post on your behalf. This policy explains exactly what we collect, why, who else processes it, where it lives, how we protect it, and how you can have it removed.

This service is operated by Leader Smart Technology (the "Operator", "we", "us"), a company registered in the Sultanate of Oman. For privacy questions, data-export requests, or deletion requests, contact us at contact@basiret.co.`,
        ar: `بياناتك ملك لك. لا تصل بصيرة إلا إلى ما نحتاجه لتشغيل الخدمة، ولا نبيعها أبداً، ولا ننشر نيابة عنك. توضح هذه السياسة بالضبط ما نجمعه ولماذا، ومن يعالجه أيضاً، وأين يُخزَّن، وكيف نحميه، وكيف يمكنك حذفه.

تُشغَّل هذه الخدمة بواسطة شركة Leader Smart Technology ("المُشغِّل" أو "نحن")، شركة مسجَّلة في سلطنة عُمان. للاستفسارات المتعلقة بالخصوصية أو طلبات تصدير البيانات أو حذفها، تواصل معنا عبر contact@basiret.co.`,
      }}
      sections={[
        {
          heading: { en: "1. Who we are", ar: "1. من نحن" },
          body: {
            en: `Basiret is a software-as-a-service product operated by Leader Smart Technology, a company registered in the Sultanate of Oman. We provide AI-powered analytics for Instagram Business accounts to small-business owners and content creators. The Operator is the data controller for the personal data described below.

Address for legal correspondence: Leader Smart Technology, Sultanate of Oman.
Email: contact@basiret.co`,
            ar: `بصيرة منتج برمجي يُقدَّم كخدمة (SaaS) تُشغِّله شركة Leader Smart Technology المسجَّلة في سلطنة عُمان. نُقدِّم تحليلات مدعومة بالذكاء الاصطناعي لحسابات Instagram التجارية لأصحاب المشاريع الصغيرة وصُنّاع المحتوى. المُشغِّل هو المُتحكِّم بالبيانات الشخصية الموضَّحة أدناه.

عنوان المراسلات القانونية: Leader Smart Technology، سلطنة عُمان.
البريد الإلكتروني: contact@basiret.co`,
          },
        },
        {
          heading: { en: "2. What we collect", ar: "2. ما نجمعه" },
          body: {
            en: `Account data: your full name, email address, hashed password, and the name of the workspace ("organisation") you create on sign-up.

Instagram Business account data, accessed only after you authorise it through Meta's official OAuth flow:
• Profile information (username, profile picture, follower count, follows count)
• Posts you have published (caption, media URL, posted-at timestamp, content type)
• Public engagement metrics on those posts (likes, comments, saves, shares, reach, impressions where available)
• Comments left by other Instagram users on your posts (text, author username, timestamp) — used for sentiment analysis only

Subscription and billing metadata if you upgrade to a paid plan: Stripe customer ID, plan tier, current period dates, payment status. We do NOT store full card numbers or CVCs — those go directly to Stripe.

Product usage telemetry: pages you visit inside the app, features you use, and errors you encounter, used to improve the product. You can opt out of optional analytics in your account settings.

What we do NOT collect:
• Private direct messages (we do not request the permission needed to read them)
• Stories, lives, or other ephemeral content
• Any data from Instagram accounts you have not explicitly connected to your Basiret workspace`,
            ar: `بيانات الحساب: اسمك الكامل وبريدك الإلكتروني وكلمة المرور المُجزَّأة واسم مساحة العمل ("المؤسسة") التي تُنشئها عند التسجيل.

بيانات حساب Instagram التجاري، يُصل إليها فقط بعد إذنك عبر تدفُّق OAuth الرسمي من Meta:
• معلومات الملف الشخصي (اسم المستخدم، صورة الملف، عدد المتابعين، المتابَعين)
• المنشورات التي نشرتها (النص، رابط الوسائط، طابع النشر الزمني، نوع المحتوى)
• مقاييس التفاعل العامة على تلك المنشورات (إعجابات، تعليقات، حفظ، مشاركات، مدى الوصول والانطباعات حيث تتوفر)
• التعليقات التي تركها مستخدمون آخرون على Instagram على منشوراتك (النص، اسم المستخدم للمؤلف، الطابع الزمني) — تُستخدم لتحليل المشاعر فقط

البيانات الوصفية للاشتراك والفوترة إذا قمت بالترقية إلى خطة مدفوعة: معرّف العميل في Stripe، مستوى الخطة، تواريخ الفترة الحالية، حالة الدفع. لا نخزّن أرقام البطاقات الكاملة أو رموز CVC — تذهب هذه مباشرة إلى Stripe.

قياس استخدام المنتج: الصفحات التي تزورها داخل التطبيق، والميزات التي تستخدمها، والأخطاء التي تواجهها، تُستخدم لتحسين المنتج. يمكنك إلغاء الاشتراك في التحليلات الاختيارية من إعدادات حسابك.

ما لا نجمعه:
• الرسائل الخاصة المباشرة (لا نطلب الإذن اللازم لقراءتها)
• القصص أو البثوث المباشرة أو أي محتوى عابر آخر
• أي بيانات من حسابات Instagram التي لم تربطها صراحةً بمساحة عملك في بصيرة`,
          },
        },
        {
          heading: {
            en: "3. Meta / Instagram permissions we request",
            ar: "3. صلاحيات Meta / Instagram التي نطلبها",
          },
          body: {
            en: `When you connect your Instagram Business account, Meta's consent screen will ask you to grant the following permissions to Basiret. Each is required for a specific feature, and we never use them for any other purpose:

• instagram_business_basic — read-only access to your profile and the posts you have published. We use this to populate the dashboard, the post analytics, and the audience-segmentation feature.

• instagram_business_manage_comments — read-only access to comments on your posts so we can run them through our multilingual sentiment classifier (the headline differentiator vs. Meta Business Suite, which does not perform per-comment sentiment analysis). We never post, edit, hide, or delete comments on your behalf. The "manage" word in the permission name is Meta's standard naming, not a description of what we do.

You can revoke these permissions at any time from your Facebook / Instagram settings, or by disconnecting the account from inside Basiret (Settings → Organization → Disconnect). Revoking permissions stops new data ingestion immediately; existing data remains until you also delete your Basiret account (see Section 9).`,
            ar: `عند ربط حساب Instagram التجاري الخاص بك، ستطلب منك شاشة موافقة Meta منح الصلاحيات التالية لبصيرة. كلٌّ منها مطلوب لميزة محدّدة، ولا نستخدمها أبداً لأي غرض آخر:

• instagram_business_basic — وصول للقراءة فقط إلى ملفك الشخصي والمنشورات التي نشرتها. نستخدم ذلك لتعبئة لوحة التحكم وتحليلات المنشورات وميزة شرائح الجمهور.

• instagram_business_manage_comments — وصول للقراءة فقط إلى التعليقات على منشوراتك لنُمرِّرها عبر مُصنِّف المشاعر متعدد اللغات (الميزة المُمَيِّزة الأساسية مقارنةً بـ Meta Business Suite الذي لا يُجري تحليل مشاعر لكل تعليق). لا نقوم أبداً بنشر تعليقات أو تعديلها أو إخفائها أو حذفها نيابة عنك. كلمة "manage" في اسم الصلاحية هي تسمية Meta المعتادة، وليست وصفاً لما نفعله.

يمكنك إلغاء هذه الصلاحيات في أي وقت من إعدادات Facebook / Instagram، أو بفصل الحساب من داخل بصيرة (الإعدادات → المؤسسة → فصل). يُوقف إلغاء الصلاحيات استيعاب البيانات الجديدة فوراً؛ تبقى البيانات الموجودة حتى تحذف حساب بصيرة الخاص بك (انظر القسم 9).`,
          },
        },
        {
          heading: { en: "4. How we use your data", ar: "4. كيف نستخدم بياناتك" },
          body: {
            en: `We use the data we collect to:

• Run the analytics features you signed up for: KPI dashboards, sentiment analysis, audience segmentation, content recommendations, and weekly insights.
• Send transactional emails — sign-up confirmation, password reset, billing receipts. We do not send marketing emails without separate consent.
• Process payments through Stripe if you upgrade to a paid plan.
• Improve the product. We use aggregated, anonymised patterns to refine our recommendation engine and AI prompts. We never train third-party AI models on your individual data.
• Comply with legal obligations and respond to lawful requests from authorities of the Sultanate of Oman.

We do not sell, rent, or trade your personal data to anyone. Ever.`,
            ar: `نستخدم البيانات التي نجمعها من أجل:

• تشغيل ميزات التحليلات التي اشتركت فيها: لوحات مؤشرات الأداء، تحليل المشاعر، شرائح الجمهور، توصيات المحتوى، والرؤى الأسبوعية.
• إرسال رسائل بريدية تشغيلية — تأكيد التسجيل، إعادة تعيين كلمة المرور، إيصالات الفوترة. لا نرسل رسائل تسويقية دون موافقة منفصلة.
• معالجة المدفوعات عبر Stripe إذا قمت بالترقية إلى خطة مدفوعة.
• تحسين المنتج. نستخدم أنماطاً مُجمَّعة ومجهولة الهوية لصقل محرّك التوصيات وموجِّهات الذكاء الاصطناعي لدينا. لا نقوم أبداً بتدريب نماذج ذكاء اصطناعي من أطراف ثالثة على بياناتك الفردية.
• الامتثال للالتزامات القانونية والاستجابة للطلبات المشروعة من سلطات سلطنة عُمان.

لا نبيع أو نؤجر أو نتاجر ببياناتك الشخصية لأي شخص. أبداً.`,
          },
        },
        {
          heading: {
            en: "5. Third-party processors",
            ar: "5. الأطراف الثالثة التي تعالج البيانات",
          },
          body: {
            en: `Basiret relies on the following sub-processors. They each receive only the minimum data needed to perform their function and are bound by their own privacy commitments:

• Hetzner Online GmbH (Falkenstein, Germany — European Union) — hosts our application servers, database, and Redis cache. All of your account data, synced Instagram data, and AI outputs live on Hetzner infrastructure inside the EU.

• Stripe, Inc. (United States) — processes payments and stores billing data (card details, billing address). We never see your full card number; Stripe sends us a token plus a customer ID. Stripe's privacy policy: stripe.com/privacy.

• Google LLC / Gemini API (United States) — generates the weekly insights, audience-persona descriptions, content-plan suggestions, and the Ask-Basiret chat answers. Inputs are aggregated metrics derived from your data (e.g. "23 posts, average likes 41, top content type video"); we do not send raw post bodies, comment text, or personally-identifying information beyond what is necessary to produce the output.

• OpenAI, L.L.C. (United States) — generates AI captions when you click "Generate caption". Inputs are the topic, content type, and short style prompts; outputs are returned to you and may be cached briefly server-side to deduplicate identical requests across the workspace. OpenAI's terms prohibit them from training their models on API data without explicit opt-in.

We add or change sub-processors only when necessary, and material changes will be reflected in this policy with a revised "Last updated" date. By using Basiret you consent to these processors handling your data on our behalf.`,
            ar: `تعتمد بصيرة على المعالجين الفرعيين التاليين. يحصل كلٌّ منهم على الحد الأدنى من البيانات اللازمة فقط لأداء وظيفته وهو مُلزَم بالتزاماته الخاصة بالخصوصية:

• Hetzner Online GmbH (فالكنشتاين، ألمانيا — الاتحاد الأوروبي) — تستضيف خوادم تطبيقنا وقاعدة البيانات وذاكرة Redis. تُحفظ جميع بيانات حسابك وبيانات Instagram المتزامنة ومخرجات الذكاء الاصطناعي على بنية Hetzner التحتية داخل الاتحاد الأوروبي.

• Stripe, Inc. (الولايات المتحدة) — تعالج المدفوعات وتخزّن بيانات الفوترة (تفاصيل البطاقة وعنوان الفوترة). لا نرى أبداً رقم بطاقتك الكامل؛ ترسل لنا Stripe رمزاً ومُعرّف عميل. سياسة خصوصية Stripe: stripe.com/privacy.

• Google LLC / Gemini API (الولايات المتحدة) — تُولِّد الرؤى الأسبوعية وأوصاف شرائح الجمهور واقتراحات خطة المحتوى وإجابات الدردشة "اسأل بصيرة". المدخلات مقاييس مُجمَّعة مشتقّة من بياناتك (مثلاً "23 منشوراً، متوسط الإعجابات 41، أعلى نوع محتوى فيديو")؛ لا نرسل النصوص الخام للمنشورات أو نصوص التعليقات أو معلومات شخصية تتجاوز ما هو ضروري لإنتاج المخرَج.

• OpenAI, L.L.C. (الولايات المتحدة) — تُولِّد نصوص المنشورات بالذكاء الاصطناعي عند النقر على "أنشئ نصاً". المدخلات هي الموضوع ونوع المحتوى وموجِّهات أسلوب قصيرة؛ تُعاد المخرجات إليك وقد تُخزَّن مؤقتاً على الخادم لإزالة التكرار في الطلبات المتطابقة داخل مساحة العمل. تحظر شروط OpenAI تدريب نماذجها على بيانات الواجهة البرمجية بدون اشتراك صريح.

لا نضيف أو نُغيِّر معالجين فرعيين إلا عند الضرورة، وستُعكس التغييرات الجوهرية في هذه السياسة بتاريخ "آخر تحديث" مُعدَّل. باستخدامك بصيرة فإنك توافق على معالجة هؤلاء المعالجين لبياناتك نيابةً عنا.`,
          },
        },
        {
          heading: {
            en: "6. Data storage, security, and international transfers",
            ar: "6. تخزين البيانات والأمان والنقل الدولي",
          },
          body: {
            en: `Where your data lives. All application data — user profiles, synced Instagram posts and comments, AI analyses, audience segments — is stored on servers operated by Hetzner Online GmbH in their Falkenstein, Germany data centre, inside the European Union.

International transfer disclosure. Because the Operator is registered in the Sultanate of Oman, and the data is stored in Germany (EU), data crosses an international border between the user's jurisdiction and the storage location. By using Basiret, Oman-based users explicitly consent to this transfer. The transfer is performed under TLS 1.3 in transit, and data at rest is encrypted using AES-256 by Hetzner's managed disk encryption.

Security. We use bank-grade encryption in transit (TLS 1.3) and at rest (AES-256). Instagram OAuth tokens are additionally encrypted at the application layer using Fernet (AES-128-CBC + HMAC-SHA256) with a key derived from a server secret via PBKDF2. Access to production data is restricted to engineers on-call and is audit-logged.

We do not sell, rent, or trade your data — full stop.`,
            ar: `أين تُحفظ بياناتك. جميع بيانات التطبيق — ملفات المستخدمين الشخصية ومنشورات Instagram والتعليقات المتزامنة وتحليلات الذكاء الاصطناعي وشرائح الجمهور — مُخزَّنة على خوادم تشغّلها Hetzner Online GmbH في مركز بياناتها بفالكنشتاين، ألمانيا، داخل الاتحاد الأوروبي.

الإفصاح عن النقل الدولي. بما أن المُشغِّل مسجَّل في سلطنة عُمان والبيانات مُخزَّنة في ألمانيا (الاتحاد الأوروبي)، فإن البيانات تعبر حدوداً دولية بين الولاية القضائية للمستخدم وموقع التخزين. باستخدامك بصيرة، يوافق المستخدمون في عُمان صراحةً على هذا النقل. يُنفَّذ النقل عبر TLS 1.3 أثناء التنقّل، وتُشفَّر البيانات أثناء التخزين باستخدام AES-256 من خلال تشفير الأقراص المُدار من Hetzner.

الأمان. نستخدم تشفيراً بمستوى البنوك أثناء النقل (TLS 1.3) والتخزين (AES-256). تُشفَّر رموز OAuth الخاصة بـ Instagram إضافياً على طبقة التطبيق باستخدام Fernet (AES-128-CBC + HMAC-SHA256) بمفتاح مشتق من سرّ الخادم عبر PBKDF2. الوصول إلى بيانات الإنتاج مقتصر على المهندسين المناوبين ومُسجَّل للتدقيق.

لا نبيع أو نؤجر أو نتاجر ببياناتك — نقطة.`,
          },
        },
        {
          heading: { en: "7. Cookies", ar: "7. ملفات تعريف الارتباط" },
          body: {
            en: `Basiret uses one cookie: a session cookie containing the refresh portion of your authentication token. It is HTTP-only, Secure (in production), and scoped to /api/v1/auth so only the auth endpoints can read it. Without this cookie, you would be logged out every 15 minutes (the lifetime of the access token).

We do NOT use third-party advertising or behavioural tracking cookies. We do not load Google Analytics, Facebook Pixel, or any similar tracker on either the marketing site (basiret.co) or the app dashboard.`,
            ar: `تستخدم بصيرة ملف تعريف ارتباط واحد: ملف تعريف ارتباط للجلسة يحتوي على جزء التحديث من رمز المصادقة الخاص بك. إنه HTTP-only و Secure (في الإنتاج) ومحدود النطاق على /api/v1/auth لتقتصر قراءته على نقاط نهاية المصادقة فقط. بدون هذا الملف، ستُسجَّل خروجك كل 15 دقيقة (عمر رمز الوصول).

لا نستخدم ملفات تعريف ارتباط للإعلانات الخارجية أو للتتبُّع السلوكي. لا نُحمِّل Google Analytics أو Facebook Pixel أو أي متعقِّب مماثل سواء على الموقع التسويقي (basiret.co) أو على لوحة تحكم التطبيق.`,
          },
        },
        {
          heading: { en: "8. Data retention", ar: "8. الاحتفاظ بالبيانات" },
          body: {
            en: `Active accounts. We retain your data for as long as your Basiret account is active. Synced Instagram data is kept indefinitely so trend analysis remains useful over time. You can disconnect an Instagram account at any moment to stop new data being synced; existing data is retained until you delete it.

Deleted accounts. When you delete your account (see Section 9), we permanently remove your user record, all synced Instagram data, AI analyses, audience segments, weekly insights, and saved goals from our database. The deletion completes within 30 days; encrypted off-site backups are rotated within the same window.

Billing records. We retain a minimal subset of billing metadata (invoice number, plan, amount, date) for as long as required by Omani tax law, even after you delete your account. This metadata does not include personally-identifying content from your Instagram data.`,
            ar: `الحسابات النشطة. نحتفظ ببياناتك طوال فترة نشاط حساب بصيرة الخاص بك. تُحفظ بيانات Instagram المتزامنة لأجل غير مسمى لتظل تحليلات الاتجاهات مفيدة بمرور الوقت. يمكنك فصل حساب Instagram في أي لحظة لإيقاف مزامنة البيانات الجديدة؛ تبقى البيانات الموجودة حتى تحذفها.

الحسابات المحذوفة. عند حذف حسابك (انظر القسم 9)، نُزيل بشكل دائم سجل المستخدم وجميع بيانات Instagram المتزامنة وتحليلات الذكاء الاصطناعي وشرائح الجمهور والرؤى الأسبوعية والأهداف المحفوظة من قاعدة بياناتنا. يكتمل الحذف خلال 30 يوماً؛ ويتم تدوير النسخ الاحتياطية المشفّرة خارج الموقع خلال الفترة نفسها.

سجلات الفوترة. نحتفظ بمجموعة دنيا من البيانات الوصفية للفوترة (رقم الفاتورة، الخطة، المبلغ، التاريخ) للمدة التي يتطلبها قانون الضرائب العُماني، حتى بعد حذف حسابك. لا تتضمن هذه البيانات الوصفية محتوى يُعرِّف شخصياً من بيانات Instagram الخاصة بك.`,
          },
        },
        {
          heading: {
            en: "9. Your rights and how to exercise them",
            ar: "9. حقوقك وكيفية ممارستها",
          },
          body: {
            en: `You have the following rights over the personal data we hold about you. To exercise any of them, email contact@basiret.co — we respond within 30 days.

Right of access. You can request a copy of all the personal data we hold about you.

Right of rectification. You can correct any inaccurate or out-of-date information directly from your Settings → Profile tab, or email us if a field is read-only.

Right of erasure ("right to be forgotten"). You can delete your account and all associated data:
1. From inside the app: go to Settings → Danger Zone, click "Delete my account", and re-enter your password to confirm. Deletion runs immediately and the cascade removes your user record, the workspace (if you are the last admin), all synced Instagram posts and comments, AI analyses, audience segments, weekly insights, and saved goals.
2. By email: send a deletion request to contact@basiret.co from the email address on file. We will action the request within 30 days.
3. Programmatically (Meta-initiated): if you remove the Basiret integration from your Facebook / Instagram settings, Meta will call our Data Deletion Callback URL at https://basiret.co/api/v1/auth/data-deletion-callback, which queues the same deletion logic for the data tied to your Meta-scoped user ID.

Right of withdrawal. You can disconnect your Instagram account at any time from Settings → Organization, or revoke Basiret's permissions from your Facebook / Instagram settings. Either action stops new data ingestion immediately.

Right of portability. We provide a machine-readable export of your account data (including Instagram-derived data) on request via contact@basiret.co.`,
            ar: `لديك الحقوق التالية على البيانات الشخصية التي نحتفظ بها عنك. لممارسة أيٍّ منها، راسلنا على contact@basiret.co — نرد خلال 30 يوماً.

حق الاطلاع. يمكنك طلب نسخة من جميع البيانات الشخصية التي نحتفظ بها عنك.

حق التصحيح. يمكنك تصحيح أي معلومات غير دقيقة أو قديمة مباشرةً من علامة الإعدادات → الملف الشخصي، أو راسلنا إذا كان الحقل للقراءة فقط.

حق المحو ("الحق في النسيان"). يمكنك حذف حسابك وجميع البيانات المرتبطة به:
1. من داخل التطبيق: انتقل إلى الإعدادات → منطقة الحذف، انقر على "احذف حسابي"، وأعد إدخال كلمة المرور للتأكيد. يتم الحذف فوراً ويُزيل التتالي سجل المستخدم ومساحة العمل (إذا كنت المسؤول الأخير) وجميع منشورات Instagram المتزامنة والتعليقات وتحليلات الذكاء الاصطناعي وشرائح الجمهور والرؤى الأسبوعية والأهداف المحفوظة.
2. عبر البريد الإلكتروني: أرسل طلب حذف إلى contact@basiret.co من عنوان البريد المسجَّل لدينا. سننفّذ الطلب خلال 30 يوماً.
3. برمجياً (بمبادرة من Meta): إذا أزلت تكامل بصيرة من إعدادات Facebook / Instagram، فستستدعي Meta رابط استرجاع حذف البيانات الخاص بنا على https://basiret.co/api/v1/auth/data-deletion-callback، الذي يضع منطق الحذف نفسه في طابور الانتظار للبيانات المرتبطة بمعرّف المستخدم لديك ضمن نطاق Meta.

حق الانسحاب. يمكنك فصل حساب Instagram في أي وقت من الإعدادات → المؤسسة، أو إلغاء صلاحيات بصيرة من إعدادات Facebook / Instagram. أيٌّ من الإجراءين يوقف استيعاب البيانات الجديدة فوراً.

حق النقل. نُقدِّم تصديراً قابلاً للقراءة آلياً لبيانات حسابك (بما في ذلك البيانات المشتقة من Instagram) عند الطلب عبر contact@basiret.co.`,
          },
        },
        {
          heading: { en: "10. Children's data", ar: "10. بيانات الأطفال" },
          body: {
            en: `Basiret is not directed at users under the age of 16, and we do not knowingly collect personal data from anyone in that age group. If you are under 16, please do not create an account or connect an Instagram account to Basiret.

If you believe we have collected data from someone under 16 without proper consent, contact contact@basiret.co and we will delete it.`,
            ar: `بصيرة غير موجَّهة إلى المستخدمين دون سن 16 عاماً، ولا نجمع عن قصد أي بيانات شخصية من أي شخص في تلك الفئة العمرية. إذا كنت دون 16 عاماً، فالرجاء عدم إنشاء حساب أو ربط حساب Instagram ببصيرة.

إذا كنت تعتقد أننا جمعنا بيانات من شخص دون 16 عاماً بدون الموافقة المناسبة، فتواصل مع contact@basiret.co وسنقوم بحذفها.`,
          },
        },
        {
          heading: { en: "11. Changes to this policy", ar: "11. التعديلات على هذه السياسة" },
          body: {
            en: `When we make a material change to how we collect, use, or share personal data, we will update this page, change the "Last updated" date at the top, and email all active users at least 30 days before the change takes effect. You can review the full revision history by emailing contact@basiret.co.`,
            ar: `عند إجراء تغيير جوهري على كيفية جمع البيانات الشخصية أو استخدامها أو مشاركتها، سنُحدِّث هذه الصفحة، ونغيِّر تاريخ "آخر تحديث" في الأعلى، ونُرسل بريداً إلكترونياً لجميع المستخدمين النشطين قبل 30 يوماً على الأقل من سريان التغيير. يمكنك مراجعة سجل المراجعات الكامل بمراسلتنا على contact@basiret.co.`,
          },
        },
        {
          heading: { en: "12. Contact", ar: "12. التواصل" },
          body: {
            en: `For any privacy question, data-export request, deletion request, or to challenge how we handle your data:

Email: contact@basiret.co
Operator: Leader Smart Technology, Sultanate of Oman

We respond to every legitimate request within 30 days.`,
            ar: `لأي استفسار يتعلق بالخصوصية أو طلب تصدير البيانات أو طلب الحذف أو الاعتراض على كيفية معالجتنا لبياناتك:

البريد الإلكتروني: contact@basiret.co
المُشغِّل: Leader Smart Technology، سلطنة عُمان

نرد على كل طلب مشروع خلال 30 يوماً.`,
          },
        },
      ]}
    />
  );
}
