"use client";

import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { SlideBlockFields } from "@/components/presentations/slide-block-fields";
import {
  slideTypeSchema,
  type Slide,
  type SlideType,
} from "@/lib/validations/presentation";

/**
 * Bitta slaydning tahrir formasi.
 *
 * ── Nega "canvas" emas, forma ─────────────────────────────────────────────
 * Slaydni sudrab-surib joylash muharriri (PowerPoint kabi) telefonda
 * ishlamaydi va uni qurish bu bosqichdagi ishdan bir necha barobar
 * katta. Bizning slayd esa allaqachon STRUKTURA: sarlavha + bandlar +
 * so'zlovchi izohi. Shu tuzilmani tahrirlash — telefonda ham, klaviatura
 * bilan ham ishlaydigan yagona to'g'ri yo'l.
 *
 * ── Chegaralar UI'da ham ko'rsatiladi ─────────────────────────────────────
 * Sxemadagi chegaralar (sarlavha 120 belgi, band 220) `maxLength` bilan
 * takrorlangan: foydalanuvchi chegaradan oshgan matnni yozib, keyin
 * saqlashda xato olishdan ko'ra, yozayotganda to'xtagani yaxshiroq.
 * Server tekshiruvi baribir joyida qoladi — bu faqat qulaylik.
 */

/** Sarlavha uzunligi — `slideSchema` dagi chegara bilan bir xil. */
const HEADING_MAX = 120;
const BULLET_MAX = 220;
const NOTES_MAX = 1500;
const BULLETS_MAX = 8;

