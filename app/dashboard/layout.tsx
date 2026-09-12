import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
 *  3. Umumiy sarlavha (header) — til almashtirgich va "chiqish" tugmasi
 *     BARCHA ichki sahifalarda ko'rinishi uchun. Ilgari u faqat
 *     `/dashboard` sahifasida edi.
 *
 * `getCurrentUser` `cache()` bilan o'ralgan, shuning uchun maket ham,
 * sahifa ham chaqirsa — bazaga BITTA so'rov ketadi.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

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
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
            <Link href="/dashboard" className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{t("name")}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <LocaleSwitcher />
              <LogoutButton />
            </div>
          </div>
        </header>

        {children}
      </div>
    </UserProvider>
  );
}
