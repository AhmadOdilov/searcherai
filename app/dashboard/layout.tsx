import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GraduationCap, Settings } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { UserProvider } from "@/lib/hooks/use-user";
import { LogoutButton } from "@/components/logout-button";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";

/**
 * Himoyalangan sohaning maketi.
 *
 * Bu yerda UCH ish bajariladi:
 *  1. Haqiqiy avtorizatsiya tekshiruvi. `proxy.ts` faqat cookie imzosini
 *     ko'radi — sessiya bazada o'chirilgan bo'lsa ham token yaroqli
 *     ko'rinadi. Shuning uchun ishonchli tekshiruv AYNAN shu yerda.
 *  2. Foydalanuvchini klient komponentlariga context orqali uzatish.
 *  3. Umumiy sarlavha — nom, til almashtirgich va "chiqish" tugmasi.
 *
 * ── Sarlavha ataylab "past ovozda" ────────────────────────────────────────
 * Til va chiqish — texnik amallar, ular kuniga bir marta ham kerak
 * bo'lmaydi. Shuning uchun ular kichik va chetda; sahifaning asosiy
 * amallari esa markazda va katta.
 *
 * `getCurrentUser` `cache()` bilan o'ralgan, shuning uchun maket ham,
 * sahifa ham chaqirsa — bazaga BITTA so'rov ketadi.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await getCurrentUser();
  /*
    `/login` EMAS, `/session-expired`: bu yerga cookie yaroqli, lekin
    bazadagi sessiya yo'q holatda ham tushish mumkin. O'shanda `/login`
    ga yuborsak, proxy tokenni ko'rib bizni yana `/dashboard` ga
    qaytaradi — halqa. `/session-expired` esa cookie'ni o'chirib,
    halqani uzadi.
  */
  if (!user) redirect("/session-expired");

  const t = await getTranslations("app");

  return (
    <UserProvider
      user={{
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        language: user.language,
      }}
    >
      <div className="min-h-screen bg-canvas">
        {/*
          Asosiy mazmunga o'tish havolasi.

          Odatda ko'rinmaydi — faqat klaviatura bilan unga fokus
          kelganda chiqadi. Skrinrider yoki faqat klaviatura bilan
          ishlaydigan foydalanuvchi har sahifada sarlavhadagi
          havolalarni qayta-qayta bosib o'tmasligi uchun.
        */}
        <a
          href="#asosiy"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
        >
          {t("skipToContent")}
        </a>

        <header className="border-b border-neutral-200 bg-surface print:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link
              href="/dashboard"
              className="flex min-w-0 items-center gap-3 rounded-md py-1"
            >
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"
              >
                <GraduationCap className="size-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold text-neutral-900">
                  {t("name")}
                </span>
                <span className="block truncate text-sm text-neutral-500">
                  {user.fullName}
                </span>
              </span>
            </Link>

            <div className="flex shrink-0 items-center gap-2">
              {/*
                Sozlamalar — belgili havola. Matn bilan yozsak, telefonda
                sarlavha uch elementdan iborat bo'lib, foydalanuvchi ismi
                siqilib ketardi.
              */}
              <Link
                href="/dashboard/settings"
                aria-label={t("settings")}
                title={t("settings")}
                className="flex size-11 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <Settings aria-hidden className="size-5" />
              </Link>
              <LocaleSwitcher />
              <LogoutButton />
            </div>
          </div>
        </header>

        {/*
          `<main>` — sahifaning asosiy sohasi. Skrinriderlar shu
          belgiga qarab "asosiy mazmun" ni topadi; ilgari bu yerda
          oddiy `<div>` turardi va landmark umuman yo'q edi.
        */}
        <main id="asosiy">{children}</main>
      </div>
    </UserProvider>
  );
}
