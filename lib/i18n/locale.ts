import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isUiLocale,
  localeFromAcceptLanguage,
  localeFromLanguage,
  type UiLocale,
} from "@/lib/i18n/config";

/**
 * Joriy so'rov uchun interfeys tilini aniqlaydi.
 *
 * Ustuvorlik tartibi:
 *  1. Kirgan foydalanuvchining `User.language` ustuni — u ataylab tanlagan
 *  2. Cookie — kirmagan foydalanuvchining tanlovi
 *  3. `Accept-Language` — brauzer tili
 *  4. Standart: "uz"
 *
 * Nega foydalanuvchi cookie'dan YUQORI: foydalanuvchi boshqa qurilmadan
 * kirsa ham o'zi tanlagan tilni ko'rishi kerak.
 *
 * `cache()` bilan o'ralgan — bitta so'rov davomida maket, sahifa va
 * `generateMetadata` chaqirsa ham bazaga bitta so'rov ketadi
 * (`getCurrentUser` ham o'z navbatida keshlangan).
 */
export const getRequestLocale = cache(
  async function getRequestLocale(): Promise<UiLocale> {
    // 1. Foydalanuvchi tanlovi
    //
    // Dinamik import: `lib/auth/session.ts` bazaga bog'langan, bu fayl esa
    // `i18n/request.ts` orqali build paytida ham yuklanadi.
    try {
      const { getCurrentUser } = await import("@/lib/auth/session");
      const user = await getCurrentUser();
      if (user) return localeFromLanguage(user.language);
    } catch {
      // Baza mavjud emas yoki so'rov konteksti yo'q — keyingi manbaga o'tamiz.
    }

    // 2. Cookie
    try {
      const jar = await cookies();
      const stored = jar.get(LOCALE_COOKIE)?.value;
      if (isUiLocale(stored)) return stored;
    } catch {
      // So'rov konteksti yo'q (masalan build paytida).
    }

    // 3. Brauzer tili
    try {
      const requestHeaders = await headers();
      const fromBrowser = localeFromAcceptLanguage(requestHeaders.get("accept-language"));
      if (fromBrowser) return fromBrowser;
    } catch {
      // Yuqoridagi kabi.
    }

    return DEFAULT_LOCALE;
  },
);
