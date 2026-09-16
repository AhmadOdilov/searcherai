import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Pencil, Table2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getCalendarPlan } from "@/lib/calendar-plans/service";
import { CalendarPlanActions } from "@/components/calendar-plans/plan-actions";
import { formatDate, formatFileSize } from "@/lib/ui/labels";
import { ErrorPanel } from "@/components/ui/error-panel";
import { GenerationProgress } from "@/components/ui/generation-progress";
import { BackLink } from "@/components/ui/back-link";
import { DetailHeader } from "@/components/ui/detail-header";
import { DownloadPanel } from "@/components/ui/download-panel";
import { PrintButton } from "@/components/ui/print-button";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { HelpLink } from "@/components/ui/help-link";
import { PROGRESS_KEYS, TYPICAL_SECONDS } from "@/lib/calendar-plans/labels";
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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <BackLink href="/dashboard/calendar-plans" />

      <DetailHeader
        title={plan.title ?? `${plan.subject} — ${plan.period}`}
        status={plan.status}
        meta={`${plan.subject} · ${plan.grade} · ${plan.period} · ${t("meta", {
          weeks: plan.weeks,
          hours: plan.hoursPerWeek,
        })} · ${tRoot(`languages.${plan.language}`)}`}
        date={`${t("detail.startsFrom", {
          date: formatShortDate(plan.startDate, locale),
        })} · ${formatDate(plan.createdAt, locale)}${
          plan.aiDurationMs !== null
            ? ` · ${tRoot("lessonPlans.detail.generatedIn", {
                seconds: (plan.aiDurationMs / 1000).toFixed(1),
              })}`
            : ""
        }`}
      />

      {plan.status === "READY" && plan.filePath !== null && (
        <DownloadPanel
          title={t("detail.readyTitle")}
          hint={t("detail.readyHint")}
          openWith={t("detail.openWith")}
          formats={[
            {
              label: tRoot("common.downloadExcel"),
              href: `/api/calendar-plans/${plan.id}/download`,
              icon: <Table2 aria-hidden className="size-6 shrink-0" />,
              sizeLabel:
                plan.fileSize !== null
                  ? formatFileSize(plan.fileSize, locale)
                  : undefined,
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

      {/*
        Tahrirlash — ASOSIY amal. «Qaytadan tayyorlash» dan yuqorida:
        u butun rejani tashlab, yangi AI so'rovi sarflaydi, tahrir esa
        mavjud ishni saqlaydi.
      */}
      {plan.status === "READY" && content !== null && (
        <div className="mt-4 print:hidden">
          <LinkButton
            href={`/dashboard/calendar-plans/${plan.id}/edit`}
            size="lg"
            icon={<Pencil aria-hidden className="size-5" />}
          >
            {t("editor.editPlan")}
          </LinkButton>
          <p className="mt-2 text-base text-neutral-500">{t("editor.editHint")}</p>
        </div>
      )}

      <div className="mt-4 print:hidden">
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

      {/*
        Tayyorlanayotgan paytda jarayon KUZATILADI: komponent har 2
        soniyada yozuvni so'rab turadi va tugagach sahifani yangilaydi.
      */}
      {plan.status === "PENDING" && (
        <GenerationProgress
          resource="/api/calendar-plans"
          payloadKey="calendarPlan"
          recordId={plan.id}
          progressKeys={PROGRESS_KEYS}
          namespace="calendarPlans"
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
        <PlanTable
          content={content}
          expectedHours={plan.weeks * plan.hoursPerWeek}
          t={t}
        />
      )}

      <div className="mt-10 flex justify-center border-t border-neutral-200 pt-6 print:hidden">
        <HelpLink />
      </div>
    </div>
  );
}

/**
 * Reja jadvali.
 *
 * Excel faylidagi bilan bir xil tuzilish — o'qituvchi yuklab olmasdan ham
 * nima chiqqanini ko'radi.
 *
 * ── Telefonda jadval EMAS ─────────────────────────────────────────────────
 * 390px ekranda besh ustunli jadval ikki yo'l bilan buziladi: yo matn
 * bir harfgacha siqiladi, yo sahifa yon tomonga siljiydi va foydalanuvchi
 * ustun sarlavhasini yo'qotadi.
 *
 * Shuning uchun telefonda har bir hafta ALOHIDA KARTA bo'lib chiziladi
 * (ustun nomi har bir qiymat yonida turadi), `md` ekrandan boshlab esa
 * haqiqiy jadval ko'rinadi.
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

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-semibold text-neutral-900">
          {t("detail.tableTitle", { weeks: content.weeks.length, rows })}
        </h2>
        <p
          className={
            mismatch ? "text-base text-accent-ink" : "text-base text-neutral-500"
          }
        >
          {mismatch
            ? t("detail.hoursMismatch", { actual: hours, expected: expectedHours })
            : t("detail.totalHours", { hours })}
        </p>
      </div>

      {/* ── Telefon ko'rinishi: haftalar kartalari ────────────────────── */}
      <ul className="space-y-3 md:hidden">
        {content.weeks.map((week) => (
          <li key={week.weekNumber}>
            <Card padding="sm">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-lg font-semibold text-neutral-900">
                  {t("detail.columns.week")} {week.weekNumber}
                </p>
                <p className="text-sm text-neutral-500">{week.dateRange}</p>
              </div>

              <ul className="mt-3 space-y-3">
                {week.topics.map((topic, topicIndex) => (
                  <li
                    key={topicIndex}
                    className="border-t border-neutral-200 pt-3 first:border-0 first:pt-0"
                  >
                    <p className="text-base leading-relaxed text-neutral-900">
                      {topic.name}
                    </p>
                    <p className="mt-1 text-sm text-neutral-600">
                      {t("detail.columns.hours")}: {topic.hours}
                    </p>
                    {topic.note !== undefined && topic.note !== null && (
                      <p className="mt-1 text-sm text-neutral-500">{topic.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </li>
        ))}

        <li>
          <Card padding="sm" className="bg-neutral-50">
            <p className="text-lg font-semibold text-neutral-900">
              {t("detail.totalHours", { hours })}
            </p>
          </Card>
        </li>
      </ul>

      {/* ── Keng ekran: haqiqiy jadval ────────────────────────────────── */}
      <div className="hidden overflow-x-auto rounded-lg border border-neutral-200 bg-surface md:block">
        <table className="w-full border-collapse text-base">
          <thead>
            <tr className="bg-primary text-left text-sm text-on-primary">
              <th className="px-4 py-3 font-medium">{t("detail.columns.week")}</th>
              <th className="px-4 py-3 font-medium">{t("detail.columns.dateRange")}</th>
              <th className="px-4 py-3 font-medium">{t("detail.columns.topic")}</th>
              <th className="px-4 py-3 text-center font-medium">
                {t("detail.columns.hours")}
              </th>
              <th className="px-4 py-3 font-medium">{t("detail.columns.note")}</th>
            </tr>
          </thead>
          <tbody>
            {content.weeks.map((week) =>
              week.topics.map((topic, topicIndex) => (
                <tr
                  key={`${week.weekNumber}-${topicIndex}`}
                  className="border-t border-neutral-200 align-top"
                >
                  {/* Hafta raqami va sanasi faqat birinchi qatorda — Excel'dagi
                      birlashtirilgan katakcha kabi. */}
                  {topicIndex === 0 ? (
                    <>
                      <td
                        rowSpan={week.topics.length}
                        className="border-r border-neutral-200 bg-neutral-50 px-4 py-3 text-center font-medium text-neutral-900"
                      >
                        {week.weekNumber}
                      </td>
                      <td
                        rowSpan={week.topics.length}
                        className="border-r border-neutral-200 bg-neutral-50 px-4 py-3 text-sm whitespace-nowrap text-neutral-600"
                      >
                        {week.dateRange}
                      </td>
                    </>
                  ) : null}
                  <td className="px-4 py-3 text-neutral-800">{topic.name}</td>
                  <td className="px-4 py-3 text-center text-neutral-700">
                    {topic.hours}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-500">
                    {topic.note ?? ""}
                  </td>
                </tr>
              )),
            )}
            <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-medium">
              <td colSpan={3} className="px-4 py-3 text-right text-neutral-900">
                {t("detail.totalHours", { hours })}
              </td>
              <td className="px-4 py-3 text-center text-neutral-900">{hours}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
