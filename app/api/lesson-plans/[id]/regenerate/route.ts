import { ok, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { regenerateLessonPlan } from "@/lib/lesson-plans/service";

/**
 * `POST /api/lesson-plans/[id]/regenerate` — qayta generatsiya.
 *
 * Nega alohida route: FAILED holatdan keyin foydalanuvchi "qayta urinish"
 * tugmasini bosadi. Agar u shunchaki `POST /api/lesson-plans` ga qayta
 * yuborsa, ro'yxatda yiqilgan yozuv ham, yangisi ham qolib ketardi.
 * Bu route mavjud yozuvni O'RNIDA yangilaydi — parametrlar yozuvning
 * o'zidan olinadi, foydalanuvchi formani qaytadan to'ldirmaydi.
 */

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const plan = await regenerateLessonPlan(id, user.id);

  return ok({ lessonPlan: plan });
});
