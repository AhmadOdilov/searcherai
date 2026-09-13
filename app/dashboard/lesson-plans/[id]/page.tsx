import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { FileText, Presentation } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getLessonPlan } from "@/lib/lesson-plans/service";
import { PlanActions } from "@/components/lesson-plans/plan-actions";
import { ErrorPanel } from "@/components/ui/error-panel";
import { GenerationProgress } from "@/components/ui/generation-progress";
import { BackLink } from "@/components/ui/back-link";
import { DetailHeader } from "@/components/ui/detail-header";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { DownloadPanel } from "@/components/ui/download-panel";
import { PrintButton } from "@/components/ui/print-button";
import { HelpLink } from "@/components/ui/help-link";
import { PROGRESS_KEYS, TYPICAL_SECONDS } from "@/lib/lesson-plans/labels";
import { formatDate } from "@/lib/ui/labels";
import { translateStoredError } from "@/lib/i18n/stored-error";
import type { UiLocale } from "@/lib/i18n/config";
import {
  parseLessonPlanContent,
  totalStageMinutes,
  type LessonPlanContent,
} from "@/lib/validations/lesson-plan";

/**
 * `/dashboard/lesson-plans/[id]` — dars ishlanmasini ko'rish.
 *
 * Egalik SERVIS qatlamida tekshiriladi (`where: { id, userId }`) — boshqa
 * foydalanuvchining yozuvi `null` qaytadi va sahifa "topilmadi" ko'rsatadi.
 */
export default async function LessonPlanDetailPage({
  params,
}: PageProps<"/dashboard/lesson-plans/[id]">) {
  const { id } = await params;
  const user = (await getCurrentUser())!;

  const plan = await getLessonPlan(id, user.id);
  // Boshqa foydalanuvchi yozuvi BORLIGINI ham bildirmaymiz.
  if (!plan) notFound();

  const t = await getTranslations("lessonPlans");
  const tRoot = await getTranslations();
  const locale = (await getLocale()) as UiLocale;

  // `content` — Json ustun, ya'ni TypeScript uchun `unknown`. Shaklini
  // tekshirib o'qiymiz: sxema keyinchalik o'zgarsa, eski yozuv sahifani
  // qulatmasligi kerak.
  const content = plan.content === null ? null : parseLessonPlanContent(plan.content);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <BackLink href="/dashboard/lesson-plans" />

      <DetailHeader
        title={plan.topic}
        status={plan.status}
        meta={t("detail.meta", {
          subject: plan.subject,
          grade: plan.grade,
          type: t(`types.${plan.lessonType}`),
          duration: plan.durationMinutes,
          language: tRoot(`languages.${plan.language}`),
        })}
        date={`${formatDate(plan.createdAt, locale)}${
          plan.aiDurationMs !== null
            ? ` · ${t("detail.generatedIn", {
                seconds: (plan.aiDurationMs / 1000).toFixed(1),
              })}`
            : ""
        }`}
      />

      {/* ── Olib ketish: Word va PDF ─────────────────────────────────── */}
      {plan.status === "READY" && content !== null && (
        <DownloadPanel
          title={t("detail.readyTitle")}
          hint={t("detail.readyHint")}
          openWith={t("detail.openWith")}
          formats={[
            {
              label: tRoot("common.downloadWord"),
              href: `/api/lesson-plans/${plan.id}/export`,
              icon: <FileText aria-hidden className="size-6 shrink-0" />,
            },
            {
              label: tRoot("common.saveAsPdf"),
              href: null,
              icon: null,
              action: <PrintButton />,
            },
          ]}
        />
      )}

      {/* Prezentatsiya faqat TAYYOR ishlanmadan yaratiladi — mazmuni
          bo'lmasa slaydlar tuzib bo'lmaydi. */}
      {plan.status === "READY" && content !== null && (
        <div className="mt-6 print:hidden">
          <LinkButton
            href={`/dashboard/presentations/new?lessonPlanId=${plan.id}`}
            size="lg"
            icon={<Presentation aria-hidden className="size-5" />}
          >
            {t("detail.createPresentation")}
          </LinkButton>
        </div>
      )}

      <div className="mt-4 print:hidden">
        <PlanActions planId={plan.id} status={plan.status} />
      </div>

      {/* ── Holatga qarab mazmun ─────────────────────────────────────── */}
      {plan.status === "FAILED" && (
        <ErrorPanel
          title={t("detail.failedTitle")}
          hint={t("detail.failedHint")}
          message={
            plan.errorMessage === null
              ? tRoot("errors.unknown")
              : translateStoredError(tRoot, plan.errorMessage)
          }
        />
      )}

      {/*
        Tayyorlanayotgan paytda jarayon KUZATILADI: komponent har 2
        soniyada yozuvni so'rab turadi va tugagach sahifani yangilaydi.
      */}
      {plan.status === "PENDING" && (
        <GenerationProgress
          resource="/api/lesson-plans"
          payloadKey="lessonPlan"
          recordId={plan.id}
          progressKeys={PROGRESS_KEYS}
          namespace="lessonPlans"
          typicalSeconds={TYPICAL_SECONDS}
        />
      )}

      {plan.status === "READY" && content === null && (
        <ErrorPanel
          title={t("detail.failedTitle")}
          hint={t("detail.failedHint")}
          message={t("detail.brokenContent")}
        />
      )}

      {plan.status === "READY" && content !== null && (
        <LessonPlanView content={content} durationMinutes={plan.durationMinutes} t={t} />
      )}

      <div className="mt-10 flex justify-center border-t border-neutral-200 pt-6 print:hidden">
        <HelpLink />
      </div>
    </div>
  );
}

