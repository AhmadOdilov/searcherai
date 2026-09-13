import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { consumeAiQuota } from "@/lib/ai/rate-limit";
import {
  createCalendarPlan,
  listCalendarPlans,
  runCalendarPlanGeneration,
} from "@/lib/calendar-plans/service";
import { runInBackground } from "@/lib/generation/background";
import {
  calendarPlanInputSchema,
  calendarPlanListQuerySchema,
} from "@/lib/validations/calendar-plan";

/**
 * `POST /api/calendar-plans` — kalendar-tematik reja generatsiya qiladi.
 *
 * Bu eng SEKIN modul (40-60 soniya), shuning uchun fon rejimi ayniqsa
 * muhim: route PENDING yozuvni yaratib `202 Accepted` qaytaradi,
 * generatsiya esa javob yuborilgandan keyin davom etadi.
 */
export const POST = withErrorHandling(async (request) => {
  const user = await requireUser();
  const input = await parseJsonBody(request, calendarPlanInputSchema);

  // Kvota tekshiruvi validatsiyadan KEYIN: noto'g'ri to'ldirilgan forma
  // foydalanuvchining kvotasini yemasligi kerak.
  await consumeAiQuota(user.id, "calendar-plans");

  const calendarPlan = await createCalendarPlan(user.id, input);

  runInBackground(`calendar-plan:${calendarPlan.id}`, () =>
    runCalendarPlanGeneration(calendarPlan.id, input),
  );

  return ok({ calendarPlan }, 202);
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

/** `GET /api/calendar-plans` — foydalanuvchining ro'yxati. */
export const GET = withErrorHandling(async (request) => {
  const user = await requireUser();

  const url = new URL(request.url);
  const query = calendarPlanListQuerySchema.parse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });

  return ok(await listCalendarPlans(user.id, query));
});
