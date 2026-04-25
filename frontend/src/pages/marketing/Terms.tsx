import { LegalPage } from "@/components/page-templates/legal-page";

export default function TermsPage() {
  return (
    <LegalPage
      title={{ en: "Terms of Service", ar: "شروط الخدمة" }}
      updated={{ en: "Last updated: April 2026", ar: "آخر تحديث: أبريل 2026" }}
      intro={{
        en: `These terms govern your use of Basiret. They're written in plain language because legal jargon helps nobody. By creating an account or connecting an Instagram Business account, you agree to them.

Basiret is operated by Leader Smart Technology (the "Operator", "we", "us"), a company registered in the Sultanate of Oman. For questions about these terms, contact us at contact@basiret.co.`,
        ar: `تحكم هذه الشروط استخدامك لبصيرة. كُتبت بلغة واضحة لأن المصطلحات القانونية لا تفيد أحداً. بإنشاء حساب أو ربط حساب Instagram تجاري، فأنت توافق عليها.

تُشغِّل بصيرة شركة Leader Smart Technology ("المُشغِّل" أو "نحن")، وهي شركة مسجَّلة في سلطنة عُمان. للاستفسار عن هذه الشروط، تواصل معنا على contact@basiret.co.`,
      }}
      sections={[
        {
          heading: { en: "1. Operator and applicable law", ar: "1. المُشغِّل والقانون الواجب التطبيق" },
          body: {
            en: `These Terms of Service form a binding agreement between you and Leader Smart Technology, a company registered in the Sultanate of Oman.

These terms, and any dispute arising under them, are governed by the laws of the Sultanate of Oman — specifically the Information Technology Transactions Law (Royal Decree No. 69/2008) and any later amendments. The competent courts of the Sultanate of Oman have exclusive jurisdiction over any dispute that cannot be resolved amicably under Section 12.`,
            ar: `تشكّل شروط الخدمة هذه اتفاقية ملزمة بينك وبين شركة Leader Smart Technology، شركة مسجَّلة في سلطنة عُمان.

تخضع هذه الشروط وأي نزاع ينشأ بموجبها لقوانين سلطنة عُمان — وتحديداً قانون المعاملات الإلكترونية (المرسوم السلطاني رقم 69/2008) وأي تعديلات لاحقة. للمحاكم المختصة في سلطنة عُمان الاختصاص الحصري بأي نزاع لا يمكن تسويته ودياً بموجب القسم 12.`,
          },
        },
        {
          heading: { en: "2. Eligibility", ar: "2. الأهلية" },
          body: {
            en: `You must be at least 16 years old to create a Basiret account. The service is not directed at users under 16, and we do not knowingly serve them. If we learn that an account belongs to someone under 16, we will close it.

You must own or be authorised to manage every Instagram account you connect to Basiret. Connecting an account you do not have rights over is a breach of these terms and may also breach Meta's Platform Terms.`,
            ar: `يجب أن تكون عمرك 16 عاماً على الأقل لإنشاء حساب بصيرة. الخدمة غير موجَّهة للمستخدمين دون 16 عاماً، ولا نخدمهم عن قصد. إذا علِمنا أن حساباً يعود لشخص دون 16 عاماً، فسنغلقه.

يجب أن تكون مالكاً لكل حساب Instagram تربطه ببصيرة أو مخوَّلاً لإدارته. ربط حساب لا تملك صلاحياته يُعدّ مخالفةً لهذه الشروط، وقد يُخالف أيضاً شروط منصّة Meta.`,
          },
        },
        {
          heading: { en: "3. Your account", ar: "3. حسابك" },
          body: {
            en: `You are responsible for keeping your login credentials safe and for everything done from your account. If you think your account is compromised, email contact@basiret.co immediately and we will help lock it down.

The account is for you. Don't share logins across your whole team — invite each member as a separate user instead.

Account deletion. You can delete your account at any time from Settings → Danger Zone, or by emailing contact@basiret.co. Deletion permanently removes your user record and, if you are the last admin of your workspace, the workspace and all of its synced Instagram data, AI analyses, and saved goals (see the Privacy Policy for the full retention schedule).`,
            ar: `أنت مسؤول عن الحفاظ على بيانات تسجيل الدخول الخاصة بك، وعن كل ما يتم من حسابك. إذا كنت تعتقد أن حسابك مخترق، راسل contact@basiret.co فوراً وسنساعدك في قفله.

الحساب لك. لا تشارك بيانات الدخول مع فريقك بالكامل — ادعُ كل عضو كمستخدم منفصل بدلاً من ذلك.

حذف الحساب. يمكنك حذف حسابك في أي وقت من الإعدادات → منطقة الحذف، أو بمراسلة contact@basiret.co. يزيل الحذف بشكل دائم سجل المستخدم لديك، وإذا كنت المسؤول الأخير في مساحة العمل، فإنه يحذف مساحة العمل وجميع بيانات Instagram المتزامنة وتحليلات الذكاء الاصطناعي والأهداف المحفوظة (انظر سياسة الخصوصية لجدول الاحتفاظ الكامل).`,
          },
        },
        {
          heading: { en: "4. Acceptable use", ar: "4. الاستخدام المقبول" },
          body: {
            en: `You may use Basiret to analyse Instagram accounts you own or are authorised to manage, connect as many accounts as your plan allows, and export your own data at any time.

You may NOT:
• Use Basiret to scrape, copy, or analyse Instagram accounts you do not manage
• Reverse-engineer the product, our APIs, or our AI prompts
• Resell, white-label, or redistribute our data, AI outputs, or the service itself without a written enterprise agreement
• Use Basiret in any way that violates Meta's Platform Terms or any platform's terms of service
• Attempt to overload, probe, or attack our infrastructure, or extract data from accounts other than your own
• Upload, generate, or instruct our AI to produce illegal, defamatory, hateful, or sexually explicit content

We may suspend or terminate accounts that breach these rules. Repeat or egregious abuse may be referred to the relevant platform or to law-enforcement authorities.`,
            ar: `يمكنك استخدام بصيرة لتحليل حسابات Instagram التي تملكها أو مخوَّل لإدارتها، وربط عدد من الحسابات يسمح به اشتراكك، وتصدير بياناتك في أي وقت.

لا يجوز لك:
• استخدام بصيرة لكشط أو نسخ أو تحليل حسابات Instagram لا تديرها
• إجراء هندسة عكسية للمنتج أو واجهات برمجة التطبيقات أو موجِّهات الذكاء الاصطناعي لدينا
• إعادة بيع بياناتنا أو مخرجات الذكاء الاصطناعي أو الخدمة نفسها، أو وضعها بعلامة بيضاء أو إعادة توزيعها بدون اتفاقية مؤسسية مكتوبة
• استخدام بصيرة بأي شكل يخالف شروط منصّة Meta أو شروط خدمة أي منصة
• محاولة إثقال بنيتنا التحتية أو فحصها أو مهاجمتها، أو استخراج بيانات من حسابات غير حسابك
• تحميل أو توليد أو توجيه الذكاء الاصطناعي لإنتاج محتوى غير قانوني أو تشهيري أو مُحرِّض على الكراهية أو ذي طابع جنسي صريح

يجوز لنا تعليق أو إنهاء الحسابات التي تنتهك هذه القواعد. وقد تُحال الانتهاكات المتكرّرة أو الجسيمة إلى المنصّة المعنية أو إلى السلطات المختصة.`,
          },
        },
        {
          heading: { en: "5. Intellectual property", ar: "5. الملكية الفكرية" },
          body: {
            en: `Your data is yours. Anything you upload, sync from Instagram, or generate using Basiret's AI tools remains your property. You grant us a non-exclusive, royalty-free licence to process that data solely as needed to operate the service for you (running analyses, generating insights, producing reports). That licence ends when you delete the data or your account.

Our software is ours. The Basiret platform — including its source code, design, brand, AI prompts, and documentation — is owned by Leader Smart Technology and is protected by copyright and trade-mark laws. These terms grant you a limited, non-transferable, revocable right to use the service; they do not transfer any ownership of the platform itself.

Aggregated learnings. We may use anonymised, aggregated patterns across all customers (e.g. "video posts get on average 1.4× the engagement of static posts") to improve our recommendation engine. No individually-identifying data leaves your account in this process.`,
            ar: `بياناتك ملك لك. كل ما تُحمِّله أو تُزامنه من Instagram أو تُولِّده باستخدام أدوات الذكاء الاصطناعي في بصيرة يبقى ملكاً لك. تمنحنا ترخيصاً غير حصري وخالياً من حقوق الملكية لمعالجة تلك البيانات فقط بالقدر اللازم لتشغيل الخدمة لك (تشغيل التحليلات، توليد الرؤى، إنتاج التقارير). ينتهي هذا الترخيص عند حذفك للبيانات أو حذف حسابك.

برمجياتنا ملك لنا. منصّة بصيرة — بما في ذلك الكود المصدري والتصميم والعلامة التجارية وموجِّهات الذكاء الاصطناعي والوثائق — مملوكة لشركة Leader Smart Technology ومحمية بموجب قوانين حقوق التأليف والنشر والعلامات التجارية. تمنحك هذه الشروط حقاً محدوداً وغير قابل للتحويل وقابلاً للإلغاء لاستخدام الخدمة؛ ولا تنقل أي ملكية للمنصّة نفسها.

الاستفادات المُجمَّعة. يجوز لنا استخدام أنماط مجهولة الهوية ومُجمَّعة عبر جميع العملاء (مثلاً "تحصل منشورات الفيديو في المتوسط على 1.4 ضعف تفاعل المنشورات الثابتة") لتحسين محرّك التوصيات لدينا. ولا تخرج أي بيانات تعريفية فردية من حسابك في هذه العملية.`,
          },
        },
        {
          heading: { en: "6. Subscriptions and billing", ar: "6. الاشتراكات والفوترة" },
          body: {
            en: `Plans are billed monthly or yearly in advance through Stripe. You can cancel anytime — you keep access until the end of the period you have already paid for.

We do not issue pro-rated refunds, but if a feature is materially broken because of a bug on our side, we will always make it right.

Price changes apply to your next renewal. We will email you at least 30 days before any price change takes effect.

Failed payments. If a payment fails, your subscription is marked past_due and Pro features are temporarily locked. We will retry the charge several times over a 14-day window. If we cannot collect, the account is downgraded to the free Starter tier and remains accessible.`,
            ar: `تُحاسَب الخطط شهرياً أو سنوياً مقدماً عبر Stripe. يمكنك الإلغاء في أي وقت — وتبقى لك الصلاحية حتى نهاية الفترة التي دفعتها مسبقاً.

لا نُصدر استرداداً تناسبياً، ولكن إذا تعطّلت ميزة جوهرياً بسبب خطأ من جانبنا، فسنُصلح ذلك دائماً.

تطبَّق تغييرات الأسعار على تجديدك التالي. سنُرسل لك بريداً إلكترونياً قبل 30 يوماً على الأقل من سريان أي تغيير سعري.

المدفوعات الفاشلة. إذا فشل الدفع، يُوسم اشتراكك past_due وتُقفَل الميزات المدفوعة مؤقتاً. سنُعيد محاولة الخصم عدة مرات خلال 14 يوماً. إذا تعذّر التحصيل، يُخفَّض الحساب إلى الفئة المجانية Starter ويبقى قابلاً للاستخدام.`,
          },
        },
        {
          heading: { en: "7. Termination", ar: "7. الإنهاء" },
          body: {
            en: `By you. You can stop using Basiret at any time. To delete your account and data, see Section 3.

By us. We may suspend or terminate your account if you breach these terms, abuse the service, or expose us to legal risk. Where reasonable we will give you notice and an opportunity to cure the breach before terminating.

Effect of termination. On termination, your access to the service ends. Your data is retained or deleted according to the schedule in Section 8 of the Privacy Policy.`,
            ar: `بمبادرة منك. يمكنك التوقف عن استخدام بصيرة في أي وقت. لحذف الحساب والبيانات، انظر القسم 3.

بمبادرة منا. يجوز لنا تعليق أو إنهاء حسابك إذا انتهكت هذه الشروط، أو أسأت استخدام الخدمة، أو عرَّضتنا لمخاطر قانونية. ومتى أمكن، سنُعلمك ونمنحك فرصة لتصحيح الانتهاك قبل الإنهاء.

أثر الإنهاء. عند الإنهاء، ينتهي وصولك إلى الخدمة. تُحفظ بياناتك أو تُحذف وفقاً للجدول الوارد في القسم 8 من سياسة الخصوصية.`,
          },
        },
        {
          heading: { en: "8. Service availability", ar: "8. توفُّر الخدمة" },
          body: {
            en: `We work hard to keep Basiret available, but we do not guarantee uptime, specific response times, or specific growth outcomes for your social media accounts.

Social platforms (Meta, Instagram) periodically change their APIs or revoke permissions. When that happens, some features may be temporarily affected. We will communicate openly via the dashboard or email when this occurs.

Scheduled maintenance is announced at least 48 hours in advance via the dashboard. Emergency maintenance may occur without notice.`,
            ar: `نعمل جاهدين على إبقاء بصيرة متاحة، لكننا لا نضمن وقت تشغيل أو أوقات استجابة محدّدة أو نتائج نمو محدّدة لحساباتك على وسائل التواصل الاجتماعي.

تُغيّر منصّات التواصل الاجتماعي (Meta، Instagram) واجهات برمجة التطبيقات أو تسحب الصلاحيات بشكل دوري. عند حدوث ذلك، قد تتأثر بعض الميزات مؤقتاً. سنتواصل بصراحة عبر لوحة التحكم أو البريد الإلكتروني عند وقوع ذلك.

يُعلَن عن الصيانة المجدولة قبل 48 ساعة على الأقل عبر لوحة التحكم. وقد تحدث صيانة طارئة بدون إشعار مسبق.`,
          },
        },
        {
          heading: {
            en: "9. Warranty disclaimer",
            ar: "9. إخلاء المسؤولية عن الضمانات",
          },
          body: {
            en: `THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR THE ACCURACY OF AI-GENERATED INSIGHTS.

AI outputs (sentiment scores, persona descriptions, content recommendations, weekly insights, captions) are produced by third-party machine-learning models that can be wrong. They are decision support, not professional advice. You remain fully responsible for any decision you make based on Basiret's outputs.`,
            ar: `تُقدَّم الخدمة "كما هي" و"كما هي متاحة"، دون ضمانات من أي نوع، صريحة أو ضمنية، بما في ذلك على سبيل المثال لا الحصر القابلية للتسويق أو الملاءمة لغرض معيّن أو عدم انتهاك حقوق الغير أو دقة الرؤى المُولَّدة بالذكاء الاصطناعي.

مخرجات الذكاء الاصطناعي (درجات المشاعر، أوصاف الشرائح، توصيات المحتوى، الرؤى الأسبوعية، نصوص المنشورات) تُنتَج بنماذج تعلُّم آلي من أطراف ثالثة قد تخطئ. هي دعم لاتخاذ القرار، لا نصيحة احترافية. وتظل المسؤولية الكاملة عن أي قرار تتخذه بناءً على مخرجات بصيرة على عاتقك.`,
          },
        },
        {
          heading: { en: "10. Liability", ar: "10. المسؤولية" },
          body: {
            en: `To the maximum extent permitted by Omani law, the Operator's total aggregate liability arising out of or relating to the service is limited to the greater of (a) the total amount you paid us in the 12 months immediately preceding the event giving rise to the claim, or (b) USD 100.

We are not liable for indirect, incidental, special, consequential, or punitive damages — including lost profits, lost business, lost data, or reputational harm — even if we have been advised of the possibility of such damages.

Some of these limitations may not apply if Omani law does not allow them.`,
            ar: `إلى الحد الأقصى الذي يسمح به القانون العُماني، تقتصر المسؤولية الإجمالية للمُشغِّل عن الخدمة على الأكبر من (أ) إجمالي ما دفعته لنا في الـ 12 شهراً السابقة مباشرة للحدث الذي أدّى إلى المطالبة، أو (ب) 100 دولار أمريكي.

لسنا مسؤولين عن الأضرار غير المباشرة أو العرضية أو الخاصة أو التبعية أو العقابية — بما في ذلك خسارة الأرباح أو فقدان الأعمال أو فقدان البيانات أو الإضرار بالسمعة — حتى لو أُبلغنا بإمكانية حدوث هذه الأضرار.

قد لا تنطبق بعض هذه القيود إذا كان القانون العُماني لا يسمح بها.`,
          },
        },
        {
          heading: { en: "11. Indemnification", ar: "11. التعويض" },
          body: {
            en: `You agree to indemnify and hold the Operator harmless from any claim, demand, loss, or expense (including reasonable legal fees) arising out of (a) your breach of these terms, (b) your misuse of the service, or (c) your violation of any third party's rights — including Meta's Platform Terms, copyright, or privacy rights.`,
            ar: `توافق على تعويض المُشغِّل وحمايته من أي مطالبة أو طلب أو خسارة أو نفقة (بما في ذلك أتعاب قانونية معقولة) ناشئة عن (أ) انتهاكك لهذه الشروط، أو (ب) إساءة استخدامك للخدمة، أو (ج) انتهاكك لحقوق أي طرف ثالث — بما في ذلك شروط منصّة Meta أو حقوق التأليف والنشر أو الخصوصية.`,
          },
        },
        {
          heading: {
            en: "12. Governing law and dispute resolution",
            ar: "12. القانون الواجب التطبيق وتسوية النزاعات",
          },
          body: {
            en: `These terms are governed by the laws of the Sultanate of Oman, including the Information Technology Transactions Law (Royal Decree No. 69/2008) and any later amendments.

Before filing any legal action, both parties agree to attempt good-faith resolution by exchanging written notices and meeting (in person or by video) at least once within 30 days of the dispute being raised. If that does not resolve the matter, the competent courts of the Sultanate of Oman have exclusive jurisdiction.

The United Nations Convention on Contracts for the International Sale of Goods does not apply to these terms.`,
            ar: `تخضع هذه الشروط لقوانين سلطنة عُمان، بما في ذلك قانون المعاملات الإلكترونية (المرسوم السلطاني رقم 69/2008) وأي تعديلات لاحقة.

قبل اللجوء إلى أي إجراء قانوني، يوافق الطرفان على محاولة التسوية بحسن نية عبر تبادل إشعارات مكتوبة والاجتماع (شخصياً أو عبر الفيديو) مرة واحدة على الأقل خلال 30 يوماً من إثارة النزاع. وإذا لم يحلّ ذلك المسألة، فإن للمحاكم المختصّة في سلطنة عُمان الاختصاص الحصري.

لا تنطبق اتفاقية الأمم المتحدة بشأن عقود البيع الدولي للبضائع على هذه الشروط.`,
          },
        },
        {
          heading: { en: "13. Changes to these terms", ar: "13. التعديلات على هذه الشروط" },
          body: {
            en: `We may update these terms from time to time. When we do, we will change the "Last updated" date at the top, post the new version on this page, and email all active users at least 30 days before the new terms take effect.

If you keep using Basiret after a change takes effect, you accept the new terms. If you don't agree to a change, you can delete your account before the effective date.`,
            ar: `قد نقوم بتحديث هذه الشروط من وقت لآخر. وعندما نفعل ذلك، سنغيّر تاريخ "آخر تحديث" في الأعلى، وننشر النسخة الجديدة على هذه الصفحة، ونُرسل بريداً إلكترونياً لجميع المستخدمين النشطين قبل 30 يوماً على الأقل من سريان الشروط الجديدة.

إذا واصلت استخدام بصيرة بعد سريان التغيير، فإنك تقبل الشروط الجديدة. وإذا لم توافق على التغيير، يمكنك حذف حسابك قبل تاريخ السريان.`,
          },
        },
        {
          heading: { en: "14. Contact", ar: "14. التواصل" },
          body: {
            en: `Questions about these terms, or any other legal matter:

Email: contact@basiret.co
Operator: Leader Smart Technology, Sultanate of Oman

We reply.`,
            ar: `الاستفسارات عن هذه الشروط، أو عن أي مسألة قانونية أخرى:

البريد الإلكتروني: contact@basiret.co
المُشغِّل: Leader Smart Technology، سلطنة عُمان

نرد.`,
          },
        },
      ]}
    />
  );
}
