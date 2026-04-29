import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import { useI18n } from "@/lib/marketing-i18n";

export type BlogPostMeta = {
  slug: string;
  title: { en: string; ar: string };
  excerpt: { en: string; ar: string };
  date: string;
  readingTime: { en: string; ar: string };
  cover: string;
  category: { en: string; ar: string };
};

export function BlogIndex({ posts }: { posts: BlogPostMeta[] }) {
  const { t, lang, dir } = useI18n();
  const tr = (b: { en: string; ar: string }) => (lang === "en" ? b.en : b.ar);

  return (
    <main dir={dir} className="pt-16">
      <section className="bg-gradient-to-b from-[#F5F3FF] to-white py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <span className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.2em] text-[#5433c2]">
            {t("The Basiret Blog", "مدونة بصيرة")}
          </span>
          <h1 className="mb-5 text-4xl font-bold leading-[1.1] tracking-tight text-[#484848] sm:text-5xl md:text-6xl">
            {t("Grow smarter, not harder", "انمُ بذكاء لا بجهد")}
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl">
            {t(
              "Guides, case studies, and playbooks for SME owners, creators, and agencies.",
              "أدلة، دراسات حالة، وأدلة عمل لأصحاب المنشآت الصغيرة، والمبدعين، والوكالات."
            )}
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {posts.map((post, i) => (
              <motion.article
                key={post.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ type: "spring", stiffness: 100, damping: 15, delay: i * 0.08 }}
              >
                <Link
                  to={`/blog/${post.slug}`}
                  className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all hover:border-[#5433c2]/40 hover:shadow-lg"
                >
                  <div className="aspect-[16/9] overflow-hidden bg-gray-100">
                    <img
                      src={post.cover}
                      alt=""
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-6">
                    <div className="mb-3 flex items-center gap-3 text-xs text-gray-500">
                      <span className="rounded-full bg-[#5433c2]/10 px-2.5 py-0.5 font-semibold text-[#5433c2]">
                        {tr(post.category)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {post.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {tr(post.readingTime)}
                      </span>
                    </div>
                    <h2 className="mb-2 text-xl font-bold text-[#484848] group-hover:text-[#5433c2] transition-colors">
                      {tr(post.title)}
                    </h2>
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                      {tr(post.excerpt)}
                    </p>
                    <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-[#5433c2]">
                      {t("Read more", "اقرأ المزيد")}
                      <ArrowRight className="size-3.5 rtl:rotate-180 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export type BlogPostProps = BlogPostMeta & {
  body: { en: string; ar: string };
};

export function BlogPost({ title, excerpt, date, readingTime, cover, category, body }: BlogPostProps) {
  const { t, lang, dir } = useI18n();
  const tr = (b: { en: string; ar: string }) => (lang === "en" ? b.en : b.ar);

  return (
    <main dir={dir} className="pt-16">
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Link
          to="/blog"
          className="mb-8 inline-flex items-center gap-1 text-sm text-[#5433c2] hover:text-[#4527a8]"
        >
          <ArrowRight className="size-3.5 rotate-180 rtl:rotate-0" />
          {t("Back to blog", "العودة إلى المدونة")}
        </Link>
        <div className="mb-6 flex items-center gap-3 text-xs text-gray-500">
          <span className="rounded-full bg-[#5433c2]/10 px-2.5 py-0.5 font-semibold text-[#5433c2]">
            {tr(category)}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            {date}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {tr(readingTime)}
          </span>
        </div>
        <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight text-[#484848] sm:text-5xl">
          {tr(title)}
        </h1>
        <p className="mb-8 text-lg leading-relaxed text-gray-600">{tr(excerpt)}</p>
        <div className="mb-10 aspect-[16/9] overflow-hidden rounded-2xl bg-gray-100">
          <img src={cover} alt="" className="size-full object-cover" />
        </div>
        <div className="prose prose-lg max-w-none text-gray-700">
          <p className="whitespace-pre-line text-base leading-relaxed sm:text-lg">{tr(body)}</p>
        </div>
      </article>
    </main>
  );
}
