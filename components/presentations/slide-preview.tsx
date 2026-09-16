"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import type { PresentationContent } from "@/lib/validations/presentation";

/**
 * Slaydlarni ko'rish rejimi — to'liq ekran.
 *
 * ── Nega muharrirdan ALOHIDA ──────────────────────────────────────────────
 * Tahrirlash va ko'rish — ikki xil ish. Tahrirlashda maydonlar, tugmalar
 * va chegaralar kerak; ko'rishda esa AYNAN aksincha: o'qituvchi slayd
 * darsda qanday ko'rinishini bilmoqchi va bunga hech narsa xalaqit
 * bermasligi kerak. Shuning uchun bu yerda birorta tahrir tugmasi yo'q.
 *
 * ── Nega brauzerning `requestFullscreen()` ishlatilmadi ───────────────────
 * Haqiqiy to'liq ekran rejimi telefonlarda turlicha ishlaydi va iOS
 * Safari uni umuman bermaydi. Sahifa ustidagi qoplama (overlay) esa
 * hamma joyda bir xil: ekranni to'ldiradi, tizim tugmalari joyida
 * qoladi va ESC bilan yopiladi.
 *
 * ── Yashirilgan slaydlar ko'rsatilmaydi ───────────────────────────────────
 * Ko'rish rejimi .pptx faylda NIMA bo'lishini ko'rsatadi. Yashirilgan
 * slayd faylga tushmaydi, demak bu yerda ham bo'lmasligi kerak — aks
 * holda ko'rgan narsa yuklab olingan fayldan farq qilardi.
 */
export function SlidePreview({
  content,
  startIndex = 0,
  onClose,
}: {
  content: PresentationContent;
  startIndex?: number;
  onClose: () => void;
}) {
  const t = useTranslations("presentations.editor");

  const visible = content.slides.filter((slide) => slide.hidden !== true);
  const total = visible.length;

  const [index, setIndex] = useState(() =>
    Math.min(Math.max(startIndex, 0), Math.max(total - 1, 0)),
  );

  const go = useCallback(
    (direction: -1 | 1) => {
      setIndex((current) => {
        const next = current + direction;
        // Chetlarda to'xtaydi, aylanmaydi: "oxiriga yetdim" hissi
        // yo'qolmasin.
        if (next < 0 || next >= total) return current;
        return next;
      });
    },
    [total],
  );

  /*
    ── Klaviatura ───────────────────────────────────────────────────────
    Strelkalar, bo'shliq va ESC — taqdimot dasturlarida qabul qilingan
    tugmalar. O'qituvchi ularni allaqachon biladi.
  */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      switch (event.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          event.preventDefault();
          go(1);
          break;
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          go(-1);
          break;
        case "Escape":
          event.preventDefault();
          onClose();
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go, onClose]);

  /*
    Qoplama ochilganda sahifa orqada SURILMASIN — telefonda bu eng
    ko'p uchraydigan bezovtalik.
  */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  /* Ochilganda fokus qoplamaga o'tadi — klaviatura darhol ishlasin. */
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  /* ── Telefonda barmoq bilan surish ──────────────────────────────── */
  const touchStartX = useRef<number | null>(null);

  function onTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null) return;

    const delta = (event.changedTouches[0]?.clientX ?? start) - start;
    // 50px — tasodifiy tegishni haqiqiy surishdan ajratadigan chegara.
    if (Math.abs(delta) < 50) return;
    go(delta < 0 ? 1 : -1);
  }

  if (total === 0) {
    return (
      <Overlay onClose={onClose} label={t("preview")} panelRef={panelRef}>
        <p className="text-center text-lg text-neutral-100">{t("previewEmpty")}</p>
      </Overlay>
    );
  }

  const slide = visible[index];

  return (
    <Overlay
      onClose={onClose}
      label={t("preview")}
      panelRef={panelRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/*
        Slayd maydoni 16:9 — .pptx bilan bir xil nisbat, ya'ni bu yerda
        sig'gan matn faylda ham sig'adi.
      */}
      <div className="flex w-full max-w-4xl flex-col">
        <div
          className={cn(
            "flex aspect-video w-full max-w-full flex-col justify-center rounded-lg px-6 py-8 sm:px-12",
            slide.type === "title"
              ? "bg-primary text-on-primary"
              : "bg-surface text-neutral-900",
          )}
        >
          <h2
            className={cn(
              "text-balance",
              slide.type === "title"
                ? "text-2xl font-semibold sm:text-4xl"
                : "text-xl font-semibold sm:text-3xl",
            )}
          >
            {slide.heading}
          </h2>

          {slide.bullets.length > 0 && (
            <ul className="mt-4 space-y-2 overflow-y-auto sm:mt-6 sm:space-y-3">
              {slide.bullets.map((bullet, bulletIndex) => (
                <li key={bulletIndex} className="flex gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-2 size-1.5 shrink-0 rounded-full sm:mt-3 sm:size-2",
                      slide.type === "title" ? "bg-on-primary" : "bg-primary",
                    )}
                  />
                  <span className="text-base leading-relaxed sm:text-xl">{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Boshqaruv ────────────────────────────────────────────── */}
        <div className="mt-4 flex items-center justify-center gap-4">
          <NavButton label={t("previous")} disabled={index === 0} onClick={() => go(-1)}>
            <ChevronLeft aria-hidden className="size-6" />
          </NavButton>

          <p
            aria-live="polite"
            className="min-w-20 text-center font-mono text-base text-neutral-200 tabular-nums"
          >
            {t("slideOf", { current: index + 1, total })}
          </p>

          <NavButton
            label={t("next")}
            disabled={index === total - 1}
            onClick={() => go(1)}
          >
            <ChevronRight aria-hidden className="size-6" />
          </NavButton>
        </div>

        {slide.speakerNotes !== undefined && (
          <p className="mt-4 max-h-24 overflow-y-auto rounded-md bg-neutral-900/60 px-4 py-3 text-base leading-relaxed text-neutral-200">
            <span className="font-medium">{t("speakerNotes")}: </span>
            {slide.speakerNotes}
          </p>
        )}
      </div>
    </Overlay>
  );
}

/** Qora qoplama — barcha holatlar uchun umumiy qobiq. */
function Overlay({
  children,
  onClose,
  label,
  panelRef,
  onTouchStart,
  onTouchEnd,
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
  panelRef: React.RefObject<HTMLDivElement | null>;
  onTouchStart?: (event: React.TouchEvent) => void;
  onTouchEnd?: (event: React.TouchEvent) => void;
}) {
  const t = useTranslations("presentations.editor");

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-neutral-900/95 p-4 outline-none"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("closePreview")}
        title={t("closePreview")}
        className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-md text-neutral-300 transition-colors hover:bg-neutral-100/10 hover:text-neutral-100"
      >
        <X aria-hidden className="size-6" />
      </button>

      {children}
    </div>
  );
}

function NavButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-12 items-center justify-center rounded-md text-neutral-200 transition-colors hover:bg-neutral-100/10 hover:text-neutral-50 disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
