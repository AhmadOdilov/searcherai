/**
 * Bazada saqlangan xato xabarini ko'rsatish uchun tayyorlaydi.
 *
 * ── Nega alohida funksiya ─────────────────────────────────────────────────
 * `errorMessage` ustuniga endi TARJIMA KALITI yoziladi (`errors.ai.timeout`).
 * Lekin i18n'gacha yaratilgan yozuvlarda TAYYOR MATN turibdi. Bazani
 * migratsiya bilan tozalash mumkin emas — eski matnlar qaysi kalitga
 * to'g'ri kelishini aniq bilib bo'lmaydi.
 *
 * Shuning uchun: qiymat kalitga o'xshasa — tarjima qilinadi, aks holda
 * borligicha ko'rsatiladi. Eski yozuvlar o'zbekcha qolaveradi, yangilari
 * esa joriy tilda chiqadi.
 */

/** Kalit ko'rinishi: `errors.ai.timeout` — nuqtalar, bo'shliqsiz. */
const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_]+)+$/;

export function translateStoredError(t: (key: string) => string, stored: string): string {
  if (!KEY_PATTERN.test(stored)) return stored;

  try {
    return t(stored);
  } catch {
    // Kalit mavjud emas (masalan olib tashlangan) — xom qiymatni beramiz.
    return stored;
  }
}
