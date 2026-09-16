"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Saqlanmagan o'zgarishlar haqidagi tasdiq oynasi.
 *
 * ── Nega QOPLAMA (overlay), sahifa ichidagi karta emas ────────────────────
 * Muharrirlarda ilgari shunday karta bor edi va u O'ZINING «orqaga»
 * tugmasi uchun ishlardi — tugma ham, karta ham ekranning yuqorisida
 * yonma-yon turardi.
 *
 * Endi ogohlantirish sarlavhadagi havolalar uchun ham chiqadi, ular esa
 * sahifaning istalgan joyidan bosiladi: 20 slaydli muharrirning
 * pastida turgan o'qituvchi yuqoridagi kartani UMUMAN ko'rmasdi —
 * bosgan havolasi "ishlamadi" deb o'ylardi. Qoplama qayerda bo'lsa ham
 * ko'rinadi.
 *
 * Ko'rinish `slide-preview.tsx` dagi qoplama bilan bir xil qoidada:
 * `role="dialog"`, `aria-modal`, ESC bilan yopiladi va ochilganda
 * fokus oynaga ko'chadi — aks holda klaviatura bilan ishlaydigan
 * foydalanuvchi ortidagi sahifada qolib ketardi.
 */
export function UnsavedDialog({
  saving,
  onSaveAndLeave,
  onLeave,
  onStay,
}: {
  saving: boolean;
  onSaveAndLeave: () => void;
  onLeave: () => void;
  onStay: () => void;
}) {
  const t = useTranslations("editor");
  const panelRef = useRef<HTMLDivElement>(null);

  /*
    ESC — "shu yerda qolish".

    Eng xavfsiz tanlov: tasodifan bosilgan tugma hech qachon ishni
    yo'qotmaydi.
  */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onStay();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onStay]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-dialog-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/60 p-4 sm:items-center"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-lg bg-surface p-5 outline-none"
      >
        <p
          id="unsaved-dialog-title"
          className="flex gap-3 text-base leading-relaxed text-neutral-900"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-ink" />
          <span>{t("unsaved.body")}</span>
        </p>

        {/*
          Tugmalar tartibi ataylab: eng xavfsiz amal ("saqlab chiqish")
          birinchi va to'ldirilgan, ish yo'qotadigan amal esa oxirida va
          eng past ovozda.

          Telefonda ular ustma-ust tushadi va har biri butun kenglikni
          oladi — 44px qoidasi shu yerda ham amal qiladi.
        */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button onClick={onSaveAndLeave} loading={saving} disabled={saving}>
            {t("unsaved.saveAndLeave")}
          </Button>
          <Button variant="secondary" onClick={onStay} disabled={saving}>
            {t("unsaved.stay")}
          </Button>
          <Button variant="ghost" onClick={onLeave} disabled={saving}>
            {t("unsaved.leave")}
          </Button>
        </div>
      </div>
    </div>
  );
}
