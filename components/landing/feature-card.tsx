import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/ui/cn";

/**
 * Bosh sahifadagi funksiya kartasi — har biri O'Z rangida.
 *
 * ── Nega dashboard'dagi `LinkCard` emas ───────────────────────────────────
 * Dashboard'da to'rtta karta bir xil ko'rinadi va bu TO'G'RI: u yerda
 * ular teng huquqli tugmalar, rang farqi esa "qaysi biri muhimroq?"
 * degan keraksiz savol tug'dirardi.
 *
 * Bosh sahifada vazifa boshqacha — bir qarashda "bu yerda bir nechta
 * har xil ish bor" degan tuyg'u berish. Shuning uchun har karta
 * palitradagi o'z tusini oladi.
 *
 * ── Palitradan chiqilmadi ─────────────────────────────────────────────────
 * Ranglar — o'sha to'rtta token oilasi (zumrad, amber, yashil va
 * neytral), yangi rang o'ylab topilmadi. Dizayn qoidasi "amber faqat
 * ogohlantirish uchun" ichki sahifalarda kuchda qoladi: bu yerda
 * ogohlantirish ham, holat ham yo'q — faqat bezak.
 */

export type FeatureTone = "primary" | "accent" | "success" | "neutral";

const TONE_CLASSES: Record<FeatureTone, { card: string; icon: string }> = {
  primary: {
    card: "border-primary-border bg-primary-soft",
    icon: "bg-surface text-primary",
  },
  accent: {
    card: "border-accent-border bg-accent-soft",
    icon: "bg-surface text-accent",
  },
  success: {
    card: "border-success-border bg-success-soft",
    icon: "bg-surface text-success",
  },
  neutral: {
    card: "border-neutral-200 bg-neutral-50",
    icon: "bg-surface text-neutral-700",
  },
};

export function FeatureCard({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: LucideIcon;
  tone: FeatureTone;
  title: string;
  description: string;
}) {
  const classes = TONE_CLASSES[tone];

  return (
    <div
      className={cn(
        "flex h-full gap-4 rounded-lg border p-4 transition-transform duration-200 hover:-translate-y-0.5 sm:p-5",
        classes.card,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-lg shadow-card",
          classes.icon,
        )}
      >
        <Icon className="size-7" />
      </span>
      <div className="min-w-0">
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        <p className="mt-1 text-base leading-relaxed text-neutral-700">{description}</p>
      </div>
    </div>
  );
}
