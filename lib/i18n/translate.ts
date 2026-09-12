import "server-only";
import { getTranslations } from "next-intl/server";
import { getRequestLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE, type UiLocale } from "@/lib/i18n/config";
import uzMessages from "@/messages/uz.json";
import ruMessages from "@/messages/ru.json";

/**
 * Server tomonida tarjima — xato xabarlari uchun.
 *
 * ── Nega alohida yordamchi ────────────────────────────────────────────────
 * Xato kalitlari to'liq yo'l ko'rinishida keladi: `"errors.ai.timeout"`.
 * next-intl'ning `getTranslations()` esa odatda bo'lim (namespace) bilan
 * ishlaydi. Bu yerda bo'lim OLDINDAN noma'lum, shuning uchun ildizdan
 * tarjima qiladigan funksiya olinadi.
 *
 * ── Nega ZAXIRA yo'l bor ──────────────────────────────────────────────────
 * `getTranslations()` next-intl sozlamasi yuklanmagan kontekstda XATO
 * TASHLAYDI ("Couldn't find next-intl config file"). Bu ikki holatda
 * uchraydi: birlik sinovlarida va Next.js build konteksti tashqarisidagi
 * chaqiruvlarda.
 *
 * Bu qatlam XATO JAVOBINI shakllantiradi — ya'ni u ishlamay qolsa,
 * foydalanuvchi tushunarli xato o'rniga 500 oladi. Xato haqidagi xato —
 * eng yomon holat. Shuning uchun next-intl ishlamasa, tarjima
 * to'g'ridan-to'g'ri JSON fayldan olinadi.
 */

const MESSAGES: Record<UiLocale, unknown> = {
  uz: uzMessages,
  ru: ruMessages,
};

/** `"errors.ai.timeout"` → JSON ichidagi qiymat. */
function lookup(messages: unknown, key: string): string | null {
  const value = key
    .split(".")
    .reduce<unknown>(
      (current, part) =>
        typeof current === "object" && current !== null
          ? (current as Record<string, unknown>)[part]
          : undefined,
      messages,
    );

  return typeof value === "string" ? value : null;
}

/** `{name}` ko'rinishidagi o'rinbosarlarni to'ldiradi. */
function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

/** Zaxira yo'l: JSON fayldan to'g'ridan-to'g'ri o'qish. */
async function translateDirectly(
  key: string,
  values?: Record<string, string | number>,
): Promise<string> {
  let locale: UiLocale = DEFAULT_LOCALE;
  try {
    locale = await getRequestLocale();
  } catch {
    // So'rov konteksti yo'q — standart til.
  }

  const text = lookup(MESSAGES[locale], key) ?? lookup(MESSAGES[DEFAULT_LOCALE], key);
  if (text === null) {
    console.warn(`[i18n] tarjima topilmadi: ${key}`);
    return key;
  }
  return interpolate(text, values);
}

export async function translateKey(
  key: string,
  values?: Record<string, string | number>,
): Promise<string> {
  try {
    const t = await getTranslations();
    return t(key, values);
  } catch {
    return translateDirectly(key, values);
  }
}

/** Bir nechta kalitni birdan tarjima qiladi (masalan `fieldErrors`). */
export async function translateFieldErrors(
  fieldErrors: Record<string, string[]>,
): Promise<Record<string, string[]>> {
  const entries = await Promise.all(
    Object.entries(fieldErrors).map(async ([field, keys]) => {
      const translated = await Promise.all(keys.map((key) => translateKey(key)));
      return [field, translated] as const;
    }),
  );

  return Object.fromEntries(entries);
}
