import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { consumeAiQuota } from "@/lib/ai/rate-limit";
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
  await consumeAiQuota(user.id, "vision");

  const result = await analyzeImage(input);

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
