"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Joriy foydalanuvchi — klient komponentlari uchun.
 *
 * ── Nega fetch EMAS ──────────────────────────────────────────────────────
 * Birinchi variantda bu hook `useEffect` ichida `/api/auth/me` ga so'rov
 * yuborardi. Uch muammo bor edi:
 *   1. Har sahifa yuklanishida qo'shimcha HTTP so'rov — serverda foydalanuvchi
 *      allaqachon ma'lum bo'lsa ham.
 *   2. Birinchi renderda `user = null` bo'lib, ekranda "yuklanmoqda"
 *      miltillashi paydo bo'lardi.
 *   3. React'ning `set-state-in-effect` qoidasini buzardi (kaskad renderlar).
 *
 * Endi foydalanuvchini SERVER komponenti (`app/dashboard/layout.tsx`)
 * o'qiydi va context orqali pastga uzatadi. Hook faqat contextdan oladi —
 * so'rov ham, effekt ham, yuklanish holati ham yo'q.
 *
 * ── Keyingi modullar uchun MUHIM ─────────────────────────────────────────
 * Bu hook faqat KO'RSATISH uchun: ism, email, til tanlash, "chiqish".
 * Dars ishlanmasi yoki prezentatsiya yaratganda `user.id` ni API'ga
 * YUBORMANG — backend uni `requireUser()` bilan sessiyadan oladi.
 * Klient yuborgan `userId` ga ishonib bo'lmaydi: uni brauzer konsolidan
 * o'zgartirib, boshqa foydalanuvchi nomidan yozish mumkin.
 */

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: "TEACHER" | "ADMIN";
  language: "UZ" | "RU" | "EN";
}

/**
 * `undefined` — provider umuman yo'q (xato).
 * `null` — provider bor, lekin foydalanuvchi kirmagan.
 */
const UserContext = createContext<CurrentUser | null | undefined>(undefined);

export function UserProvider({
  user,
  children,
}: {
  user: CurrentUser | null;
  children: ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

/**
 * Kirgan foydalanuvchi. Provider ichida chaqirilishi SHART.
 *
 * Himoyalangan sahifalarda foydalanuvchi har doim mavjud (maket uni
 * tekshiradi), shuning uchun `null` qaytmaydi — `useOptionalUser` dan
 * farqi shunda.
 */
export function useUser(): CurrentUser {
  const user = useContext(UserContext);

  if (user === undefined) {
    throw new Error(
      "useUser() <UserProvider> ichida chaqirilishi kerak. " +
        "Himoyalangan sahifalar app/dashboard/layout.tsx ichida joylashadi.",
    );
  }
  if (user === null) {
    throw new Error(
      "useUser() kirmagan foydalanuvchi uchun chaqirildi. " +
        "Ixtiyoriy holat kerak bo'lsa useOptionalUser() dan foydalaning.",
    );
  }

  return user;
}

/** Foydalanuvchi bo'lmasligi mumkin bo'lgan joylar uchun (masalan bosh sahifa). */
export function useOptionalUser(): CurrentUser | null {
  const user = useContext(UserContext);
  return user ?? null;
}
