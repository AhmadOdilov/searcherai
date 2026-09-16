import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getLessonPlan } from "@/lib/lesson-plans/service";
import { LessonPlanEditor } from "@/components/lesson-plans/lesson-plan-editor";
import { ErrorPanel } from "@/components/ui/error-panel";
import { BackLink } from "@/components/ui/back-link";
import { parseLessonPlanContent } from "@/lib/validations/lesson-plan";

/**
 * `/dashboard/lesson-plans/[id]/edit` — dars ishlanmasini tahrirlash.
 *
 * Boshqa ikki muharrir bilan bir xil qoidalar: alohida manzil, server
 * tomonida egalik va holat tekshiruvi, tayyor bo'lmagan yozuv tafsilot
 * sahifasiga qaytariladi.
 */
export default async function LessonPlanEditPage({
  params,
}: PageProps<"/dashboard/lesson-plans/[id]/edit">) {
  const { id } = await params;
  const user = (await getCurrentUser())!;

  const plan = await getLessonPlan(id, user.id);
  if (!plan) notFound();

  const detailHref = `/dashboard/lesson-plans/${id}`;
  if (plan.status !== "READY") redirect(detailHref);

  const t = await getTranslations("lessonPlans");
  const content = parseLessonPlanContent(plan.content);

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
      <title>{`${t("editor.title")} — ${plan.topic}`}</title>
      <LessonPlanEditor
        planId={plan.id}
        initialContent={content}
        detailHref={detailHref}
        durationMinutes={plan.durationMinutes}
      />
    </>
  );
}
