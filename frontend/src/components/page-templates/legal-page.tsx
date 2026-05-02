import { useEffect, useState } from "react";
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

function slugify(input: string, fallback: number): string {
  const base = input
    .toLowerCase()
    .replace(/^[\d.]+\s*/, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return base || `section-${fallback}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function stripLeadingNumber(text: string): string {
  return text.replace(/^[\d]+[.)]\s*/, "").trim();
}

export function LegalPage({ title, updated, intro, sections }: LegalPageProps) {
  const { t, lang, dir } = useI18n();
  const tr = (b: { en: string; ar: string }) => (lang === "en" ? b.en : b.ar);

  const sectionIds = sections.map((s, i) => slugify(s.heading.en, i + 1));
  const [activeId, setActiveId] = useState<string>(sectionIds[0] ?? "");

  useEffect(() => {
    if (sectionIds.length === 0) return;

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-96px 0px -60% 0px",
        threshold: 0,
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds.join("|")]);

  const handleTocClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string
  ) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  };

  return (
    <main dir={dir} className="pt-16">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <header className="mb-12 border-b border-gray-200 pb-8">
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-[#484848] sm:text-5xl">
            {tr(title)}
          </h1>
          <p className="text-sm text-gray-500">{tr(updated)}</p>
        </header>

        <p className="mb-12 max-w-3xl whitespace-pre-line text-base leading-relaxed text-gray-600 sm:text-lg">
          {tr(intro)}
        </p>

        {/* Mobile TOC — visible only on small screens */}
        <details className="mb-10 rounded-2xl border border-gray-200 bg-gray-50/60 p-5 lg:hidden">
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t("Table of contents", "جدول المحتويات")}
          </summary>
          <ol className="mt-4 space-y-1.5">
            {sections.map((s, i) => (
              <li key={sectionIds[i]}>
                <a
                  href={`#${sectionIds[i]}`}
                  onClick={(e) => handleTocClick(e, sectionIds[i])}
                  className="flex items-baseline gap-3 rounded-lg px-2 py-1.5 text-sm leading-relaxed text-gray-600 hover:bg-white hover:text-[#5433c2]"
                >
                  <span className="text-xs tabular-nums text-gray-400">
                    {pad2(i + 1)}
                  </span>
                  <span>{stripLeadingNumber(tr(s.heading))}</span>
                </a>
              </li>
            ))}
          </ol>
        </details>

        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-16">
          {/* Sticky desktop TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                {t("Table of contents", "جدول المحتويات")}
              </p>
              <div className="mb-5 h-px w-full bg-gray-200" />
              <nav aria-label={t("Table of contents", "جدول المحتويات")}>
                <ol className="space-y-1">
                  {sections.map((s, i) => {
                    const id = sectionIds[i];
                    const isActive = id === activeId;
                    return (
                      <li key={id}>
                        <a
                          href={`#${id}`}
                          onClick={(e) => handleTocClick(e, id)}
                          className={`flex items-baseline gap-3 rounded-lg px-3 py-2 text-sm leading-snug transition-colors ${
                            isActive
                              ? "bg-[#5433c2]/8 text-[#484848] font-medium"
                              : "text-gray-500 hover:bg-gray-50 hover:text-[#484848]"
                          }`}
                        >
                          <span
                            className={`shrink-0 text-xs tabular-nums ${
                              isActive ? "text-[#5433c2]" : "text-gray-400"
                            }`}
                          >
                            {pad2(i + 1)}
                          </span>
                          <span>{stripLeadingNumber(tr(s.heading))}</span>
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <article className="max-w-3xl">
            <div className="space-y-12">
              {sections.map((s, i) => (
                <section
                  key={sectionIds[i]}
                  id={sectionIds[i]}
                  className="scroll-mt-24"
                >
                  <div className="mb-4 flex items-baseline gap-4">
                    <span className="text-sm font-medium tabular-nums text-[#5433c2]">
                      {pad2(i + 1)}.
                    </span>
                    <h2 className="text-xl font-semibold uppercase tracking-wide text-[#484848] sm:text-[1.35rem]">
                      {stripLeadingNumber(tr(s.heading))}
                    </h2>
                  </div>
                  <div className="mb-5 h-px w-full bg-gray-200" />
                  <p className="whitespace-pre-line text-base leading-relaxed text-gray-600">
                    {tr(s.body)}
                  </p>
                </section>
              ))}
            </div>

            <footer className="mt-16 rounded-2xl bg-gray-50 px-6 py-8 sm:px-8">
              <p className="text-sm leading-relaxed text-gray-600">
                {t(
                  "Have a question about this document? Email contact@basiret.co — a real person from our team will reply.",
                  "هل لديك استفسار حول هذه الوثيقة؟ راسلنا على contact@basiret.co — سيردّ عليك شخص حقيقي من فريقنا."
                )}
              </p>
            </footer>
          </article>
        </div>
      </div>
    </main>
  );
}
