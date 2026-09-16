import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getCalendarPlan } from "@/lib/calendar-plans/service";
import { CalendarEditor } from "@/components/calendar-plans/calendar-editor";
import { ErrorPanel } from "@/components/ui/error-panel";
import { BackLink } from "@/components/ui/back-link";
import { parseCalendarPlanContent } from "@/lib/validations/calendar-plan";

/**
 * `/dashboard/calendar-plans/[id]/edit` — rejani tahrirlash.
 *
 * Prezentatsiya muharriri bilan bir xil qoidalar: alohida manzil,
 * server tomonida egalik va holat tekshiruvi, tayyor bo'lmagan yozuv
 * tafsilot sahifasiga qaytariladi.
 */
export default async function CalendarPlanEditPage({
  params,
}: PageProps<"/dashboard/calendar-plans/[id]/edit">) {
  const { id } = await params;
  const user = (await getCurrentUser())!;

  const plan = await getCalendarPlan(id, user.id);
  if (!plan) notFound();

  const detailHref = `/dashboard/calendar-plans/${id}`;
  if (plan.status !== "READY") redirect(detailHref);

  const t = await getTranslations("calendarPlans");
  const content = parseCalendarPlanContent(plan.content);

  if (content === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <BackLink href={detailHref} labelKey="back" />
        <ErrorPanel
          title={t("detail.failedTitle")}
          hint={t("detail.failedHint")}
          message={t("detail.brokenContent")}
        />
      </div>
    );
  }

  return (
    <>
      <title>{`${t("editor.title")} — ${content.title}`}</title>
      <CalendarEditor
        planId={plan.id}
        initialContent={content}
        detailHref={detailHref}
        hoursPerWeek={plan.hoursPerWeek}
      />
    </>
  );
}
