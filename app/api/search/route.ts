import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { consumeAiQuota, recordAiUsage, releaseAiQuota } from "@/lib/ai/rate-limit";
import {
  appendTurnBestEffort,
  createConversationBestEffort,
  loadConversationContext,
  requireOwnedConversation,
} from "@/lib/search/conversation-store";
import { runSearch } from "@/lib/search/service";
import { searchInputSchema } from "@/lib/validations/search";

/**
 * `POST /api/search` — o'qituvchining savoliga javob.
 *
 * ── Nega bu yerda fon rejimi YO'Q ─────────────────────────────────────────
 * Qolgan uch modul `202 Accepted` qaytarib, ishni `after()` da davom
 * ettiradi (ular 20-90 soniya davom etadi). Qidiruv 5-10 soniyada
 * tugaydi — javobni darhol berish ancha sodda va foydalanuvchi uchun ham
 * tushunarliroq.
 *
 * ── Ko'p bosqichli suhbat ─────────────────────────────────────────────────
 * Standart holatda har bir so'rov MUSTAQIL: hech narsa yozilmaydi, hech
 * narsa meros olinmaydi. Mijoz `startConversation: true` yuborsa, javob
 * bilan birga `conversationId` qaytadi; keyingi so'rovda o'sha
 * identifikator berilsa, oldingi mavzu, fan va sinf meros olinadi — ya'ni
 * «endi buni oddiyroq tushuntir» degan savol nima haqida ekanini biladi.
 *
 * Kontekst BAZADAN o'qiladi, mijozdan emas: `lib/search/conversation-store.ts`.
 */
export const POST = withErrorHandling(async (request) => {
  // Kirish tekshiruvi: javob shaxsiy emas, lekin AI chaqiruvi pul turadi.
  const user = await requireUser();

  const input = await parseJsonBody(request, searchInputSchema);

  /*
    Suhbat kontekstini kvotadan OLDIN o'qiymiz.

    Sabab validatsiyanikiga o'xshash: mavjud bo'lmagan yoki o'zga
    foydalanuvchining identifikatori 404 bilan tugaydi, ya'ni AI
    chaqiruvi umuman bo'lmaydi — bunday so'rov kvotani yemasligi kerak.
  */
  const conversation = input.conversationId
    ? await requireOwnedConversation(input.conversationId, user.id)
    : null;
  const conversationContext = conversation
    ? await loadConversationContext(conversation.id)
    : undefined;

  // Kvota tekshiruvi validatsiyadan KEYIN: noto'g'ri so'rov
  // foydalanuvchining kvotasini yemasligi kerak.
  const reservation = await consumeAiQuota(user.id, "search");

  /*
    Qidiruv yiqilsa — bandlikni QAYTARAMIZ.

    `consumeAiQuota()` AI chaqiruvidan OLDIN yozadi (parallel himoya
    uchun), lekin `runSearch()` javobsiz tugashi mumkin: provayder
    xatosi, timeout (`AiError` → `kind: "aborted"`), sxemaga mos
    kelmagan yoki umuman JSON bo'lmagan javob. Qaytarilmasa,
    provayder uzilgan paytda o'qituvchi uch marta urinib, hech narsa
    olmasdan BIR DAQIQAGA bloklanardi — o'z aybisiz.

    Bu generatsiya modullari va rasm tahlilidagi bilan AYNI shartnoma
    (lib/lesson-plans/service.ts, app/api/vision-analyze/route.ts).
    `releaseAiQuota` faqat `model` BO'SH yozuvni o'chiradi, ya'ni
    muvaffaqiyatli chaqiruvdan keyin (`recordAiUsage` modelni yozgach)
    u hech narsani qaytarmaydi.
  */
  const result = await runSearch(input, conversationContext).catch(
    async (caught: unknown) => {
      await releaseAiQuota(reservation);
      throw caught;
    },
  );

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

  /*
    Suhbatni saqlash — javob TAYYOR bo'lgandan keyin.

    Yangi suhbat faqat mijoz so'raganda ochiladi. Yozuv yiqilsa javob
    baribir yetkaziladi (`appendTurnBestEffort`): AI chaqiruvi allaqachon
    to'langan, bazaning vaqtinchalik nosozligi uchun o'qituvchini
    natijasiz qoldirish mantiqsiz.
  */
  let conversationId = conversation?.id;
  if (!conversationId && input.startConversation === true) {
    conversationId = await createConversationBestEffort(
      user.id,
      input.question,
      input.language,
    );
  }

  if (conversationId !== undefined) {
    await appendTurnBestEffort({
      conversationId,
      question: input.question,
      understanding: result.understanding,
      answerSnippet: result.answer.answer,
      retrievedTopicIds: result.curriculumMatches.slice(0, 5).map((m) => m.sourceId),
    });
  }

  return ok({
    /*
      Mijoz keyingi savolni shu identifikator bilan yuboradi. Suhbat
      so'ralmagan bo'lsa — `undefined`, ya'ni javob shakli avvalgidek.
    */
    conversationId,
    answer: result.answer,
    understanding: result.understanding,
    curriculumMatches: result.curriculumMatches,
    grounding: result.grounding,
    suggestedActions: result.suggestedActions,
    explanation: result.explanation,
    adaptiveStrategy: result.adaptiveStrategy,
    costMetrics: result.costMetrics,
    cached: result.cached,
    durationMs: result.durationMs,
    latencyBreakdown: result.latencyBreakdown,
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
