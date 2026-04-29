import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/marketing-i18n";

/**
 * Public landing for Meta's Data Deletion Callback URL. The backend's
 * `/api/v1/auth/data-deletion-callback` returns a URL pointing here with
 * `?id=<confirmation_code>`; Meta then surfaces that URL inside the user's
 * settings so they can confirm the deletion request was received.
 *
 * The code is a server-side correlation token only — there is no DB-backed
 * "status" to check, because Meta's own contract is "queued + completed
 * within 30 days". So this page is intentionally informational, not stateful.
 */
export default function DeletionStatusPage() {
  const { t, dir } = useI18n();
  const [params] = useSearchParams();
  const code = params.get("id") ?? "";

  return (
    <main dir={dir} className="pt-16 min-h-screen">
      <section className="relative flex items-center justify-center min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-br from-[#F5F3FF] via-white to-[#EEEDFE] py-20">
        <div className="relative mx-auto max-w-2xl px-4 sm:px-6 text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-8" />
          </div>

          <span className="mb-4 inline-block rounded-full bg-[#5433c2]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#5433c2]">
            {t("Deletion request received", "تم استلام طلب الحذف")}
          </span>

          <h1 className="mb-5 text-4xl font-bold leading-[1.1] tracking-tight text-[#484848] sm:text-5xl">
            {t(
              "Your data is being deleted",
              "جارٍ حذف بياناتك",
            )}
          </h1>

          <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed text-gray-600 sm:text-xl">
            {t(
              "We received your request to delete the data tied to your Instagram account. All associated posts, comments, analyses, and segments will be permanently removed from our servers within 30 days, in line with our retention policy.",
              "استلمنا طلبك لحذف البيانات المرتبطة بحسابك على Instagram. ستُحذف جميع المنشورات والتعليقات والتحليلات والشرائح المرتبطة نهائياً من خوادمنا خلال 30 يوماً، تماشياً مع سياسة الاحتفاظ لدينا.",
            )}
          </p>

          {code && (
            <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white px-6 py-5 text-left rtl:text-right shadow-sm mb-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                {t("Confirmation code", "رمز التأكيد")}
              </p>
              <p
                className="font-mono text-sm text-[#484848] break-all"
                dir="ltr"
              >
                {code}
              </p>
              <p className="mt-3 text-xs text-gray-500 leading-relaxed">
                {t(
                  "Save this code if you'd like to follow up with us. Email contact@basiret.co with this code and we'll confirm the status of your request.",
                  "احفظ هذا الرمز إذا أردت المتابعة معنا. راسلنا على contact@basiret.co مع هذا الرمز وسنؤكد حالة طلبك.",
                )}
              </p>
            </div>
          )}

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link to="/">
              <button className="h-11 cursor-pointer rounded-xl bg-[#5433c2] px-6 font-semibold text-white hover:bg-[#4527a8] shadow-md flex items-center gap-2">
                {t("Back to home", "العودة إلى الرئيسية")}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </button>
            </Link>
            <Link
              to="/privacy"
              className="text-sm text-[#5433c2] hover:text-[#4527a8] transition-colors"
            >
              {t("Read our Privacy Policy", "اقرأ سياسة الخصوصية")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
