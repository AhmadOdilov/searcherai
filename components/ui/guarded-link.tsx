"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { useUnsavedGuard } from "@/lib/hooks/use-unsaved-guard";

/**
 * Saqlanmagan o'zgarishni hisobga oladigan havola.
 *
 * ── Nega oddiy `<Link>` yetarli emas ──────────────────────────────────────
 * Ilova ichidagi o'tish brauzerning `beforeunload` hodisasini ishga
 * tushirmaydi. Ya'ni muharrirda tahrir qilib turib sarlavhadagi nomni
 * bosgan o'qituvchi hech qanday ogohlantirish ko'rmasdan ishini
 * yo'qotardi.
 *
 * ── Qanday ishlaydi ───────────────────────────────────────────────────────
 * `onNavigate` — Next.js 16 ning rasmiy API'si (v15.3 dan beri) va u
 * FAQAT klient tomonidagi o'tishda ishlaydi. `preventDefault()` o'tishni
 * to'xtatadi; qo'riqchi esa tasdiq oynasini ochadi va foydalanuvchi
 * rozi bo'lsa o'tishni O'ZI bajaradi.
 *
 * Modifikator bilan bosish (Ctrl/Cmd + klik) va `download` havolalari
 * `onNavigate` ni umuman chaqirmaydi — ular yangi yorliq ochadi yoki
 * fayl yuklaydi, ya'ni joriy sahifa va undagi qoralama JOYIDA qoladi.
 * Ogohlantirish ham kerak emas.
 *
 * ── Nega `href` faqat satr ────────────────────────────────────────────────
 * `router.push()` obyekt shaklini qabul qilmaydi, ya'ni uni qo'lda
 * satrga aylantirish kerak bo'lardi. Ilovada barcha havolalar
 * allaqachon satr — kerak bo'lmagan shaklni qo'llab-quvvatlash faqat
 * xato manbasi bo'lardi.
 */
export function GuardedLink({
  href,
  children,
  ...rest
}: Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & {
  href: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { requestLeave } = useUnsavedGuard();

  return (
    <Link
      {...rest}
      href={href}
      onNavigate={(event) => {
        // Qo'riqchi o'tishni kechiktirgan bo'lsa — Next'ni to'xtatamiz.
        if (!requestLeave(() => router.push(href))) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </Link>
  );
}
