/**
 * Rasm tahlilini dars ishlanmasi formasiga uzatish.
 *
 * ── Nega `sessionStorage` ────────────────────────────────────────────────
 * Rasmdan o'qilgan matn 1-2 ming belgi bo'lishi mumkin. Manzil
 * parametriga qo'ysak brauzer chegarasiga (~2000 belgi) urilardi.
 * Serverda saqlash esa yangi jadval va tozalash mantig'ini talab
 * qilardi — bir martalik uzatish uchun bu ortiqcha.
 *
 * `sessionStorage` faqat shu yorliqda yashaydi va brauzer yopilishi
 * bilan o'chadi. Serverga hech narsa yozilmaydi.
 *
 * Bu fayl ATAYLAB "server-only" emas: uni ikkala klient komponenti
 * (yuboruvchi va qabul qiluvchi) import qiladi.
 */

/** `sessionStorage` kaliti — ikkala tomonda bir xil bo'lishi uchun. */
export const VISION_HANDOFF_KEY = "searcher-ai:vision-handoff";

export interface VisionHandoff {
  subject: string;
  grade: string;
  topic: string;
  /** Rasmdan o'qilgan matn — dars ishlanmasi promptiga tushadi. */
  sourceMaterial: string;
}

/**
 * Saqlangan tahlilni o'qiydi va DARHOL o'chiradi.
 *
 * Nega o'chiriladi: forma bir marta to'ldirilishi kerak. O'chirmasak,
 * o'qituvchi keyingi safar "yangi dars" tugmasini bosganda eski rasm
 * ma'lumotlari jim qaytib kelardi va u nega boshqa mavzu chiqqanini
 * tushunmasdi.
 */
export function takeVisionHandoff(): VisionHandoff | null {
  try {
    const raw = window.sessionStorage.getItem(VISION_HANDOFF_KEY);
    if (raw === null) return null;

    window.sessionStorage.removeItem(VISION_HANDOFF_KEY);

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as VisionHandoff).sourceMaterial !== "string"
    ) {
      return null;
    }
    return parsed as VisionHandoff;
  } catch {
    // Maxfiylik rejimi, buzuq JSON — forma shunchaki bo'sh ochiladi.
    return null;
  }
}
