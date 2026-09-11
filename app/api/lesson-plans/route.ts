import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { createLessonPlan, listLessonPlans } from "@/lib/lesson-plans/service";
import {
  lessonPlanInputSchema,
  lessonPlanListQuerySchema,
} from "@/lib/validations/lesson-plan";

/**
 * `POST /api/lesson-plans` — yangi dars ishlanmasini generatsiya qiladi.
 *
 * MVP'da SINXRON: AI javobini kutib, tayyor natijani qaytaradi. Bu bir
 * necha soniya (ba'zan 30+) olishi mumkin — frontend loading holatini
 * ko'rsatadi. Fon rejimi keyingi bosqichda.
 */
export const POST = withErrorHandling(async (request) => {
  // userId AYNAN sessiyadan — so'rov tanasidan emas.
  const user = await requireUser();
  const input = await parseJsonBody(request, lessonPlanInputSchema);

  const plan = await createLessonPlan(user.id, input);

  return ok({ lessonPlan: plan }, 201);
});

/**
 * `GET /api/lesson-plans` — foydalanuvchining dars ishlanmalari ro'yxati.
 *
 * Faqat o'z yozuvlari qaytadi (servis qatlami `userId` ni shartga qo'yadi).
 */
export const GET = withErrorHandling(async (request) => {
  const user = await requireUser();

  const url = new URL(request.url);
  const query = lessonPlanListQuerySchema.parse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });

  const result = await listLessonPlans(user.id, query);

  return ok(result);
});
