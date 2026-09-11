import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { UserProvider } from "@/lib/hooks/use-user";

/**
 * Himoyalangan sohaning maketi.
 *
 * Bu yerda IKKI ish bajariladi:
 *  1. Haqiqiy avtorizatsiya tekshiruvi. `proxy.ts` faqat cookie imzosini
 *     ko'radi — sessiya bazada o'chirilgan bo'lsa ham token yaroqli
 *     ko'rinadi. Shuning uchun ishonchli tekshiruv AYNAN shu yerda.
 *  2. Foydalanuvchini klient komponentlariga context orqali uzatish —
 *     `useUser()` shundan oladi, qo'shimcha HTTP so'rovsiz.
 *
 * `getCurrentUser` `cache()` bilan o'ralgan, shuning uchun maket ham,
 * sahifa ham chaqirsa — bazaga BITTA so'rov ketadi.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

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
      {children}
    </UserProvider>
  );
}
