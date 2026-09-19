import "server-only";
import { generateJson } from "@/lib/ai/provider";
import { AiError, type AiUsage } from "@/lib/ai/types";
import { getEnv } from "@/lib/env";
import { buildVisionSystemPrompt, buildVisionUserPrompt } from "@/lib/vision/prompt";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  detectImageType,
  visionAnalysisSchema,
  type VisionAnalysis,
  type VisionInput,
} from "@/lib/validations/vision";
import { apiErrors } from "@/lib/api/errors";

/**
 * Rasm tahlili — biznes mantiq qatlami.
 *
 * ── Rasm HECH QAYERGA saqlanmaydi ─────────────────────────────────────────
 * Talab "vaqtinchalik saqlab, tahlildan keyin o'chirish" edi. Bu yerda
 * undan ham qat'iyroq qilingan: rasm diskka UMUMAN yozilmaydi. U so'rov
 * tanasida keladi, xotirada modelga uzatiladi va so'rov tugashi bilan
 * yo'qoladi.
 *
 * Nega shunday yaxshiroq: "keyin o'chiramiz" har doim o'chirilmay qolgan
 * fayllarga olib keladi — generatsiya yiqilsa, server qayta ishga
 * tushsa, o'chirish kodi xato bersa. Yozilmagan fayl esa qololmaydi.
 * Yon ta'siri: tahlilni qayta ko'rish uchun rasmni qaytadan yuklash
 * kerak — bu MVP uchun maqbul.
 */

export interface VisionResult {
  analysis: VisionAnalysis;
  durationMs: number;
  /** Javobni qaytargan model — kvota yozuvi uchun. */
  model: string;
  /**
   * Sarflangan tokenlar — route ularni kvota yozuviga yozadi.
   *
   * Rasm so'rovlari eng qimmatlaridan: bitta surat minglab token
   * yeydi. Aynan shuning uchun bu yerda o'lchov bo'lishi kerak.
   */
  usage: AiUsage;
}

/**
 * `data:image/png;base64,...` satridan baytlarni ajratadi va TEKSHIRADI.
 *
 * Uch bosqichli tekshiruv — har biri boshqacha hujumni to'sadi:
 *  1. Shakl — bu umuman data URI mi;
 *  2. Hajm — dekodlangandan KEYIN o'lchanadi (base64 uzunligi aldamchi);
 *  3. Imzo — fayl ichi haqiqatan JPEG/PNG mi (`mimeType` yolg'on bo'lishi
 *     mumkin, birinchi baytlar esa yo'q).
 */
export function parseImagePayload(image: string): {
  mimeType: string;
  base64: string;
  bytes: number;
} {
  const trimmed = image.trim();

  /*
    Prefiks va yuk ALOHIDA ajratiladi — regex BUTUN satrga qo'llanmaydi.

    ── Nega (o'lchangan) ─────────────────────────────────────────────────────
    Ilgari bu yerda bitta naqsh turardi:

        /^data:([a-zA-Z0-9/+.-]+);base64,([\s\S]+)$/

    `([\s\S]+)` butun base64 yukini tutadi, ya'ni V8 regexp mexanizmi
    ~7 MB satr bo'ylab yuradi va buning uchun JS stack'idan foydalanadi.
    Stack qolgan zaxirasi yetmasa `RegExp.exec` `RangeError: Maximum
    call stack size exceeded` tashlaydi — bu ApiError EMAS, shuning
    uchun `withErrorHandling` uni 400 emas, 500 qilib qaytarardi.

    Aynan shu `tests/e2e/vision.e2e.ts` dagi "JUDA KATTA rasmni rad
    etadi" sinovining beqarorligi edi: fayl yolg'iz ishlatilganda stack
    bo'sh va naqsh o'tib ketadi, to'liq e2e to'plamida esa `next dev`
    ning chuqur chaqiruv zanjiri zaxirani yeydi va o'sha so'rov 500
    bo'lib chiqadi. Stack bilan tasdiqlangan:
        RangeError: Maximum call stack size exceeded
            at RegExp.exec (<anonymous>)
            at parseImagePayload (...)
    Hajmning o'zi sabab emas — 48 MB satr ham bo'sh stack'da bemalol
    o'tadi, ya'ni chegarani ko'tarish muammoni yopmaydi.

    Vergulgacha bo'lgan qism esa har doim qisqa (`data:image/png;base64`)
    — unga naqsh xavfsiz. Yuk umuman regexdan o'tmaydi.

    Xatti-harakat o'zgarmaydi: MIME belgilar to'plamida vergul yo'q,
    ya'ni eski naqsh ham aynan BIRINCHI vergulda ajratardi.
  */
  const separator = trimmed.indexOf(",");
  const prefixMatch =
    separator === -1
      ? null
      : /^data:([a-zA-Z0-9/+.-]+);base64$/.exec(trimmed.slice(0, separator));
  const base64 = separator === -1 ? "" : trimmed.slice(separator + 1);

  if (prefixMatch === null || base64.length === 0) {
    throw apiErrors.validation(
      { image: ["errors.validation.imageNotReadable"] },
      "errors.validation.imageNotReadable",
    );
  }

  const declaredType = prefixMatch[1]!.toLowerCase();

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    throw apiErrors.validation(
      { image: ["errors.validation.imageNotReadable"] },
      "errors.validation.imageNotReadable",
    );
  }

  if (buffer.length === 0) {
    throw apiErrors.validation(
      { image: ["errors.validation.imageNotReadable"] },
      "errors.validation.imageNotReadable",
    );
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw apiErrors.validation(
      { image: ["errors.validation.imageTooLarge"] },
      "errors.validation.imageTooLarge",
    );
  }

  /*
    Haqiqiy format — baytlardan. E'lon qilingan tur bilan solishtirilmaydi
    ham: ishonchli manba faqat bittasi, shuning uchun uni ishlatamiz.
  */
  const actualType = detectImageType(buffer);
  if (actualType === null || !ALLOWED_IMAGE_TYPES.includes(actualType as never)) {
    throw apiErrors.validation(
      { image: ["errors.validation.imageFormatNotSupported"] },
      "errors.validation.imageFormatNotSupported",
    );
  }

  // E'lon qilingan tur bilan haqiqiysi mos kelmasa ham — haqiqiysini
  // ishlatamiz, chunki model aynan shuni kutadi.
  void declaredType;

  return { mimeType: actualType, base64, bytes: buffer.length };
}

/** Rasmni tahlil qiladi. */
export async function analyzeImage(input: VisionInput): Promise<VisionResult> {
  const env = getEnv();

  if (!env.visionConfigured) {
    /*
      Vision uchun ALOHIDA model kerak. Sozlanmagan bo'lsa, umumiy
      modelga qaytish mumkin emas — u rasmni tushunmaydi va tushunarsiz
      400 qaytarardi. Shuning uchun bu yerda aniq xato tashlaymiz.
    */
    throw new AiError({
      kind: "not_configured",
      detail: "VISION_AI_MODEL sozlanmagan — rasm tahlili o'chiq",
    });
  }

  const { mimeType, base64 } = parseImagePayload(input.image);

  const { data, meta } = await generateJson({
    schema: visionAnalysisSchema,
    systemPrompt: buildVisionSystemPrompt(input.language),
    prompt: buildVisionUserPrompt(input),
    images: [{ mimeType, base64 }],
    model: env.visionAiModel,
  });

  return {
    analysis: data,
    durationMs: meta.totalDurationMs,
    model: meta.model,
    usage: meta.usage,
  };
}
