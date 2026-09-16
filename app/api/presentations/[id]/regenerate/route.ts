import { ok, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { consumeAiQuota, releaseAiQuota } from "@/lib/ai/rate-limit";
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
  const reservation = await consumeAiQuota(user.id, "presentations:regenerate");

  /*
    Yozuv band qilinmasa — bandlikni QAYTARAMIZ.

    Bu yerga tushish oson: 409 (allaqachon ishlayapti) yoki 404
    (yozuv yo'q). Ikkala holatda ham AI umuman chaqirilmaydi, lekin
    bandlik undan OLDIN olingan. Qaytarilmasa, tugmani ikki marta
    bosgan o'qituvchi hech narsa olmasdan kvotasini yo'qotardi — u
    esa daqiqada atigi uchta.
  */
  const { record, promptContext } = await regeneratePresentation(id, user.id).catch(
    async (caught: unknown) => {
      await releaseAiQuota(reservation);
      throw caught;
    },
  );

  runInBackground(`presentation:${record.id}:regenerate`, () =>
    runPresentationGeneration(record.id, promptContext, reservation),
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
