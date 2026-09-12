import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPresentation } from "@/lib/presentations/service";
import { StatusBadge } from "@/components/ui/status-badge";
import { PresentationActions } from "@/components/presentations/presentation-actions";
import { formatDate, formatFileSize } from "@/lib/ui/labels";
import { ErrorPanel } from "@/components/ui/error-panel";
import { GenerationProgress } from "@/components/ui/generation-progress";
import { PROGRESS_KEYS, TYPICAL_SECONDS } from "@/lib/presentations/labels";
import { translateStoredError } from "@/lib/i18n/stored-error";
import type { UiLocale } from "@/lib/i18n/config";
import {
  parsePresentationContent,
  type PresentationContent,
} from "@/lib/validations/presentation";

/** `/dashboard/presentations/[id]` — prezentatsiyani ko'rish va yuklab olish. */
export default async function PresentationDetailPage({
  params,
}: PageProps<"/dashboard/presentations/[id]">) {
  const { id } = await params;
  const user = (await getCurrentUser())!;

  const presentation = await getPresentation(id, user.id);
  if (!presentation) notFound();

  const t = await getTranslations("presentations");
  const tRoot = await getTranslations();
  const locale = (await getLocale()) as UiLocale;

  const content =
    presentation.content === null ? null : parsePresentationContent(presentation.content);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/dashboard/presentations"
        className="text-sm text-slate-500 underline hover:text-slate-700"
      >
        ← {tRoot("common.back")}
      </Link>

      <header className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {presentation.title ?? presentation.topic}
          </h1>
          <StatusBadge status={presentation.status} />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {[presentation.subject, presentation.grade].filter(Boolean).join(" · ") ||
            t("standalone")}
          {" · "}
          {tRoot(`languages.${presentation.language}`)}
          {presentation.slideCount !== null &&
            ` · ${t("slideCount", { count: presentation.slideCount })}`}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {formatDate(presentation.createdAt, locale)}
          {presentation.aiDurationMs !== null &&
            ` · ${tRoot("lessonPlans.detail.generatedIn", {
              seconds: (presentation.aiDurationMs / 1000).toFixed(1),
            })}`}
        </p>

        {presentation.lessonPlanId !== null && (
          <p className="mt-2 text-xs text-slate-500">
            {t("detail.fromLessonPlanPrefix")}{" "}
            <Link
              href={`/dashboard/lesson-plans/${presentation.lessonPlanId}`}
              className="underline hover:text-slate-700"
            >
              {t("detail.viewLessonPlan")}
            </Link>
          </p>
        )}
      </header>

      {/* ── Yuklab olish ─────────────────────────────────────────────── */}
      {presentation.status === "READY" && presentation.filePath !== null && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">{t("detail.readyTitle")}</p>
          <p className="mt-1 text-xs text-emerald-800">{t("detail.readyHint")}</p>
          {/*
            Oddiy havola (fetch emas): brauzer faylni o'zi yuklab oladi va
            `Content-Disposition` sarlavhasidagi nomni ishlatadi. Cookie
            avtomatik ketadi, ya'ni egalik tekshiruvi ishlaydi.
          */}
          <a
            href={`/api/presentations/${presentation.id}/download`}
            className="mt-3 inline-block rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            {tRoot("common.download")}
            {presentation.fileSize !== null &&
              ` · ${formatFileSize(presentation.fileSize, locale)}`}
          </a>
        </div>
      )}

      <div className="mt-5">
        <PresentationActions
          presentationId={presentation.id}
          status={presentation.status}
        />
      </div>

      {/* ── Holatga qarab mazmun ─────────────────────────────────────── */}
      {presentation.status === "FAILED" && (
        <ErrorPanel
          title={t("detail.failedTitle")}
          hint={t("detail.failedHint")}
          message={
            presentation.errorMessage === null
              ? tRoot("errors.unknown")
              : translateStoredError(tRoot, presentation.errorMessage)
          }
        />
      )}

      {/*
        PENDING holatida jarayon KUZATILADI: komponent har 2 soniyada
        yozuvni so'rab turadi va tugagach sahifani yangilaydi. Ilgari bu
        yerda shunchaki "birozdan so'ng yangilang" degan matn turardi.
      */}
      {presentation.status === "PENDING" && (
        <GenerationProgress
          resource="/api/presentations"
          payloadKey="presentation"
          recordId={presentation.id}
          progressKeys={PROGRESS_KEYS}
          namespace="presentations"
          typicalSeconds={TYPICAL_SECONDS}
        />
      )}

      {presentation.status === "READY" && content === null && (
        <ErrorPanel
          title={t("detail.failedTitle")}
          hint={t("detail.failedHint")}
          message={t("detail.brokenContent")}
        />
      )}

      {presentation.status === "READY" && content !== null && (
        <SlidesPreview content={content} t={t} />
      )}
    </div>
  );
}

/**
 * Slaydlar ko'rinishi.
 *
 * Fayl yuklab olinmasdan ham nima chiqqanini ko'rish uchun — o'qituvchi
 * PowerPoint ochmasdan tekshiradi va kerak bo'lsa qaytadan yaratadi.
 */
type Translator = (key: string, values?: Record<string, string | number>) => string;

function SlidesPreview({ content, t }: { content: PresentationContent; t: Translator }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {t("detail.slides", { count: content.slides.length })}
      </h2>

      <ol className="space-y-3">
        {content.slides.map((slide, index) => (
          <li
            key={index}
            className={`rounded-xl border p-4 ${
              slide.type === "title"
                ? "border-slate-800 bg-slate-900"
                : slide.type === "summary"
                  ? "border-slate-300 bg-slate-50"
                  : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3
                className={`text-sm font-semibold ${
                  slide.type === "title" ? "text-white" : "text-slate-900"
                }`}
              >
                <span
                  className={`mr-1.5 ${
                    slide.type === "title" ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {index + 1}.
                </span>
                {slide.heading}
              </h3>
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                  slide.type === "title"
                    ? "bg-slate-700 text-slate-200"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {t(`detail.slideTypes.${slide.type}`)}
              </span>
            </div>

            {slide.bullets.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {slide.bullets.map((bullet, bulletIndex) => (
                  <li
                    key={bulletIndex}
                    className={`flex gap-2 text-sm ${
                      slide.type === "title" ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    <span className="select-none text-slate-400">•</span>
                    <span className="leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>
            )}

            {slide.speakerNotes !== undefined && (
              <p
                className={`mt-3 border-t pt-2.5 text-xs leading-relaxed ${
                  slide.type === "title"
                    ? "border-slate-700 text-slate-400"
                    : "border-slate-100 text-slate-500"
                }`}
              >
                <span className="font-medium">{t("detail.speakerNotes")} </span>
                {slide.speakerNotes}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
