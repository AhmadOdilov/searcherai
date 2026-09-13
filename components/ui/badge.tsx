import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/ui/cn";

/**
 * Nishon — qisqa holat belgisi.
 *
 * Rang YAGONA belgi emas: har bir holatda o'z ikonkasi ham bor. Rang
 * ajratolmaydigan foydalanuvchi (erkaklarning ~8%) "tayyor" va "xato"ni
 * faqat rangdan farqlay olmaydi.
 */

export type BadgeTone = "primary" | "accent" | "success" | "danger" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  primary: "border-primary-border bg-primary-soft text-primary-ink",
  accent: "border-accent-border bg-accent-soft text-accent-ink",
  success: "border-success-border bg-success-soft text-success-ink",
  danger: "border-danger-border bg-danger-soft text-danger-ink",
  neutral: "border-neutral-200 bg-neutral-100 text-neutral-600",
};

export function Badge({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: BadgeTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export type GenerationStatus = "PENDING" | "READY" | "FAILED";

const STATUS_TONES: Record<GenerationStatus, BadgeTone> = {
  PENDING: "accent",
  READY: "success",
  FAILED: "danger",
};

/** Generatsiya holati — matn `messages/*.json` dagi `status.*` dan. */
export function StatusBadge({ status }: { status: GenerationStatus }) {
  const t = useTranslations("status");

  const icon =
    status === "PENDING" ? (
      // Kutish belgisi aylanadi — "to'xtab qolgan" emas, "ishlayapti".
      <Clock aria-hidden className="size-4 animate-pulse" />
    ) : status === "READY" ? (
      <CheckCircle2 aria-hidden className="size-4" />
    ) : (
      <AlertCircle aria-hidden className="size-4" />
    );

  return (
    <Badge tone={STATUS_TONES[status]} icon={icon}>
      {t(status)}
    </Badge>
  );
}
