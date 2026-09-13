"use client";

import { useTranslations } from "next-intl";
import { useUser } from "@/lib/hooks/use-user";

/**
 * Salomlashuv.
 *
 * Foydalanuvchini olish uchun HECH QANDAY so'rov yubormaydi — maket
 * contextga qo'ygan qiymatni oladi.
 *
 * Ism bo'yicha murojaat ataylab: ilova "tizim" emas, yordamchi bo'lib
 * ko'rinishi kerak.
 */
export function UserGreeting() {
  const user = useUser();
  const t = useTranslations("dashboard");

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
        {t("welcome", { name: user.fullName })}
      </h1>
      <p className="mt-2 text-base leading-relaxed text-neutral-600">{t("subtitle")}</p>
    </div>
  );
}
