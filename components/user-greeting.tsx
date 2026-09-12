"use client";

import { useTranslations } from "next-intl";
import { useUser } from "@/lib/hooks/use-user";

/**
 * `useUser()` dan foydalanishga namuna.
 *
 * Bu komponent klient tomonida ishlaydi, lekin foydalanuvchini olish uchun
 * HECH QANDAY so'rov yubormaydi — maket contextga qo'ygan qiymatni oladi.
 */
export function UserGreeting() {
  const user = useUser();
  const t = useTranslations("dashboard");

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">
        {t("welcome", { name: user.fullName })}
      </h1>
      <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
    </div>
  );
}
