/**
 * Mavzu nomidan qidiruv so'zlarini ajratish.
 *
 * ── Nega `service.ts` dan AJRATILGAN ──────────────────────────────────────
 * `service.ts` `prisma` ni import qiladi, u esa yuklanish paytida
 * `getEnv()` ni chaqiradi — ya'ni uni import qilish `.env` ni talab
 * qiladi. Birlik sinovlari esa `.env` siz ishlaydi.
 *
 * Loyihadagi qoida: sof funksiyalar (validatsiya, promptlar, bu fayl)
 * hech narsaga bog'lanmaydi; baza bilan ishlash servis qatlamida
 * qoladi.
 */

/** Qidiruvda e'tiborga olinmaydigan qisqa yoki umumiy so'zlar. */
const STOP_WORDS = new Set([
  "va",
  "bilan",
  "uchun",
  "hamda",
  "yoki",
  "ning",
  "dan",
  "ga",
  "da",
  "ni",
]);

/**
 * Mavzu nomidan qidiriladigan so'zlarni ajratadi.
 *
 * Qo'shimchalar (`-larni`, `-ning`) morfologik tahlil bilan kesilmaydi —
 * o'zbek tili uchun bu alohida ish. O'rniga uzun so'zning BOSHI
 * olinadi: "kasrlarni" → "kasrl", va `ILIKE '%kasrl%'` dasturdagi
 * "KASRLAR" ni ham topadi.
 */
export function searchTerms(topic: string): string[] {
  return topic
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
    .map((word) => (word.length > 6 ? word.slice(0, 6) : word))
    .slice(0, 5);
}
