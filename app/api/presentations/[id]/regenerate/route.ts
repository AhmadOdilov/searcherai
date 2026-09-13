import { ok, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { consumeAiQuota } from "@/lib/ai/rate-limit";
import {
  regeneratePresentation,
  runPresentationGeneration,
} from "@/lib/presentations/service";
import { runInBackground } from "@/lib/generation/background";

/**
 * `POST /api/presentations/[id]/regenerate` — qayta generatsiya.
 *
 * FAILED holatidan keyingi "qayta urinish" uchun. Parametrlar yozuvning
 * o'zidan olinadi; eski fayl o'chirib, yangisi yoziladi.
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
  await consumeAiQuota(user.id, "presentations:regenerate");

  const { record, promptContext } = await regeneratePresentation(id, user.id);

  runInBackground(`presentation:${record.id}:regenerate`, () =>
    runPresentationGeneration(record.id, promptContext),
  );

  return ok({ presentation: record }, 202);
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
