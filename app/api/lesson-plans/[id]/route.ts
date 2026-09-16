import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { apiErrors } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/session";
import {
  deleteLessonPlan,
  getLessonPlan,
  updateLessonPlanContent,
} from "@/lib/lesson-plans/service";
import { lessonPlanEditSchema } from "@/lib/validations/lesson-plan";

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

/**
 * `PATCH /api/lesson-plans/[id]` — o'qituvchi tahririni saqlaydi.
 *
 * AI CHAQIRILMAYDI. Fayl ham qayta yasalmaydi: .docx har so'rovda
 * bazadagi mazmundan yasaladi, ya'ni mazmunni yangilash yetarli.
 */
export const PATCH = withErrorHandling<RouteContext>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const body = await parseJsonBody(request, lessonPlanEditSchema);
  const lessonPlan = await updateLessonPlanContent(id, user.id, body.content);

  return ok({ lessonPlan });
});

/** `DELETE /api/lesson-plans/[id]` — o'chirish. Faqat egasi. */
export const DELETE = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  await deleteLessonPlan(id, user.id);

  return ok({ deleted: true });
});
