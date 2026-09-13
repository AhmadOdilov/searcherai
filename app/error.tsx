"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpLink } from "@/components/ui/help-link";

/**
 * Kutilmagan xato ekrani.
 *
 * ── Nega kerak ────────────────────────────────────────────────────────────
 * Bu fayl bo'lmasa, kutilmagan xatolikda Next.js o'zining STANDART
 * ekranini ko'rsatadi — u inglizcha va texnik. O'qituvchi uchun bu
 * "dastur buzildi" degani va u nima qilishni bilmaydi.
 *
 * Bu yerda: inson tilida bitta jumla, bitta katta tugma va yordam
 * kontakti. Texnik tafsilot FAQAT konsolga ketadi — ekranda hech qachon
 * xato matni, kod yoki manzil ko'rinmaydi.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Foydalanuvchiga ko'rsatmaymiz, lekin loglaymiz — `digest` server
    // logidagi yozuv bilan bog'lash uchun.
    console.error("[xato] kutilmagan:", error.digest ?? error.message);
  }, [error]);

  const t = useTranslations("errorPage");

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md text-center">
        <div
          aria-hidden
          className="mx-auto mb-6 flex size-16 items-center justify-center rounded-xl bg-accent-soft text-accent"
        >
          <AlertTriangle className="size-9" />
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          {t("title")}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          {t("description")}
        </p>

        <div className="mt-8">
          <Button
            size="lg"
            fullWidth
            onClick={reset}
            icon={<RefreshCw aria-hidden className="size-5" />}
          >
            {t("retry")}
          </Button>
        </div>

        <div className="mt-8 flex justify-center">
          <HelpLink />
        </div>
      </div>
    </main>
  );
}
