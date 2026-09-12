import { ok, withErrorHandling } from "@/lib/api/with-error-handling";
import { apiErrors } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/session";
import { deleteLessonPlan, getLessonPlan } from "@/lib/lesson-plans/service";

/**
 * Bitta dars ishlanmasi bilan ishlash.
 *
 * Next.js 16'da dinamik segmentlar PROMISE sifatida keladi — `await params`
 * qilish shart (15-versiyadagi sinxron kirish olib tashlangan).
 */

type RouteContext = { params: Promise<{ id: string }> };

/** `GET /api/lesson-plans/[id]` — natijani olish. Faqat egasi. */
export const GET = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const plan = await getLessonPlan(id, user.id);
  if (!plan) {
    // 404, 403 emas — boshqa foydalanuvchi yozuvi BORLIGINI ham bildirmaymiz.
    throw apiErrors.notFound("errors.domain.lessonPlanNotFound");
  }

  return ok({ lessonPlan: plan });
});

/** `DELETE /api/lesson-plans/[id]` — o'chirish. Faqat egasi. */
export const DELETE = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  await deleteLessonPlan(id, user.id);

  return ok({ deleted: true });
});
