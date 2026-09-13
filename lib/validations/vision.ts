import { z } from "zod";
import { gradeSchema, languageSchema, subjectSchema } from "@/lib/validations/common";

/**
 * Rasm tahlili — kirish va javob sxemalari.
 *
 * ── Nega multipart emas, base64 ───────────────────────────────────────────
 * Rasm baribir modelga base64 ko'rinishida ketadi. multipart bilan qabul
 * qilsak, uni serverda yana base64 ga o'girishga to'g'ri kelardi — ya'ni
 * xotirada ikki nusxa. base64 bilan qabul qilish so'rovni ~33% kattaroq
 * qiladi, lekin oqim soddaroq va oraliq fayl umuman paydo bo'lmaydi.
 */

/** Ruxsat etilgan formatlar. */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"] as const;

/**
 * Rasmning eng katta hajmi — 5 MB (dekodlangan holda).
 *
 * Telefon kamerasidagi surat odatda 2-4 MB, ya'ni chegara real
 * foydalanishga xalaqit bermaydi. Undan kattasi esa modelga baribir
 * kichraytirilib yuboriladi — foydasi yo'q, lekin xotira va trafik yeydi.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Fayl turining HAQIQIY tekshiruvi — birinchi baytlar ("magic bytes").
 *
 * ── Nega `mimeType` ga ishonmaymiz ────────────────────────────────────────
 * Uni so'rov yuboruvchi o'zi yozadi. "image/png" deb belgilab, ichida
 * butunlay boshqa narsa yuborish mumkin. Fayl boshidagi imzo esa
 * formatning o'zida yashaydi va uni almashtirib bo'lmaydi.
 */
const SIGNATURES: Array<{ mimeType: string; bytes: number[] }> = [
  { mimeType: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mimeType: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
];

/** Bayt ketma-ketligidan haqiqiy formatni aniqlaydi. Topilmasa `null`. */
export function detectImageType(buffer: Buffer): string | null {
  for (const signature of SIGNATURES) {
    const matches = signature.bytes.every((byte, index) => buffer[index] === byte);
    if (matches) return signature.mimeType;
  }
  return null;
}

/**
 * Kirish sxemasi.
 *
 * Bu yerda faqat SHAKL tekshiriladi (satr bormi, uzunligi oqilonami).
 * Haqiqiy hajm va format tekshiruvi `parseImagePayload()` da — u base64
 * ni dekodlab, baytlarga qaraydi.
 */
export const visionInputSchema = z.object({
  /**
   * `data:image/png;base64,...` ko'rinishidagi rasm.
   *
   * Yuqori chegara base64 uzunligi bo'yicha: 5 MB ≈ 6.99 MB base64,
   * ustiga data URI prefiksi. Bu — birinchi, arzon to'siq; u bo'lmasa
   * 100 MB lik satr dekodlanguncha xotirani egallardi.
   */
  image: z
    .string()
    .min(1, "errors.validation.imageRequired")
    .max(8 * 1024 * 1024, "errors.validation.imageTooLarge"),

  /** Rasm qaysi fanga tegishli ekanini foydalanuvchi aytsa — aniqroq. */
  subject: subjectSchema.optional(),
  grade: gradeSchema.optional(),

  /** Javob tili — interfeys tilidan mustaqil. */
  language: languageSchema.default("UZ"),
});

export type VisionInput = z.infer<typeof visionInputSchema>;

/**
 * Model qaytaradigan tahlil.
 *
 * DIQQAT: xato xabarlari TABIIY MATN (tarjima kaliti emas) — ular
 * foydalanuvchiga emas, modelga qayta so'rovda yuboriladi.
 */
export const visionAnalysisSchema = z.object({
  /** Rasmda nima ko'rsatilgan — 2-5 jumla. */
  description: z
    .string()
    .trim()
    .min(30, "Tavsif juda qisqa — kamida 2 jumla yozing")
    .max(2000, "Tavsif juda uzun"),

  /** Qaysi fanga tegishli ("Matematika", "Biologiya"). */
  subject: z.string().trim().min(2).max(100),

  /**
   * Taxminiy sinf ("7-sinf"). Model aniqlay olmasa ham bo'sh
   * qoldirmasligi uchun ixtiyoriy emas — u taxmin qilishi kerak.
   */
  grade: z.string().trim().min(1).max(50),

  /** Dars mavzusi sifatida ishlatiladigan nom. */
  topic: z.string().trim().min(3).max(300),

  /** Rasmdagi asosiy mazmun — dars ishlanmasi promptiga tushadi. */
  keyContent: z
    .array(z.string().trim().min(3).max(400))
    .min(2, "Kamida 2 ta asosiy nuqta kerak")
    .max(8, "8 tadan ko'p bo'lmasin"),

  /**
   * Rasm o'qilmaganmi yoki darsga aloqasi yo'qmi.
   *
   * Model "bu rasmda dars materiali yo'q" deya olishi kerak — aks holda
   * u mushuk suratidan ham "dars mavzusi" o'ylab topadi.
   */
  usable: z.boolean(),

  /** `usable: false` bo'lsa — nega. Foydalanuvchiga ko'rsatiladi. */
  problem: z.string().trim().min(5).max(500).optional(),
});

export type VisionAnalysis = z.infer<typeof visionAnalysisSchema>;
