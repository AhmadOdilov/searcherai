import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * "Orqaga qaytish" havolasi.
 *
 * Matn ataylab "← Orqaga" emas, balki QAYERGA qaytishini aytadi
 * ("Ro'yxatga qaytish") — brauzerning orqaga tugmasidan farqi shunda.
 *
 * `labelKey` — qaytish joyi ro'yxat bo'lmaganda boshqa matn kerak
 * bo'ladi (masalan qidiruv sahifasidan ish sahifasiga qaytish).
 *
 * Balandligi 44px: telefonda barmoq bilan tegish uchun.
 */
export function BackLink({
  href,
  labelKey = "back",
}: {
  href: string;
  /** `common` bo'limidagi kalit. Standart — "Ro'yxatga qaytish". */
  labelKey?: "back" | "backToDashboard";
}) {
  const t = useTranslations("common");

  return (
    <Link
      href={href}
      className="-ml-3 inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-base text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 print:hidden"
    >
      <ArrowLeft aria-hidden className="size-5 shrink-0" />
      {t(labelKey)}
    </Link>
  );
}
