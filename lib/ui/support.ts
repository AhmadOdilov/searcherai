/**
 * Yordam aloqasi.
 *
 * ── Nega alohida fayl ─────────────────────────────────────────────────────
 * Bu manzil interfeysning o'nlab joyida ko'rinadi (har sahifaning
 * pastida, xato ekranlarida). Bir joyda turgani uchun jamoa kontaktni
 * almashtirmoqchi bo'lsa — bitta qator o'zgaradi.
 *
 * Qiymat `NEXT_PUBLIC_SUPPORT_TELEGRAM` dan olinadi (masalan
 * "expelled_coders"), ya'ni build'ni qayta yozmasdan sozlash mumkin.
 * Sozlanmagan bo'lsa — jamoa hisobiga tushadi.
 */
const username = (process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM ?? "expelled_coders").replace(
  /^@/,
  "",
);

export const SUPPORT_TELEGRAM_HANDLE = `@${username}`;
export const SUPPORT_TELEGRAM_URL = `https://t.me/${username}`;