/** Tayyor dars ishlanmasini o'qish uchun qulay ko'rinishda ko'rsatadi. */
type Translator = (key: string, values?: Record<string, string | number>) => string;

function LessonPlanView({
  content,
  durationMinutes,
  t,
}: {
  content: LessonPlanContent;
  durationMinutes: number;
  t: Translator;
}) {
  const stagesTotal = totalStageMinutes(content);
  // AI vaqtni har doim aniq taqsimlay olmaydi — farqni yashirmaymiz,
  // o'qituvchi ko'rib o'zi tuzatadi.
  const mismatch = stagesTotal !== durationMinutes;

  return (
    <div className="mt-8 space-y-8">
      <Section title={t("detail.objective")}>
        <p className="text-base leading-relaxed text-neutral-700">{content.objective}</p>
      </Section>

      <Section title={t("detail.outcomes")}>
        <BulletList items={content.outcomes} />
      </Section>

      <Section title={t("detail.resources")}>
        <ul className="flex flex-wrap gap-2">
          {content.resources.map((resource, index) => (
            <li
              key={index}
              className="rounded-md bg-neutral-100 px-3 py-1 text-base text-neutral-700"
            >
              {resource}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={t("detail.stages")}
        note={
          mismatch
            ? t("detail.durationMismatch", {
                actual: stagesTotal,
                expected: durationMinutes,
              })
            : t("detail.totalMinutes", { minutes: stagesTotal })
        }
        noteTone={mismatch ? "warning" : "muted"}
      >
        <ol className="space-y-4">
          {content.stages.map((stage, index) => (
            <li key={index}>
              <Card padding="sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold text-neutral-900">
                    <span className="mr-2 text-neutral-400">{index + 1}.</span>
                    {stage.name}
                  </h3>
                  <span className="shrink-0 rounded-md bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-600">
                    {t("detail.minutesShort", { minutes: stage.durationMinutes })}
                  </span>
                </div>

                <p className="mt-2 text-base leading-relaxed text-neutral-700">
                  {stage.description}
                </p>

                <dl className="mt-4 grid gap-4 border-t border-neutral-200 pt-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">
                      {t("detail.teacher")}
                    </dt>
                    <dd className="mt-1 text-base leading-relaxed text-neutral-700">
                      {stage.teacherActivity}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">
                      {t("detail.students")}
                    </dt>
                    <dd className="mt-1 text-base leading-relaxed text-neutral-700">
                      {stage.studentActivity}
                    </dd>
                  </div>
                </dl>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      {content.assessmentCriteria !== undefined &&
        content.assessmentCriteria.length > 0 && (
          <Section title={t("detail.assessment")}>
            <BulletList items={content.assessmentCriteria} />
          </Section>
        )}
    </div>
  );
}

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3 text-base text-neutral-700">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({
  title,
  note,
  noteTone = "muted",
  children,
}: {
  title: string;
  note?: string;
  noteTone?: "muted" | "warning";
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-semibold text-neutral-900">{title}</h2>
        {note !== undefined && (
          <p
            className={
              noteTone === "warning"
                ? "text-base text-accent-ink"
                : "text-base text-neutral-500"
            }
          >
            {note}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
