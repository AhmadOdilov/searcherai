import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/jwt";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * `/session-expired` — eskirgan cookie'ni tozalab, kirish sahifasiga
 * yuboradi.
 *
 * ── Qanday holat uchun ────────────────────────────────────────────────────
 * Cookie'dagi JWT imzosi yaroqli, lekin bazadagi sessiya endi yo'q:
 * boshqa qurilmadan chiqilgan, sessiya tozalangan yoki hisob
 * o'chirilgan. Bunday holatda ilova HALQAGA tushib qolardi:
 *
 *   /dashboard → maket foydalanuvchini topmaydi → /login
 *   /login     → proxy tokenni yaroqli deb biladi → /dashboard → …
 *
 * Foydalanuvchi esa bo'sh oq ekranni ko'rardi va hech qanday tugma
 * yordam bermasdi — brauzer cookie'sini qo'lda tozalashdan boshqa yo'l
 * yo'q edi.
 *
 * Halqani uzish uchun cookie o'chirilishi kerak, lekin Server Component
 * (maket) cookie yoza olmaydi — buni faqat route handler qila oladi.
 * Shuning uchun maket shu manzilga yo'naltiradi.
 *
 * ── Nega bu GET so'rov XAVFSIZ ────────────────────────────────────────────
 * Cookie FAQAT sessiya haqiqatan yaroqsiz bo'lganda o'chiriladi. Ya'ni
 * boshqa saytdagi `<img src="…/session-expired">` kirgan foydalanuvchini
 * tizimdan chiqara olmaydi — u shunchaki ishchi sahifaga qaytadi.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();

  if (user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
