"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { apiRequest } from "@/lib/api-client";
import { LOCALE_SHORT_NAMES, UI_LOCALES, type UiLocale } from "@/lib/i18n/config";

/**
 * Interfeys tilini almashtirgich.
 *
 * Tanlov serverga yuboriladi (`PUT /api/user/language`), keyin
 * `router.refresh()` bilan sahifa qayta o'qiladi — server komponentlari
 * yangi tilda render bo'ladi.
 *
 * Nega `window.location.reload()` emas: `refresh()` klient holatini
 * (masalan to'ldirilgan formani) saqlab qoladi.
 */
export function LocaleSwitcher() {
  const router = useRouter();
  const current = useLocale() as UiLocale;
  const t = useTranslations("locale");

  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  async function select(locale: UiLocale) {
    if (locale === current || saving) return;

    setSaving(true);
    try {
      await apiRequest("/api/user/language", {
        method: "PUT",
        body: { locale },
      });
      startTransition(() => router.refresh());
    } catch {
      // Til o'zgarmasa ham sahifa ishlashda davom etadi — alohida xato
      // xabari ko'rsatish ortiqcha shovqin bo'lardi.
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || pending;

  return (
    <div
      role="group"
      aria-label={t("switcherLabel")}
      className="inline-flex overflow-hidden rounded-lg border border-slate-300"
    >
      {UI_LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => select(locale)}
            disabled={busy}
            // Skrinrider qaysi til tanlanganini bilishi uchun.
            aria-pressed={active}
            title={t(locale)}
            className={`px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
              active
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {LOCALE_SHORT_NAMES[locale]}
          </button>
        );
      })}
    </div>
  );
}
