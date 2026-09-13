"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

/**
 * Chiqish tugmasi.
 *
 * `router.replace()` + `router.refresh()` ishlatiladi:
 *  · `replace` — tarixda /dashboard qolmasin, "orqaga" tugmasi bilan
 *    qaytib bo'lmasin.
 *  · `refresh` — server komponentlari keshini tozalaydi, aks holda eski
 *    foydalanuvchi ismi ekranda qolib qolishi mumkin.
 *
 * Telefonda faqat belgi ko'rinadi (joy tor), `sm` ekrandan boshlab matn
 * ham qo'shiladi — belgi yolg'iz o'zi hamma uchun tushunarli emas.
 */
export function LogoutButton() {
  const router = useRouter();
  const t = useTranslations("auth");
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch {
      // Xato bo'lsa ham /login'ga o'tamiz: sessiya serverda o'chirilgan
      // bo'lishi mumkin, foydalanuvchini shu sahifada qoldirish yomonroq.
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      loading={busy}
      aria-label={t("logout")}
      icon={busy ? undefined : <LogOut aria-hidden className="size-5" />}
    >
      <span className="hidden sm:inline">{busy ? t("loggingOut") : t("logout")}</span>
    </Button>
  );
}