export function SlideForm({
  slide,
  index,
  total,
  onChange,
}: {
  slide: Slide;
  index: number;
  total: number;
  onChange: (next: Slide) => void;
}) {
  const t = useTranslations("presentations.editor");
  const tTypes = useTranslations("presentations.detail.slideTypes");

  function setBullets(bullets: string[]) {
    onChange({ ...slide, bullets });
  }

  function moveBullet(at: number, direction: -1 | 1) {
    const target = at + direction;
    if (target < 0 || target >= slide.bullets.length) return;

    const next = [...slide.bullets];
    [next[at], next[target]] = [next[target], next[at]];
    setBullets(next);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
        {t("slideOf", { current: index + 1, total })}
      </p>

      {/* ── Slayd turi ──────────────────────────────────────────────── */}
      <div>
        <span className="mb-2 block text-base font-medium text-neutral-800">
          {t("slideType")}
        </span>
        {/*
          Uchta tur — radio tugmalar, dropdown emas: hammasi bir qarashda
          ko'rinadi va bitta bosishda tanlanadi. Dropdown ikki bosish
          talab qilardi.
        */}
        <div
          role="radiogroup"
          aria-label={t("slideType")}
          className="flex flex-wrap gap-2"
        >
          {slideTypeSchema.options.map((type: SlideType) => {
            const selected = slide.type === type;
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ ...slide, type })}
                className={cn(
                  "min-h-11 rounded-md border px-4 py-2 text-base font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary text-on-primary"
                    : "border-neutral-300 bg-surface text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50",
                )}
              >
                {tTypes(type)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Sarlavha ────────────────────────────────────────────────── */}
      <div>
        <label
          htmlFor={`slide-heading-${index}`}
          className="mb-2 block text-base font-medium text-neutral-800"
        >
          {t("heading")}
        </label>
        <textarea
          id={`slide-heading-${index}`}
          value={slide.heading}
          maxLength={HEADING_MAX}
          rows={2}
          onChange={(event) => onChange({ ...slide, heading: event.target.value })}
          className="w-full resize-y rounded-md border border-neutral-300 bg-surface px-3 py-2 text-base text-neutral-900 transition-colors focus:border-primary"
        />
        <CharCount value={slide.heading.length} max={HEADING_MAX} />
      </div>

      {/* ── Bandlar ─────────────────────────────────────────────────── */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-base font-medium text-neutral-800">{t("bullets")}</span>
          <span className="text-sm text-neutral-500">
            {slide.bullets.length} / {BULLETS_MAX}
          </span>
        </div>

        {slide.bullets.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-300 px-3 py-4 text-center text-base text-neutral-500">
            {t("noBullets")}
          </p>
        ) : (
          <ul className="space-y-2">
            {slide.bullets.map((bullet, bulletIndex) => (
              <li key={bulletIndex} className="flex items-start gap-2">
                <textarea
                  value={bullet}
                  maxLength={BULLET_MAX}
                  rows={2}
                  aria-label={t("bulletNumber", { number: bulletIndex + 1 })}
                  onChange={(event) => {
                    const next = [...slide.bullets];
                    next[bulletIndex] = event.target.value;
                    setBullets(next);
                  }}
                  className="min-w-0 flex-1 resize-y rounded-md border border-neutral-300 bg-surface px-3 py-2 text-base text-neutral-900 transition-colors focus:border-primary"
                />
                {/*
                  Tugmalar tik ustunda — telefonda matn maydoni iloji
                  boricha keng qolsin.
                */}
                <div className="flex shrink-0 flex-col">
                  <BulletAction
                    label={t("moveBulletUp")}
                    disabled={bulletIndex === 0}
                    onClick={() => moveBullet(bulletIndex, -1)}
                  >
                    <ChevronUp aria-hidden className="size-4" />
                  </BulletAction>
                  <BulletAction
                    label={t("moveBulletDown")}
                    disabled={bulletIndex === slide.bullets.length - 1}
                    onClick={() => moveBullet(bulletIndex, 1)}
                  >
                    <ChevronDown aria-hidden className="size-4" />
                  </BulletAction>
                  <BulletAction
                    label={t("deleteBullet")}
                    tone="danger"
                    onClick={() =>
                      setBullets(slide.bullets.filter((_, i) => i !== bulletIndex))
                    }
                  >
                    <X aria-hidden className="size-4" />
                  </BulletAction>
                </div>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setBullets([...slide.bullets, ""])}
          // Sxemada bitta slaydda 8 tadan ko'p band bo'lmaydi.
          disabled={slide.bullets.length >= BULLETS_MAX}
          className="mt-2 flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-primary transition-colors hover:bg-primary-soft disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus aria-hidden className="size-5" />
          {t("addBullet")}
        </button>
      </div>

      {/*
        ── V6 bloklari ──────────────────────────────────────────────
        Kartalar, bosqichlar, taqqoslash, statistika, iqtibos, yorliq,
        asosiy fikr va manba. Ilgari bu maydonlar yozuvda bor edi,
        renderer ularni chizardi, lekin muharrirda KO'RINMASDI — ya'ni
        AI yozgan kartani tuzatishning yagona yo'li butun slaydni
        qaytadan yaratish edi.
      */}
      <SlideBlockFields slide={slide} index={index} onChange={onChange} />

      {/* ── So'zlovchi izohi ────────────────────────────────────────── */}
      <div>
        <label
          htmlFor={`slide-notes-${index}`}
          className="mb-2 block text-base font-medium text-neutral-800"
        >
          {t("speakerNotes")}
        </label>
        <p className="mb-2 text-sm text-neutral-500">{t("speakerNotesHint")}</p>
        <textarea
          id={`slide-notes-${index}`}
          value={slide.speakerNotes ?? ""}
          maxLength={NOTES_MAX}
          rows={3}
          onChange={(event) => {
            const value = event.target.value;
            /*
              Bo'sh matn `undefined` ga aylantiriladi: sxemada bu maydon
              ixtiyoriy va bo'sh satr `min(1)` tekshiruvidan o'tmasdi.
            */
            onChange({ ...slide, speakerNotes: value.trim() === "" ? undefined : value });
          }}
          className="w-full resize-y rounded-md border border-neutral-300 bg-surface px-3 py-2 text-base text-neutral-900 transition-colors focus:border-primary"
        />
      </div>
    </div>
  );
}

/** Chegaraga yaqinlashganda ogohlantiradi — oldindan, saqlashdan keyin emas. */
function CharCount({ value, max }: { value: number; max: number }) {
  const near = value > max * 0.9;

  return (
    <p
      className={cn(
        "mt-1 text-right text-sm tabular-nums",
        near ? "text-accent-ink" : "text-neutral-400",
      )}
    >
      {value} / {max}
    </p>
  );
}

function BulletAction({
  label,
  onClick,
  disabled = false,
  tone = "neutral",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded transition-colors",
        "disabled:pointer-events-none disabled:opacity-35",
        tone === "danger"
          ? "text-danger hover:bg-danger-soft"
          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
      )}
    >
      {children}
    </button>
  );
}
