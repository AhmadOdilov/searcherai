"use client";

import { useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import type { Slide } from "@/lib/validations/presentation";

/**
 * Slaydlar ro'yxati — muharrirning navigatsiyasi.
 *
 * ── Nega kichik rasm (thumbnail) EMAS, matnli qator ───────────────────────
 * Haqiqiy kichik rasm slaydni brauzerda qayta chizishni talab qiladi
 * (canvas yoki rasm generatsiyasi) — bu katta ish va sekin internetda
 * foyda bermaydi. Bu yerda esa slaydning O'ZI matndan iborat: raqam,
 * sarlavha va turi allaqachon uning butun mazmuni. Ular telefonda ham
 * o'qiladi, rasm esa o'qilmasdi.
 *
 * ── Nega drag & drop YO'Q ─────────────────────────────────────────────────
 * Sudrab tashlash sichqoncha bilan qulay, lekin telefonda aniq emas va
 * klaviatura bilan umuman ishlamaydi. Yuqori/quyi tugmalari esa uchala
 * usulda ham bir xil ishlaydi va nima bo'layotgani ko'rinib turadi.
 */
export function SlideList({
  slides,
  activeIndex,
  onSelect,
  onAdd,
  onMove,
  onDuplicate,
  onToggleHidden,
  onRequestDelete,
}: {
  slides: Slide[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onDuplicate: (index: number) => void;
  onToggleHidden: (index: number) => void;
  onRequestDelete: (index: number) => void;
}) {
  const t = useTranslations("presentations.editor");
  // Slayd turlarining nomi allaqachon tafsilot sahifasida bor — takrorlamaymiz.
  const tTypes = useTranslations("presentations.detail.slideTypes");

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">{t("slides")}</h2>
        <span className="text-sm text-neutral-500">{slides.length}</span>
      </div>

      <ol className="mt-3 space-y-2">
        {slides.map((slide, index) => {
          const active = index === activeIndex;
          const hidden = slide.hidden === true;

          return (
            <li key={index}>
              <div
                className={cn(
                  "rounded-md border transition-colors",
                  active
                    ? "border-primary bg-primary-soft"
                    : "border-neutral-200 bg-surface hover:border-neutral-300",
                )}
              >
                {/*
                  Butun qator bosiladigan tugma — telefonda kichik
                  nishonga tegishdan ko'ra ancha oson.
                */}
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  aria-current={active ? "true" : undefined}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
                >
                  <span
                    className={cn(
                      "mt-0.5 w-5 shrink-0 text-right font-mono text-sm tabular-nums",
                      active ? "text-primary-ink" : "text-neutral-400",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-base font-medium",
                        hidden ? "text-neutral-400 line-through" : "text-neutral-900",
                      )}
                    >
                      {slide.heading || t("untitledSlide")}
                    </span>
                    <span className="mt-0.5 block text-sm text-neutral-500">
                      {tTypes(slide.type)}
                      {hidden && ` · ${t("hidden")}`}
                    </span>
                  </span>
                </button>

                {/*
                  Amallar FAQAT tanlangan slaydda ko'rinadi.

                  Hammasida ko'rsatsak, 20 slaydli ro'yxatda 120 ta tugma
                  bo'lardi — telefonda ular bir-biriga tegib ketadi va
                  ro'yxat o'qilmay qoladi.
                */}
                {active && (
                  <div className="flex flex-wrap gap-1 border-t border-primary-border px-2 py-1.5">
                    <IconAction
                      icon={ChevronUp}
                      label={t("moveUp")}
                      disabled={index === 0}
                      onClick={() => onMove(index, -1)}
                    />
                    <IconAction
                      icon={ChevronDown}
                      label={t("moveDown")}
                      disabled={index === slides.length - 1}
                      onClick={() => onMove(index, 1)}
                    />
                    <IconAction
                      icon={Copy}
                      label={t("duplicate")}
                      onClick={() => onDuplicate(index)}
                    />
                    <IconAction
                      icon={hidden ? Eye : EyeOff}
                      label={hidden ? t("show") : t("hide")}
                      onClick={() => onToggleHidden(index)}
                    />
                    <IconAction
                      icon={Trash2}
                      label={t("deleteSlide")}
                      tone="danger"
                      // Oxirgi slaydni o'chirib bo'lmaydi: slaydsiz
                      // prezentatsiya yaroqsiz fayl beradi.
                      disabled={slides.length === 1}
                      onClick={() => onRequestDelete(index)}
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={onAdd}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 px-3 py-2 text-base font-medium text-neutral-700 transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-ink"
      >
        <Plus aria-hidden className="size-5" />
        {t("addSlide")}
      </button>
    </div>
  );
}

/**
 * Belgili tugma.
 *
 * Belgi YOLG'IZ ko'rinadi, lekin `aria-label` va `title` bor: skrinrider
 * uni o'qiydi, sichqoncha ustiga kelganda esa matn chiqadi. Belgisiz
 * tugma — eng ko'p uchraydigan mavjudlik xatosi.
 */
function IconAction({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        // 44px — barmoq bilan tegish uchun eng kichik o'lcham.
        "flex size-11 items-center justify-center rounded-md transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
        tone === "danger"
          ? "text-danger hover:bg-danger-soft"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
      )}
    >
      <Icon aria-hidden className="size-5" />
    </button>
  );
}
