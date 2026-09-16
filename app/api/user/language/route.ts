import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { getCurrentUser } from "@/lib/auth/session";
import { LOCALE_COOKIE, UI_LOCALES, languageFromLocale } from "@/lib/i18n/config";

/**
 * `PUT /api/user/language` — interfeys tilini o'zgartirish.
 *
 * ── Ikki xil saqlash ──────────────────────────────────────────────────────
 *  · Kirgan foydalanuvchi → `User.language` ustuniga. Shunda u boshqa
 *    qurilmadan kirganda ham o'zi tanlagan tilni ko'radi.
 *  · Kirmagan foydalanuvchi → cookie'ga. Ro'yxatdan o'tish va kirish
 *    sahifalari ham tanlangan tilda bo'lishi uchun.
 *
 * Cookie HAR IKKI holatda ham qo'yiladi: shunda foydalanuvchi chiqib
 * ketsa ham interfeys tili birdan o'zgarib ketmaydi.
 *
 * DIQQAT: bu FAQAT interfeys tili. Dars ishlanmasi yoki prezentatsiya
 * qaysi tilda generatsiya qilinishi — alohida tushuncha va o'z formasida
 * tanlanadi.
 */

const bodySchema = z.object({
  locale: z.enum(UI_LOCALES, { error: "errors.validation.invalidValue" }),
});

export const PUT = withErrorHandling(async (request) => {
  const { locale } = await parseJsonBody(request, bodySchema);

  const user = await getCurrentUser();
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { language: languageFromLocale(locale) },
    });
  }

  const response = ok({ locale });

  response.cookies.set(LOCALE_COOKIE, locale, {
    // Til maxfiy ma'lumot emas va klient tomonida ham kerak bo'lishi
    // mumkin, shuning uchun httpOnly EMAS.
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
});
