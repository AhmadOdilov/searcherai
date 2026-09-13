import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { consumeAiQuota } from "@/lib/ai/rate-limit";
import {
  createPresentation,
  listPresentations,
  runPresentationGeneration,
} from "@/lib/presentations/service";
import { runInBackground } from "@/lib/generation/background";
import {
  presentationInputSchema,
  presentationListQuerySchema,
} from "@/lib/validations/presentation";

/**
 * `POST /api/presentations` — prezentatsiya generatsiya qiladi.
 *
 * Ikki rejim, `mode` maydoni bilan ajratiladi:
 *   { "mode": "from-lesson-plan", "lessonPlanId": "..." }
 *   { "mode": "standalone", "topic": "...", "subject": "...", "grade": "..." }
 *
 * FON rejimida: PENDING yozuv yaratilib `202 Accepted` qaytadi,
 * generatsiya esa javob yuborilgandan keyin davom etadi. Frontend
 * `GET /api/presentations/[id]` ni so'rab turadi.
 *
 * Dars ishlanmasi TEKSHIRUVI esa sinxron: egalik va tayyorlik xatosi
 * bo'lsa foydalanuvchi darhol bilishi kerak (404/400), keraksiz PENDING
 * yozuv yaratilmasligi kerak.
 */
export const POST = withErrorHandling(async (request) => {
  const user = await requireUser();
  const input = await parseJsonBody(request, presentationInputSchema);

  // Kvota tekshiruvi validatsiyadan KEYIN: noto'g'ri to'ldirilgan forma
  // foydalanuvchining kvotasini yemasligi kerak.
  await consumeAiQuota(user.id, "presentations");

  const { record, promptContext } = await createPresentation(user.id, input);

  runInBackground(`presentation:${record.id}`, () =>
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

/** `GET /api/presentations` — foydalanuvchining ro'yxati. */
export const GET = withErrorHandling(async (request) => {
  const user = await requireUser();

  const url = new URL(request.url);
  const query = presentationListQuerySchema.parse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });

  return ok(await listPresentations(user.id, query));
});
