import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { consumeAiQuota } from "@/lib/ai/rate-limit";
import {
  createLessonPlan,
  listLessonPlans,
  runLessonPlanGeneration,
} from "@/lib/lesson-plans/service";
import { runInBackground } from "@/lib/generation/background";
import {
  lessonPlanInputSchema,
  lessonPlanListQuerySchema,
} from "@/lib/validations/lesson-plan";

/**
 * `POST /api/lesson-plans` — generatsiyani BOSHLAYDI.
 *
 * ── Fon rejimi ────────────────────────────────────────────────────────────
 * Route AI javobini KUTMAYDI. U PENDING yozuvni yaratib `202 Accepted`
 * qaytaradi, generatsiya esa javob yuborilgandan keyin davom etadi
 * (`runInBackground` → Next.js `after()`).
 *
 * Frontend `GET /api/lesson-plans/[id]` ni so'rab turadi (polling) va
 * status READY yoki FAILED bo'lguncha kutadi.
 */
export const POST = withErrorHandling(async (request) => {
  // userId AYNAN sessiyadan — so'rov tanasidan emas.
  const user = await requireUser();
  const input = await parseJsonBody(request, lessonPlanInputSchema);

  // Kvota tekshiruvi validatsiyadan KEYIN: noto'g'ri to'ldirilgan forma
  // foydalanuvchining kvotasini yemasligi kerak.
  await consumeAiQuota(user.id, "lesson-plans");

  const plan = await createLessonPlan(user.id, input);

  runInBackground(`lesson-plan:${plan.id}`, () =>
    runLessonPlanGeneration(plan.id, input),
  );

  // 202 Accepted — "qabul qilindi, lekin hali bajarilmadi".
  return ok({ lessonPlan: plan }, 202);
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
