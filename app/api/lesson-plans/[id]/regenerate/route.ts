import { ok, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import {
  regenerateLessonPlan,
  runLessonPlanGeneration,
} from "@/lib/lesson-plans/service";
import { runInBackground } from "@/lib/generation/background";

/**
 * `POST /api/lesson-plans/[id]/regenerate` — qayta generatsiya.
 *
 * Nega alohida route: FAILED holatdan keyin foydalanuvchi "qayta urinish"
 * tugmasini bosadi. Agar u shunchaki `POST /api/lesson-plans` ga qayta
 * yuborsa, ro'yxatda yiqilgan yozuv ham, yangisi ham qolib ketardi.
 * Bu route mavjud yozuvni O'RNIDA yangilaydi.
 *
 * `POST /api/lesson-plans` kabi FON rejimida: yozuv PENDING ga
 * qaytariladi va 202 beriladi, generatsiya keyin davom etadi.
 */

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const { record, input } = await regenerateLessonPlan(id, user.id);

  runInBackground(`lesson-plan:${record.id}:regenerate`, () =>
    runLessonPlanGeneration(record.id, input),
  );

  return ok({ lessonPlan: record }, 202);
});

/**
 * Generatsiya javob yuborilgandan KEYIN davom etadi (`after()`), shuning
 * uchun route'ning umumiy chegarasi uzoq bo'lishi kerak.
 *
 * DIQQAT: bu qiymat LITERAL bo'lishi shart — Next.js segment
 * sozlamalarini build paytida statik o'qiydi va import qilingan
 * konstantani hisoblay olmaydi ("Invalid segment configuration export").
 * Manba: `GENERATION_MAX_DURATION` (lib/generation/background.ts).
 */
export const maxDuration = 300;
