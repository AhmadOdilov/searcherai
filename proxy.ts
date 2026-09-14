import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/jwt";

/**
 * Proxy — himoyalangan sahifalarni oldindan filtrlash.
 *
 * ── Nega `middleware.ts` emas ─────────────────────────────────────────
 * Next.js 16'da `middleware.ts` ESKIRGAN va `proxy.ts` ga nomlangan.
 * Vazifasi o'zgarmagan, faqat fayl va eksport nomi boshqa.
 *
 * ── Nega bazaga murojaat qilmaydi ─────────────────────────────────────
 * Proxy HAR BIR so'rovda ishlaydi — foydalanuvchi havola ustiga kursorni
 * olib borganda Next.js sahifani oldindan yuklaydi (prefetch) va u ham shu
 * yerdan o'tadi. Har birida bazaga so'rov ketsa, bu sezilarli yuk bo'lardi.
 * Next.js hujjati ham proxy'ni to'liq avtorizatsiya vositasi sifatida
 * ishlatmaslikni tavsiya qiladi.
 *
 * Shuning uchun bu yerda FAQAT "optimistik tekshiruv": cookie bormi va
 * imzosi to'g'rimi. Sessiya bazada hali mavjudmi — buni sahifaning o'zi
 * yoki API route `requireUser()` orqali tekshiradi.
 *
 * Ya'ni proxy — qulaylik qatlami (foydalanuvchini /login'ga yuboradi),
 * xavfsizlik qatlami emas. Haqiqiy himoya `requireUser()` da.
 */

/** Kirish talab qiladigan yo'llar. */
const PROTECTED_PREFIXES = ["/dashboard"];

/**
 * Kirgan foydalanuvchiga keraksiz yo'llar — ular /dashboard'ga yuboriladi.
 *
 * `/` ham shu ro'yxatda: bosh sahifa — tanishtiruv sahifasi, ya'ni
 * ilovani hali bilmagan odam uchun. Kirgan o'qituvchiga u har safar
 * ortiqcha bir bosish qo'shadi.
 *
 * Tekshiruv aynan shu yerda (sahifa ichida `getCurrentUser()` emas),
 * chunki shunda bosh sahifa bazaga umuman murojaat qilmaydi: token
 * imzosini tekshirish bazasiz bajariladi.
 */
const AUTH_PAGES = ["/", "/login", "/register"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? await verifySessionToken(token) : null;
  const hasValidToken = claims !== null;

  // 1. Himoyalangan sahifa, lekin token yo'q/yaroqsiz → /login
  if (isProtected(pathname) && !hasValidToken) {
    const loginUrl = new URL("/login", request.url);
    // Kirgandan keyin foydalanuvchi xohlagan sahifaga qaytishi uchun.
    loginUrl.searchParams.set("next", `${pathname}${search}`);

    const response = NextResponse.redirect(loginUrl);
    // Token yaroqsiz bo'lsa (muddati o'tgan, imzo buzuq) cookie'ni
    // tozalaymiz — aks holda brauzer uni har so'rovda qayta yuboradi.
    if (token) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  // 2. Allaqachon kirgan foydalanuvchi /, /login yoki /register'ga kelsa →
  //    uni ishchi sahifaga qaytaramiz.
  if (AUTH_PAGES.includes(pathname) && hasValidToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Faqat kerakli yo'llarda ishlaydi.
   *
   * API route'lar ATAYLAB chetlab o'tilgan: ular `requireUser()` orqali
   * o'zini himoya qiladi va JSON qaytaradi — HTTP redirect emas. API
   * so'roviga 302 qaytarish klientni chalkashtiradi.
   */
  matcher: ["/", "/dashboard/:path*", "/login", "/register"],
};
