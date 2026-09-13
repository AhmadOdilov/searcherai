import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Presentation as PresentationIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getPresentation } from "@/lib/presentations/service";
import { PresentationActions } from "@/components/presentations/presentation-actions";
import { formatDate, formatFileSize } from "@/lib/ui/labels";
import { ErrorPanel } from "@/components/ui/error-panel";
import { GenerationProgress } from "@/components/ui/generation-progress";
import { BackLink } from "@/components/ui/back-link";
import { DetailHeader } from "@/components/ui/detail-header";
import { DownloadPanel } from "@/components/ui/download-panel";
import { PrintButton } from "@/components/ui/print-button";
import { Card } from "@/components/ui/card";
import { HelpLink } from "@/components/ui/help-link";
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

  const metaParts = [
    [presentation.subject, presentation.grade].filter(Boolean).join(" · ") ||
      t("standalone"),
    tRoot(`languages.${presentation.language}`),
  ];
  if (presentation.slideCount !== null) {
    metaParts.push(t("slideCount", { count: presentation.slideCount }));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <BackLink href="/dashboard/presentations" />

      <DetailHeader
        title={presentation.title ?? presentation.topic}
        status={presentation.status}
        meta={metaParts.join(" · ")}
        date={`${formatDate(presentation.createdAt, locale)}${
          presentation.aiDurationMs !== null
            ? ` · ${tRoot("lessonPlans.detail.generatedIn", {
                seconds: (presentation.aiDurationMs / 1000).toFixed(1),
              })}`
            : ""
        }`}
        extra={
          presentation.lessonPlanId !== null ? (
            <p className="mt-3 text-base text-neutral-600">
              {t("detail.fromLessonPlanPrefix")}{" "}
              <Link
                href={`/dashboard/lesson-plans/${presentation.lessonPlanId}`}
                className="font-medium text-primary underline underline-offset-4"
              >
                {t("detail.viewLessonPlan")}
              </Link>
            </p>
          ) : undefined
        }
      />

      {/* ── Yuklab olish ─────────────────────────────────────────────── */}
      {presentation.status === "READY" && presentation.filePath !== null && (
        <DownloadPanel
          title={t("detail.readyTitle")}
          hint={t("detail.readyHint")}
          openWith={t("detail.openWith")}
          formats={[
            {
              label: tRoot("common.downloadPowerPoint"),
              href: `/api/presentations/${presentation.id}/download`,
              icon: <PresentationIcon aria-hidden className="size-6 shrink-0" />,
              sizeLabel:
                presentation.fileSize !== null
                  ? formatFileSize(presentation.fileSize, locale)
                  : undefined,
            },
            {
              // Slaydlar ro'yxatini qog'ozga chiqarish — o'qituvchi
              // darsga qo'lida olib kirishi uchun.
              label: tRoot("common.saveAsPdf"),
              href: null,
              icon: null,
              action: <PrintButton />,
            },
          ]}
        />
      )}

      <div className="mt-4 print:hidden">
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

      <div className="mt-10 flex justify-center border-t border-neutral-200 pt-6 print:hidden">
        <HelpLink />
      </div>
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
      <h2 className="mb-4 text-2xl font-semibold text-neutral-900">
        {t("detail.slides", { count: content.slides.length })}
      </h2>

      <ol className="space-y-4">
        {content.slides.map((slide, index) => (
          <li key={index}>
            <Card
              padding="sm"
              className={
                slide.type === "title"
                  ? "border-primary-border bg-primary-soft"
                  : slide.type === "summary"
                    ? "bg-neutral-50"
                    : undefined
              }
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold text-neutral-900">
                  <span className="mr-2 text-neutral-400">{index + 1}.</span>
                  {slide.heading}
                </h3>
                <span className="shrink-0 rounded-md bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-600">
                  {t(`detail.slideTypes.${slide.type}`)}
                </span>
              </div>

              {slide.bullets.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {slide.bullets.map((bullet, bulletIndex) => (
                    <li
                      key={bulletIndex}
                      className="flex gap-3 text-base text-neutral-700"
                    >
                      <span
                        aria-hidden
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                      />
                      <span className="leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}

              {slide.speakerNotes !== undefined && (
                <p className="mt-4 border-t border-neutral-200 pt-3 text-base leading-relaxed text-neutral-600">
                  <span className="font-medium">{t("detail.speakerNotes")} </span>
                  {slide.speakerNotes}
                </p>
              )}
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
