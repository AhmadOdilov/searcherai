import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";

/**
 * Bosh sahifaning asosiy tugmasi.
 *
 * Umumiy `LinkButton` ning O'ZI — faqat ustiga bosh sahifaga xos ikki
 * narsa qo'shiladi: rangli porlash (soya) va kengroq ichki bo'shliq.
 *
 * ── Nega `Button` ning o'zi o'zgartirilmadi ───────────────────────────────
 * Porlash butun ilovaga tarqalsa, dashboard'dagi o'nlab tugma ham
 * "reklama tugmasi" ko'rinishiga o'tardi. Ichki sahifalarda esa tugma
 * jim bo'lishi kerak: u yerda foydalanuvchi allaqachon ishonch bildirgan,
 * uni ko'ndirish shart emas.
 */
export function HeroButton({
  href,
  variant = "primary",
  children,
}: {
  href: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
}) {
  return (
    <LinkButton
      href={href}
      size="lg"
      variant={variant}
      fullWidth
      className={cn(
        "sm:w-auto sm:px-12",
        "transition-transform duration-200 hover:-translate-y-0.5",
        variant === "primary" &&
          // Porlash asosiy rangdan olinadi — qorong'i rejimda ham mos keladi.
          "shadow-[0_12px_32px_-12px_var(--color-primary)] hover:shadow-[0_18px_40px_-12px_var(--color-primary)]",
      )}
    >
      {children}
    </LinkButton>
  );
}
