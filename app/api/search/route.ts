import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { consumeAiQuota, recordAiUsage } from "@/lib/ai/rate-limit";
import { runSearch } from "@/lib/search/service";
import { searchInputSchema } from "@/lib/validations/search";

/**
 * `POST /api/search` — o'qituvchining savoliga javob.
 *
 * ── Nega bu yerda fon rejimi YO'Q ─────────────────────────────────────────
 * Qolgan uch modul `202 Accepted` qaytarib, ishni `after()` da davom
 * ettiradi (ular 20-90 soniya davom etadi). Qidiruv 5-10 soniyada
 * tugaydi va hech narsa saqlamaydi — javobni darhol berish ancha sodda
 * va foydalanuvchi uchun ham tushunarliroq.
 */
export const POST = withErrorHandling(async (request) => {
  // Kirish tekshiruvi: javob shaxsiy emas, lekin AI chaqiruvi pul turadi.
  const user = await requireUser();

  const input = await parseJsonBody(request, searchInputSchema);

  // Kvota tekshiruvi validatsiyadan KEYIN: noto'g'ri so'rov
  // foydalanuvchining kvotasini yemasligi kerak.
  const reservation = await consumeAiQuota(user.id, "search");

  const result = await runSearch(input);

  /*
    Tokenlar kvota yozuviga.

    Ilgari bu yerda YO'Q edi: generatsiya modullari o'lchovni yozardi,
    qidiruv va rasm tahlili esa yozmasdi. Natijada `AiRequest`
    jadvalidagi qidiruv qatorlari bo'sh model va bo'sh token bilan
    turardi — ya'ni "qancha sarfladik?" degan savolga javob berib
    bo'lmasdi.

    Xatoda yozilmaydi va bu to'g'ri: `runSearch` yiqilsa javob ham
    kelmagan.
  */
  await recordAiUsage(reservation, {
    model: result.model,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
  });

  return ok({
    answer: result.answer,
    understanding: result.understanding,
    curriculumMatches: result.curriculumMatches,
    grounding: result.grounding,
    suggestedActions: result.suggestedActions,
  });
});

/**
 * AI javobi 90 soniyagacha davom etishi mumkin (`AI_TIMEOUT_MS`), qayta
 * urinish bilan esa undan ham uzoq.
 *
 * DIQQAT: bu qiymat LITERAL bo'lishi shart — Next.js segment
 * sozlamalarini build paytida statik o'qiydi va import qilingan
 * konstantani hisoblay olmaydi.
 */
export const maxDuration = 300;
