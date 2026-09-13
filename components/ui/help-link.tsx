import { LifeBuoy } from "lucide-react";
import { useTranslations } from "next-intl";
import { SUPPORT_TELEGRAM_HANDLE, SUPPORT_TELEGRAM_URL } from "@/lib/ui/support";
import { cn } from "@/lib/ui/cn";

/**
 * "Yordam kerakmi?" havolasi.
 *
 * ── Nega HAR sahifada ─────────────────────────────────────────────────────
 * Kompyuter bilan ishlashga o'rganmagan odam biror joyda qotib qolsa,
 * ko'pincha ilovani butunlay yopib qo'yadi — chunki kimdan so'rashni
 * bilmaydi. Doim ko'rinib turgan tirik odamning kontakti shu tanlovni
 * oldini oladi.
 *
 * Telegram tanlangan: O'zbekistonda deyarli har bir o'qituvchining
 * telefonida bor va u yerda yozish qo'ng'iroq qilishdan qulayroq.
 */
export function HelpLink({ className }: { className?: string }) {
  const t = useTranslations("support");

  return (
    <a
      href={SUPPORT_TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-base text-neutral-600",
        "transition-colors hover:bg-neutral-100 hover:text-primary",
        className,
      )}
    >
      <LifeBuoy aria-hidden className="size-5 shrink-0" />
      <span>{t("needHelp")}</span>
      <span className="font-medium text-primary">{SUPPORT_TELEGRAM_HANDLE}</span>
    </a>
  );
}
