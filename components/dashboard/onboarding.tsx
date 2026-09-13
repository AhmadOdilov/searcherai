"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { ToneCard } from "@/components/ui/card";

/**
 * Birinchi tashrifdagi qisqa qo'llanma.
 *
 * ── Muammo ────────────────────────────────────────────────────────────────
 * Ro'yxatdan o'tgan o'qituvchi bo'sh ekranga tushadi. Uning boshida
 * savol: "men nima qilishim kerak?" Kompyuter bilan tez-tez ishlaydigan
 * odam kartalarni bosib ko'radi; ishlamaydigan odam esa ilovani yopadi.
 *
 * ── Yechim ────────────────────────────────────────────────────────────────
 * To'rt qadamlik ro'yxat — o'qishga 15 soniya ketadi. Yopilgach qaytib
 * chiqmaydi.
 *
 * ── Nega localStorage, bazada emas ────────────────────────────────────────
 * Bu foydalanuvchi ma'lumoti emas, brauzer afzalligi. Baza ustuni
 * qo'shish migratsiya va yangi so'rov talab qiladi; qiymati esa — bitta
 * bayroq. Yo'qolsa (boshqa brauzer, tarix tozalangan) eng yomoni
 * qo'llanma yana bir marta ko'rinadi, bu zarar emas.
 *
 * ── Nega `useSyncExternalStore` ───────────────────────────────────────────
 * `localStorage` serverda yo'q, ya'ni server HTML'i va brauzerdagi
 * birinchi render bir-biriga mos kelmasligi mumkin ("hydration
 * mismatch"). `useSyncExternalStore` aynan shu holat uchun: serverga
 * "yopiq" deb aytamiz, brauzer esa haqiqiy qiymatni o'qib qayta
 * chizadi. `useEffect` ichida `setState` chaqirish esa ortiqcha
 * render zanjirini keltirib chiqaradi.
 */

const STORAGE_KEY = "searcher-ai:onboarding-dismissed";
const STEP_KEYS = ["step1", "step2", "step3", "step4"] as const;

/** Qo'llanma yopilganda qayta chizishni so'raydigan kuzatuvchilar. */
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    // Maxfiylik rejimida `localStorage` xato berishi mumkin — bunda
    // qo'llanmani ko'rsatmaymiz, ilova esa ishlashda davom etadi.
    return true;
  }
}

/** Serverda `localStorage` yo'q — u yerda qo'llanma chizilmaydi. */
function isDismissedOnServer(): boolean {
  return true;
}

export function Onboarding() {
  const t = useTranslations("dashboard.onboarding");
  const dismissed = useSyncExternalStore(subscribe, isDismissed, isDismissedOnServer);

  if (dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Saqlab bo'lmasa qo'llanma keyingi safar yana chiqadi — bu
      // yopilmay qolishidan yaxshiroq.
    }
    for (const listener of listeners) listener();
  }

  return (
    <ToneCard tone="primary" className="mt-6" padding="md">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-semibold text-primary-ink">{t("title")}</h2>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-primary-ink/60 transition-colors hover:bg-surface/60 hover:text-primary-ink"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>

      <ol className="mt-4 space-y-3">
        {STEP_KEYS.map((key, index) => (
          <li key={key} className="flex gap-3">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-on-primary"
            >
              {index + 1}
            </span>
            <p className="pt-1 text-base leading-relaxed text-primary-ink">{t(key)}</p>
          </li>
        ))}
      </ol>
    </ToneCard>
  );
}
