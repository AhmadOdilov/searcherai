import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GraduationCap } from "lucide-react";
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
