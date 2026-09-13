import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

/**
 * Tugma — ilovadagi YAGONA tugma ko'rinishi.
 *
 * ── Nega umumiy komponent ─────────────────────────────────────────────────
 * Ilgari har sahifada `rounded-lg bg-slate-900 px-4 py-2 text-sm ...`
 * qo'lda yozilgan edi. Natijada tugmalar bir-biridan bir necha piksel
 * farq qilardi va rangni o'zgartirish 12 ta faylni tahrirlashni talab
 * qilardi. Endi ko'rinish shu yerda, sahifalarda faqat `variant`/`size`.
 *
 * ── Balandlik kamida 44px ─────────────────────────────────────────────────
 * Telefonda barmoq bilan aniq tegish uchun eng kichik o'lcham 44×44px
 * (Apple va WCAG tavsiyasi). Shuning uchun UCHALA o'lcham ham `min-h-11`:
 * `sm` faqat ichki bo'shliq va shrift bilan farq qiladi, balandlik bilan
 * emas. Aks holda "kichik" tugma telefonda tegib bo'lmaydigan bo'lardi.
 */

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary shadow-card hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "border border-neutral-300 bg-surface text-neutral-800 hover:bg-neutral-100 hover:border-neutral-400",
  danger: "bg-danger text-on-danger shadow-card hover:bg-danger-hover",
  ghost: "text-neutral-700 hover:bg-neutral-100",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 py-2 text-sm gap-2",
  md: "min-h-11 px-4 py-2 text-base gap-2",
  lg: "min-h-14 px-6 py-4 text-lg gap-3",
};

function buttonClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean,
  className?: string,
): string {
  return cn(
    // Mikro-harakat: bosilganda tugma sal kichrayadi. Bu "bosildi" degan
    // fizik tasdiq — sekin internetda javob kutayotgan foydalanuvchi
    // tugmani qayta-qayta bosmaydi.
    "inline-flex items-center justify-center rounded-md font-medium transition-all duration-150",
    "active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-55",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth && "w-full",
    className,
  );
}

export interface ButtonProps extends Omit<ComponentProps<"button">, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Yuklanish holati: aylanuvchi belgi + o'chirilgan tugma. */
  loading?: boolean;
  /** Chap tomondagi belgi (lucide-react). */
  icon?: ReactNode;
  className?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled === true || loading}
      // Skrinrider "hozir band" ekanini bilsin.
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, fullWidth, className)}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

/**
 * Tugma ko'rinishidagi havola.
 *
 * Ko'rinishi `Button` bilan bir xil, lekin bu HAVOLA: o'ng tugma bilan
 * "yangi oynada ochish" ishlaydi, brauzer uni sahifa o'tishi deb biladi.
 * Sahifaga o'tadigan joyda `<button onClick={router.push}>` emas, AYNAN
 * shu ishlatilishi kerak.
 */
export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  icon,
  className,
  children,
  ...rest
}: Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      {...rest}
      href={href}
      className={buttonClasses(variant, size, fullWidth, className)}
    >
      {icon}
      {children}
    </Link>
  );
}

/** Tugma ichidagi aylanuvchi belgi. */
function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current"
    />
  );
}
