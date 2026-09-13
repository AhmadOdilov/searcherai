import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Tarjima matnlarini sinovlar uchun o'qiydi.
 *
 * ── Nega kerak ────────────────────────────────────────────────────────────
 * Ilgari i18n sinovlari kutilgan matnni QATTIQ yozardi:
 * `assert.match(html, /Hisobingizga kiring/)`. Sinovning maqsadi esa
 * matnning aynan shu so'zlardan iborat bo'lishi emas — sahifa TO'G'RI
 * TILDA render bo'lishi. Matn tahrirlanishi bilan (masalan interfeys
 * soddalashtirilganda) o'nlab sinov jim yiqilardi.
 *
 * Endi kutilgan matn tarjima faylining O'ZIDAN olinadi: matn o'zgarsa
 * sinov o'zgarmaydi, lekin kalit ishlatilmay qolsa yoki noto'g'ri til
 * render bo'lsa — darhol yiqiladi.
 */

type Messages = Record<string, unknown>;

const cache = new Map<string, Messages>();

function load(locale: "uz" | "ru"): Messages {
  const cached = cache.get(locale);
  if (cached !== undefined) return cached;

  const file = path.join(process.cwd(), "messages", `${locale}.json`);
  const parsed = JSON.parse(readFileSync(file, "utf8")) as Messages;
  cache.set(locale, parsed);
  return parsed;
}

/** `text("uz", "auth.login.title")` → "Hisobingizga kiring". */
export function text(locale: "uz" | "ru", key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null ? (node as Messages)[part] : undefined,
      load(locale),
    );

  if (typeof value !== "string") {
    throw new Error(`tarjima topilmadi: ${locale}.${key}`);
  }
  return value;
}

/**
 * HTML ichida tarjima matni bor-yo'qligini tekshiradi.
 *
 * React apostrof va tirnoqni HTML kodiga aylantiradi (`&#x27;`), shuning
 * uchun oddiy `includes` o'zbekcha matnda ishlamaydi.
 */
export function htmlIncludes(html: string, needle: string): boolean {
  const escaped = needle
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
  return html.includes(needle) || html.includes(escaped);
}
