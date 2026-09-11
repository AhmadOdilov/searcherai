"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api-client";

/**
 * Chiqish tugmasi.
 *
 * `router.replace()` + `router.refresh()` ishlatiladi:
 *  · `replace` — tarixda /dashboard qolmasin, "orqaga" tugmasi bilan
 *    qaytib bo'lmasin.
 *  · `refresh` — server komponentlari keshini tozalaydi, aks holda eski
 *    foydalanuvchi ismi ekranda qolib qolishi mumkin.
 *
 * (`window.location.href` ham ishlardi, lekin u butun sahifani qaytadan
 * yuklaydi va Next.js buni tavsiya qilmaydi.)
 */
export function LogoutButton() {
  const router = useRouter();
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
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
    >
      {busy ? "Chiqilmoqda…" : "Chiqish"}
    </button>
  );
}
