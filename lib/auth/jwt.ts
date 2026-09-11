import { SignJWT, jwtVerify } from "jose";

/**
 * Sessiya JWT'ini imzolash va tekshirish.
 *
 * Bu fayl ATAYLAB bazadan va `next/headers` dan mustaqil: `proxy.ts` ham
 * shu yerdan foydalanadi. Proxy har bir so'rovda (hatto prefetch'da ham)
 * ishlaydi — Next.js hujjati unda bazaga murojaat qilmaslikni tavsiya
 * qiladi. Shuning uchun proxy faqat IMZONI tekshiradi, sessiya bazada
 * hali mavjudmi degan savolni esa sahifa/route hal qiladi.
 *
 * `server-only` belgisi YO'Q — `proxy.ts` React Server Component
 * kontekstida ishlamaydi va bu belgi uni buzadi.
 */

const ALGORITHM = "HS256";

/** JWT ichidagi ma'lumot — faqat identifikatorlar, shaxsiy ma'lumot yo'q. */
export interface SessionClaims {
  /** Session.id — bazadagi sessiya yozuvi. */
  sid: string;
  /** User.id — foydalanuvchi. */
  uid: string;
}

/**
 * Imzo kaliti DANGASA hisoblanadi va keshlanadi.
 *
 * Nega modul darajasida emas: `next build` sahifa ma'lumotini yig'ayotganda
 * modullarni yuklaydi va o'sha paytda AUTH_SECRET bo'lmasa build yiqilardi.
 * Endi kalit faqat birinchi imzo/tekshiruvda kerak bo'ladi.
 *
 * Sinovlar `process.env` ni o'zgartirishi mumkin, shuning uchun kalit
 * o'zgarganini sezib qayta hisoblaymiz.
 */
let cachedKey: Uint8Array | null = null;
let cachedSecret = "";

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("AUTH_SECRET sozlanmagan yoki juda qisqa (kamida 32 belgi kerak)");
  }
  if (!cachedKey || secret !== cachedSecret) {
    cachedKey = new TextEncoder().encode(secret);
    cachedSecret = secret;
  }
  return cachedKey;
}

/** Sessiya tokenini imzolaydi. */
export async function signSessionToken(
  claims: SessionClaims,
  expiresAt: Date,
): Promise<string> {
  return new SignJWT({ sid: claims.sid, uid: claims.uid })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secretKey());
}

/**
 * Tokenni tekshiradi. Yaroqsiz, buzilgan yoki muddati o'tgan bo'lsa `null`.
 *
 * Ataylab xato TASHLAMAYDI: chaqiruvchilar uchun "token yo'q" va "token
 * yaroqsiz" bir xil natija — ikkalasida ham foydalanuvchi kirmagan.
 */
export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: [ALGORITHM],
    });
    if (typeof payload.sid === "string" && typeof payload.uid === "string") {
      return { sid: payload.sid, uid: payload.uid };
    }
    return null;
  } catch {
    // Imzo mos kelmadi, muddati o'tdi yoki shakli buzuq.
    return null;
  }
}

/** Sessiya cookie'sining nomi. */
export const SESSION_COOKIE = "searcher_session";

/** Sessiya qancha yashaydi. */
export const SESSION_TTL_DAYS = 30;

export function sessionExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}
