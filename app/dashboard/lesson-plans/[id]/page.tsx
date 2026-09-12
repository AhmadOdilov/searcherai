import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getLessonPlan } from "@/lib/lesson-plans/service";
import { StatusBadge } from "@/components/ui/status-badge";
import { PlanActions } from "@/components/lesson-plans/plan-actions";
import { ErrorPanel } from "@/components/ui/error-panel";
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
 * foydalanuvchining yozuvi `null` qaytadi va sahifa 404 ko'rsatadi.
 */
export default async function LessonPlanDetailPage({
  params,
}: PageProps<"/dashboard/lesson-plans/[id]">) {
  const { id } = await params;
  const user = (await getCurrentUser())!;

  const plan = await getLessonPlan(id, user.id);
  // 404: boshqa foydalanuvchi yozuvi BORLIGINI ham bildirmaymiz.
  if (!plan) notFound();

  const t = await getTranslations("lessonPlans");
  const tRoot = await getTranslations();
  const locale = (await getLocale()) as UiLocale;

  // `content` — Json ustun, ya'ni TypeScript uchun `unknown`. Shaklini
  // tekshirib o'qiymiz: sxema keyinchalik o'zgarsa, eski yozuv sahifani
  // qulatmasligi kerak.
  const content = plan.content === null ? null : parseLessonPlanContent(plan.content);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/dashboard/lesson-plans"
        className="text-sm text-slate-500 underline hover:text-slate-700"
      >
        ← {tRoot("common.back")}
      </Link>

      {/* ── Sarlavha ─────────────────────────────────────────────────── */}
      <header className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">{plan.topic}</h1>
          <StatusBadge status={plan.status} />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {t("detail.meta", {
            subject: plan.subject,
            grade: plan.grade,
            type: t(`types.${plan.lessonType}`),
            duration: plan.durationMinutes,
            language: tRoot(`languages.${plan.language}`),
          })}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {formatDate(plan.createdAt, locale)}
          {plan.aiDurationMs !== null &&
            ` · ${t("detail.generatedIn", {
              seconds: (plan.aiDurationMs / 1000).toFixed(1),
            })}`}
        </p>
      </header>

      <div className="mt-5 space-y-3">
        {/* Prezentatsiya faqat TAYYOR ishlanmadan yaratiladi — mazmuni
            bo'lmasa slaydlar tuzib bo'lmaydi. */}
        {plan.status === "READY" && content !== null && (
          <Link
            href={`/dashboard/presentations/new?lessonPlanId=${plan.id}`}
            className="inline-block rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            {t("detail.createPresentation")}
          </Link>
        )}

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

      {plan.status === "PENDING" && (
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Dars ishlanmasi hali yaratilmoqda. Sahifani birozdan so&apos;ng yangilang.
        </p>
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
        <p className="text-sm leading-relaxed text-slate-700">{content.objective}</p>
      </Section>

      <Section title={t("detail.outcomes")}>
        <ul className="space-y-1.5">
          {content.outcomes.map((outcome, index) => (
            <li key={index} className="flex gap-2 text-sm text-slate-700">
              <span className="select-none text-slate-400">•</span>
              <span className="leading-relaxed">{outcome}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("detail.resources")}>
        <ul className="flex flex-wrap gap-2">
          {content.resources.map((resource, index) => (
            <li
              key={index}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
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
        <ol className="space-y-3">
          {content.stages.map((stage, index) => (
            <li key={index} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  <span className="mr-1.5 text-slate-400">{index + 1}.</span>
                  {stage.name}
                </h3>
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {t("detail.minutesShort", { minutes: stage.durationMinutes })}
                </span>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                {stage.description}
              </p>

              <dl className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-slate-500">O&apos;qituvchi</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-slate-700">
                    {stage.teacherActivity}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">O&apos;quvchilar</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-slate-700">
                    {stage.studentActivity}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      </Section>

      {content.assessmentCriteria !== undefined &&
        content.assessmentCriteria.length > 0 && (
          <Section title={t("detail.assessment")}>
            <ul className="space-y-1.5">
              {content.assessmentCriteria.map((criterion, index) => (
                <li key={index} className="flex gap-2 text-sm text-slate-700">
                  <span className="select-none text-slate-400">•</span>
                  <span className="leading-relaxed">{criterion}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
    </div>
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
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {title}
        </h2>
        {note !== undefined && (
          <p
            className={`text-xs ${
              noteTone === "warning" ? "text-amber-700" : "text-slate-400"
            }`}
          >
            {note}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
