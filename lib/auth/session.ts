import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { apiErrors } from "@/lib/api/errors";
import { pickClientIp } from "@/lib/auth/client-ip";
import {
  SESSION_COOKIE,
  sessionExpiry,
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth/jwt";
import type { Language, Role } from "@/lib/generated/prisma/enums";

/**
 * Sessiya boshqaruvi — bazaga tegadigan qism.
 *
 * `lib/auth/jwt.ts` dan farqi: bu fayl faqat server (RSC/route) ichida
 * ishlaydi, cookie'larni o'qiydi/yozadi va bazaga murojaat qiladi.
 */

/** bcrypt "cost" — 12 zamonaviy uskunada ~250ms, brute-force uchun qimmat. */
const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Foydalanuvchi mavjud bo'lmaganda ham parolni "tekshirish" uchun soxta hash.
 *
 * Nega kerak: agar email topilmaganda darhol qaytsak, javob vaqti mavjud
 * email holatidan sezilarli qisqa bo'ladi. Hujumchi shu farq bilan qaysi
 * emaillar ro'yxatda borligini aniqlay oladi (timing orqali hisob sanash).
 * Soxta hash bilan solishtirish vaqtni tenglashtiradi.
 */
const DUMMY_HASH = "$2b$12$" + "x".repeat(53);

export async function equalizePasswordTiming(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH).catch(() => false);
}

/** Sessiya yaratadi va cookie o'rnatadi. */
export async function createSession(userId: string): Promise<void> {
  const expiresAt = sessionExpiry();
  const requestHeaders = await headers();

  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
      userAgent: requestHeaders.get("user-agent")?.slice(0, 255) ?? null,
      // Manzil `lib/auth/client-ip.ts` qoidasi bo'yicha — mijoz
      // soxtalashtira oladigan qiymat diagnostika yozuviga tushmasin.
      ip: pickClientIp(requestHeaders),
    },
  });

  const token = await signSessionToken({ sid: session.id, uid: userId }, expiresAt);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    // JS token'ga tega olmaydi — XSS bo'lsa ham o'g'irlanmaydi.
    httpOnly: true,
    // Boshqa saytdan yuborilgan so'rovlarda cookie ketmaydi (CSRF himoyasi).
    sameSite: "lax",
    // Productionda faqat HTTPS orqali.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Sessiyani bazadan o'chiradi va cookie'ni tozalaydi. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;

  if (token) {
    const claims = await verifySessionToken(token);
    if (claims) {
      // Yozuv allaqachon o'chirilgan bo'lishi mumkin — bu xato emas.
      await prisma.session.delete({ where: { id: claims.sid } }).catch(() => undefined);
    }
  }

  jar.delete(SESSION_COOKIE);
}

/** Foydalanuvchining BARCHA sessiyalarini bekor qiladi (parol o'zgarganda). */
export async function destroyAllSessions(userId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { userId } });
  return count;
}

/** Sahifalarga va API'ga uzatiladigan foydalanuvchi ma'lumoti. */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  language: Language;
  createdAt: Date;
}

/**
 * Joriy foydalanuvchi yoki `null`.
 *
 * ── Nega `cache()` ────────────────────────────────────────────────────
 * Bitta so'rov davomida bu funksiya bir necha marta chaqiriladi: maket,
 * sahifa, va keyinchalik `generateMetadata`. Har biri sessiyani bazadan
 * qayta o'qisa, bitta sahifa uchun bir necha bir xil so'rov ketadi.
 * React'ning `cache()` natijani SO'ROV doirasida saqlaydi — bitta sahifa
 * uchun bitta so'rov.
 */
export const getCurrentUser = cache(
  async function getCurrentUser(): Promise<SessionUser | null> {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const claims = await verifySessionToken(token);
    if (!claims) return null;

    const session = await prisma.session.findUnique({
      where: { id: claims.sid },
      select: {
        id: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            language: true,
            createdAt: true,
          },
        },
      },
    });

    // Sessiya bazada yo'q — chiqilgan yoki bekor qilingan.
    if (!session) return null;

    // JWT muddati o'tmagan bo'lsa ham bazadagi muddat o'tgan bo'lishi mumkin.
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }

    return session.user;
  },
);

/**
 * Joriy foydalanuvchi — bo'lmasa `unauthorized` xatosi.
 *
 * Keyingi modullar (dars ishlanmasi, prezentatsiya, Excel) `userId` ni
 * AYNAN shundan oladi — so'rov tanasidan EMAS. So'rovdagi `userId` ga
 * ishonish boshqa foydalanuvchi nomidan yozish imkonini berardi.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw apiErrors.unauthorized("errors.domain.loginRequired");
  }
  return user;
}

/** Eskirgan sessiyalarni tozalaydi — jadval cheksiz o'smasin. */
export async function pruneExpiredSessions(): Promise<number> {
  const { count } = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
