import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getCalendarPlan } from "@/lib/calendar-plans/service";
import { StatusBadge } from "@/components/ui/status-badge";
import { CalendarPlanActions } from "@/components/calendar-plans/plan-actions";
import { formatDate, formatFileSize } from "@/lib/ui/labels";
import { ErrorPanel } from "@/components/ui/error-panel";
import { translateStoredError } from "@/lib/i18n/stored-error";
import type { UiLocale } from "@/lib/i18n/config";
import { formatShortDate } from "@/lib/calendar-plans/labels";
import {
  parseCalendarPlanContent,
  totalHours,
  totalRowCount,
  type CalendarPlanContent,
} from "@/lib/validations/calendar-plan";

/** `/dashboard/calendar-plans/[id]` — rejani ko'rish va yuklab olish. */
export default async function CalendarPlanDetailPage({
  params,
}: PageProps<"/dashboard/calendar-plans/[id]">) {
  const { id } = await params;
  const user = (await getCurrentUser())!;

  const plan = await getCalendarPlan(id, user.id);
  if (!plan) notFound();

  const t = await getTranslations("calendarPlans");
  const tRoot = await getTranslations();
  const locale = (await getLocale()) as UiLocale;

  const content = plan.content === null ? null : parseCalendarPlanContent(plan.content);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/dashboard/calendar-plans"
        className="text-sm text-slate-500 underline hover:text-slate-700"
      >
        ← {tRoot("common.back")}
      </Link>

      <header className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {plan.title ?? `${plan.subject} — ${plan.period}`}
          </h1>
          <StatusBadge status={plan.status} />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {plan.subject} · {plan.grade} · {plan.period} ·{" "}
          {t("meta", { weeks: plan.weeks, hours: plan.hoursPerWeek })} ·{" "}
          {tRoot(`languages.${plan.language}`)}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {t("detail.startsFrom", {
            date: formatShortDate(plan.startDate, locale),
          })}{" "}
          · {formatDate(plan.createdAt, locale)}
          {plan.aiDurationMs !== null &&
            ` · ${tRoot("lessonPlans.detail.generatedIn", {
              seconds: (plan.aiDurationMs / 1000).toFixed(1),
            })}`}
        </p>
      </header>

      {plan.status === "READY" && plan.filePath !== null && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">{t("detail.readyTitle")}</p>
          <p className="mt-1 text-xs text-emerald-800">{t("detail.readyHint")}</p>
          <a
            href={`/api/calendar-plans/${plan.id}/download`}
            className="mt-3 inline-block rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            {tRoot("common.download")}
            {plan.fileSize !== null && ` · ${formatFileSize(plan.fileSize, locale)}`}
          </a>
        </div>
      )}

      <div className="mt-5">
        <CalendarPlanActions planId={plan.id} status={plan.status} />
      </div>

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
          {t("detail.pending")}
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
        <PlanTable
          content={content}
          expectedHours={plan.weeks * plan.hoursPerWeek}
          t={t}
        />
      )}
    </div>
  );
}

/**
 * Reja jadvali.
 *
 * Excel faylidagi bilan bir xil tuzilish — o'qituvchi yuklab olmasdan ham
 * nima chiqqanini ko'radi.
 */
type Translator = (key: string, values?: Record<string, string | number>) => string;

function PlanTable({
  content,
  expectedHours,
  t,
}: {
  content: CalendarPlanContent;
  expectedHours: number;
  t: Translator;
}) {
  const hours = totalHours(content);
  const rows = totalRowCount(content);
  // AI soatni har doim aniq taqsimlay olmaydi — farqni yashirmaymiz.
  const mismatch = hours !== expectedHours;
  const tRootTotal = t("detail.columns.hours") && t("detail.totalHours", { hours });

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {t("detail.tableTitle", { weeks: content.weeks.length, rows })}
        </h2>
        <p className={`text-xs ${mismatch ? "text-amber-700" : "text-slate-400"}`}>
          {mismatch
            ? t("detail.hoursMismatch", { actual: hours, expected: expectedHours })
            : t("detail.totalHours", { hours })}
        </p>
      </div>

      {/* Tor ekranda gorizontal siljish — jadval siqilib ketmasin. */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-900 text-left text-xs text-white">
              <th className="px-3 py-2.5 font-medium">{t("detail.columns.week")}</th>
              <th className="px-3 py-2.5 font-medium">{t("detail.columns.dateRange")}</th>
              <th className="px-3 py-2.5 font-medium">{t("detail.columns.topic")}</th>
              <th className="px-3 py-2.5 text-center font-medium">
                {t("detail.columns.hours")}
              </th>
              <th className="px-3 py-2.5 font-medium">{t("detail.columns.note")}</th>
            </tr>
          </thead>
          <tbody>
            {content.weeks.map((week) =>
              week.topics.map((topic, topicIndex) => (
                <tr
                  key={`${week.weekNumber}-${topicIndex}`}
                  className="border-t border-slate-100 align-top"
                >
                  {/* Hafta raqami va sanasi faqat birinchi qatorda — Excel'dagi
                      birlashtirilgan katakcha kabi. */}
                  {topicIndex === 0 ? (
                    <>
                      <td
                        rowSpan={week.topics.length}
                        className="border-r border-slate-100 bg-slate-50 px-3 py-2.5 text-center font-medium text-slate-900"
                      >
                        {week.weekNumber}
                      </td>
                      <td
                        rowSpan={week.topics.length}
                        className="border-r border-slate-100 bg-slate-50 px-3 py-2.5 text-xs whitespace-nowrap text-slate-600"
                      >
                        {week.dateRange}
                      </td>
                    </>
                  ) : null}
                  <td className="px-3 py-2.5 text-slate-800">{topic.name}</td>
                  <td className="px-3 py-2.5 text-center text-slate-700">
                    {topic.hours}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">
                    {topic.note ?? ""}
                  </td>
                </tr>
              )),
            )}
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-medium">
              <td colSpan={3} className="px-3 py-2.5 text-right text-slate-900">
                {tRootTotal}
              </td>
              <td className="px-3 py-2.5 text-center text-slate-900">{hours}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
