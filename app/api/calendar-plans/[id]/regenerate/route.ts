import { ok, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { consumeAiQuota } from "@/lib/ai/rate-limit";
import {
  regenerateCalendarPlan,
  runCalendarPlanGeneration,
} from "@/lib/calendar-plans/service";
import { runInBackground } from "@/lib/generation/background";

/**
 * `POST /api/calendar-plans/[id]/regenerate` — qayta generatsiya.
 *
 * FON rejimida: 202 qaytadi, generatsiya keyin davom etadi.
 */

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  /*
    «Qayta urinish» tugmasi ham AI chaqiradi, ya'ni u ham PUL turadi.
    Cheklovsiz qoldirilsa, tugmani ushlab turib kvotani chetlab o'tish
    mumkin bo'lardi.
  */
  const reservation = await consumeAiQuota(user.id, "calendar-plans:regenerate");

  const { record, input } = await regenerateCalendarPlan(id, user.id);

  runInBackground(`calendar-plan:${record.id}:regenerate`, () =>
    runCalendarPlanGeneration(record.id, input, reservation),
  );

  return ok({ calendarPlan: record }, 202);
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
