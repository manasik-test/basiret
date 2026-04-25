import { useI18n } from "@/lib/marketing-i18n";

export type LegalSection = {
  heading: { en: string; ar: string };
  body: { en: string; ar: string };
};

export type LegalPageProps = {
  title: { en: string; ar: string };
  updated: { en: string; ar: string };
  intro: { en: string; ar: string };
  sections: LegalSection[];
};

export function LegalPage({ title, updated, intro, sections }: LegalPageProps) {
  const { lang, dir } = useI18n();
  const tr = (b: { en: string; ar: string }) => (lang === "en" ? b.en : b.ar);

  return (
    <main dir={dir} className="pt-16">
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <header className="mb-12 border-b border-gray-200 pb-8">
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-[#484848] sm:text-5xl">
            {tr(title)}
          </h1>
          <p className="text-sm text-gray-500">{tr(updated)}</p>
        </header>
        <p className="mb-10 text-base leading-relaxed text-gray-600 sm:text-lg">{tr(intro)}</p>
        <div className="space-y-8">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="mb-3 text-xl font-semibold text-[#484848] sm:text-2xl">
                {tr(s.heading)}
              </h2>
              <p className="whitespace-pre-line text-base leading-relaxed text-gray-600">
                {tr(s.body)}
              </p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
