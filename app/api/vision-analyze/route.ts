import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { consumeAiQuota, recordAiUsage, releaseAiQuota } from "@/lib/ai/rate-limit";
import { analyzeImage } from "@/lib/vision/service";
import { visionInputSchema } from "@/lib/validations/vision";

/**
 * `POST /api/vision-analyze` — yuklangan rasmni tahlil qiladi.
 *
 * ── Rasm saqlanmaydi ──────────────────────────────────────────────────────
 * So'rov tanasidagi base64 xotirada modelga uzatiladi va javob
 * qaytarilishi bilan yo'qoladi. Diskka ham, bazaga ham yozilmaydi —
 * o'qituvchining darsligi sahifasi serverda qolmasligi kerak.
 *
 * ── Nega sinxron ──────────────────────────────────────────────────────────
 * Qidiruv kabi: tahlil 5-20 soniya oladi va hech narsa saqlamaydi.
 * Fon rejimi (PENDING yozuv + so'rab turish) bunga ortiqcha.
 */
export const POST = withErrorHandling(async (request) => {
  const user = await requireUser();

  const input = await parseJsonBody(request, visionInputSchema);

  /*
    Kvota tekshiruvi validatsiyadan KEYIN, lekin rasm dekodlashdan
    OLDIN: rasm tahlili eng qimmat chaqiruvlardan biri (rasm ko'p
    token yeydi), shuning uchun u albatta hisoblanishi kerak.
  */
  const reservation = await consumeAiQuota(user.id, "vision");

  /*
    Tahlil yiqilsa — bandlikni QAYTARAMIZ.

    `consumeAiQuota()` AI chaqiruvidan OLDIN yozadi (parallel himoya
    uchun), lekin `analyzeImage()` AI'ga umuman yetib bormasdan ham
    yiqilishi mumkin: rasm 5 MB dan katta, baytlar PNG/JPEG emas, data
    URI buzuq yoki `VISION_AI_MODEL` sozlanmagan. Qaytarilmasa, shunday
    rad etilgan so'rov o'qituvchining daqiqalik uchta so'rovidan
    bittasini bekorga yeb qo'yardi — provayder uzilganda esa u uch
    marta urinib, o'z aybisiz bir daqiqaga bloklanardi.

    Bu generatsiya modullaridagi bilan AYNI shartnoma
    (lib/lesson-plans/service.ts, .../[id]/regenerate/route.ts).
    `releaseAiQuota` faqat `model` BO'SH yozuvni o'chiradi, ya'ni
    muvaffaqiyatli chaqiruvdan keyin (`recordAiUsage` modelni yozgach)
    u hech narsani qaytarmaydi.
  */
  const result = await analyzeImage(input).catch(async (caught: unknown) => {
    await releaseAiQuota(reservation);
    throw caught;
  });

  /*
    Tokenlar kvota yozuviga.

    Bu modulda o'lchov eng muhim: rasm so'rovi eng qimmatlaridan va
    bitta surat minglab token yeydi. Ilgari esa u umuman yozilmasdi —
    `AiRequest` dagi "vision" qatorlari bo'sh model va bo'sh token
    bilan turardi.
  */
  await recordAiUsage(reservation, {
    model: result.model,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
  });

  return ok({ analysis: result.analysis });
});

/**
 * Rasm so'rovi matnli so'rovdan sekinroq: rasm yuklanadi, keyin model uni
 * qayta ishlaydi.
 *
 * DIQQAT: bu qiymat LITERAL bo'lishi shart — Next.js segment
 * sozlamalarini build paytida statik o'qiydi.
 */
export const maxDuration = 300;
