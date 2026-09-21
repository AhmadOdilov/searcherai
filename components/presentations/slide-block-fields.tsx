"use client";

import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { viewOf, type SlideBlock } from "@/lib/presentations/blocks";
import { adaptLegacySlide } from "@/lib/presentations/legacy-adapter";
import type { Slide } from "@/lib/validations/presentation";

/**
 * V6 BLOKLARINING TAHRIR MAYDONLARI.
 *
 * ── Muammo ────────────────────────────────────────────────────────────────
 * Muharrir uchta maydonni tahrirlardi: sarlavha, bandlar, so'zlovchi
 * izohi. Slayd sxemasida esa o'n beshta maydon bor va renderer ularning
 * hammasini chizadi. Ya'ni AI yozgan kartani, bosqichni yoki iqtibosni
 * o'qituvchi TUZATA OLMASDI — faqat butun slaydni qaytadan yaratishi
 * mumkin edi.
 *
 * Ma'lumot yo'qolmasdi (forma `...slide` ni tarqatadi), lekin
 * ko'rinmasdi ham.
 *
 * ── Qaysi maydon ko'rsatiladi ─────────────────────────────────────────────
 * Ikkita shart:
 *   · maket uni CHIZADI (`viewOf` bloklari) — ya'ni o'qituvchi ekranda
 *     ko'rayotgan narsa tahrirlanadi;
 *   · yoki maydon YOZUVDA bor, lekin joriy maket uni chizmaydi — u ham
 *     ko'rsatiladi, lekin "bu maket uni chizmaydi" izohi bilan.
 *
 * Ikkinchi shart muhim: aks holda yozuvda yashirin matn qolib ketardi va
 * o'qituvchi maketni o'zgartirganda u kutilmaganda paydo bo'lardi.
 *
 * ── Chegaralar ────────────────────────────────────────────────────────────
 * `maxLength` qiymatlari `lib/validations/presentation.ts` bilan bir xil:
 * chegaradan oshgan matnni yozib, keyin saqlashda xato olishdan ko'ra
 * yozayotganda to'xtagan yaxshiroq.
 */

const LIMITS = {
  eyebrow: 40,
  keyMessage: 200,
  cardTitle: 60,
  cardBody: 160,
  stepLabel: 60,
  stepBody: 140,
  columnTitle: 60,
  columnItem: 120,
  statisticValue: 16,
  statisticCaption: 160,
  quoteText: 300,
  quoteAuthor: 80,
  source: 160,
} as const;

/**
 * Sxemadagi ro'yxat chegaralari.
 *
 * MINIMUMLAR ham bor va ular muhim: `cards` uchun 2, `steps` uchun 3.
 * Ulardan pastga tushgan ro'yxat sxemadan O'TMAYDI, ya'ni o'qituvchi
 * saqlay olmay qolardi va sababini tushunmasdi. Shuning uchun o'chirish
 * tugmasi minimumda o'chiriladi.
 */
const COUNTS = {
  cardsMin: 2,
  cardsMax: 4,
  stepsMin: 3,
  stepsMax: 6,
  columnItemsMin: 1,
  columnItemsMax: 5,
} as const;

export function SlideBlockFields({
  slide,
  index,
  onChange,
}: {
  slide: Slide;
  index: number;
  onChange: (next: Slide) => void;
}) {
  const t = useTranslations("presentations.editor");

  /*
    Qaysi maydon chizilishini IR aytadi: eski yozuv avval IR slaydiga
    aylantiriladi, keyin `viewOf` bloklarni beradi. Muharrirning o'zi
    hali eski `content` ni tahrirlaydi — IR saqlash qatlami alohida.
  */
  const rendered = new Set(
    viewOf(adaptLegacySlide(slide, index)).blocks.map((block) => block.kind),
  );

  /** Maydon ko'rsatiladimi: maket chizadi yoki yozuvda mavjud. */
  const shows = (kind: SlideBlock["kind"], present: boolean) =>
    rendered.has(kind) || present;
  /** Yozuvda bor, lekin chizilmaydi — o'qituvchiga aytiladi. */
  const hint = (kind: SlideBlock["kind"]) =>
    rendered.has(kind) ? undefined : t("notRendered");

  const sections = [
    shows("eyebrow", slide.eyebrow !== undefined),
    shows("keyMessage", slide.keyMessage !== undefined),
    slide.cards !== undefined,
    slide.steps !== undefined,
    slide.comparison !== undefined,
    slide.statistic !== undefined,
    slide.quote !== undefined,
    slide.chart !== undefined,
    shows("source", slide.source !== undefined),
  ];

  if (!sections.some(Boolean)) return null;

  return (
    <div className="space-y-6 rounded-md border border-neutral-200 bg-canvas p-4">
      <div>
        <span className="text-base font-medium text-neutral-800">{t("blocks")}</span>
        <p className="mt-1 text-sm text-neutral-500">{t("blocksHint")}</p>
      </div>

      {shows("eyebrow", slide.eyebrow !== undefined) && (
        <Field
          id={`slide-eyebrow-${index}`}
          label={t("eyebrow")}
          hint={hint("eyebrow")}
          value={slide.eyebrow ?? ""}
          max={LIMITS.eyebrow}
          onChange={(value) => onChange({ ...slide, eyebrow: blank(value) })}
        />
      )}

      {shows("keyMessage", slide.keyMessage !== undefined) && (
        <Field
          id={`slide-key-message-${index}`}
          label={t("keyMessage")}
          hint={hint("keyMessage")}
          value={slide.keyMessage ?? ""}
          max={LIMITS.keyMessage}
          rows={2}
          onChange={(value) => onChange({ ...slide, keyMessage: blank(value) })}
        />
      )}

      {slide.cards !== undefined && (
        <ListSection
          title={t("cards")}
          hint={hint("cards")}
          count={slide.cards.length}
          max={COUNTS.cardsMax}
          addLabel={t("addCard")}
          onAdd={() => onChange({ ...slide, cards: [...slide.cards!, { title: "" }] })}
        >
          {slide.cards.map((card, cardIndex) => (
            <Row
              key={cardIndex}
              deleteLabel={t("deleteCard")}
              canDelete={slide.cards!.length > COUNTS.cardsMin}
              onDelete={() =>
                onChange({
                  ...slide,
                  cards: slide.cards!.filter((_, i) => i !== cardIndex),
                })
              }
            >
              <Field
                id={`slide-card-title-${index}-${cardIndex}`}
                label={t("cardTitle")}
                value={card.title}
                max={LIMITS.cardTitle}
                onChange={(value) =>
                  onChange({
                    ...slide,
                    cards: replace(slide.cards!, cardIndex, { ...card, title: value }),
                  })
                }
              />
              <Field
                id={`slide-card-body-${index}-${cardIndex}`}
                label={t("cardBody")}
                value={card.body ?? ""}
                max={LIMITS.cardBody}
                rows={2}
                onChange={(value) =>
                  onChange({
                    ...slide,
                    cards: replace(slide.cards!, cardIndex, {
                      ...card,
                      body: blank(value),
                    }),
                  })
                }
              />
            </Row>
          ))}
        </ListSection>
      )}

      {slide.steps !== undefined && (
        <ListSection
          title={t("steps")}
          hint={hint("steps")}
          count={slide.steps.length}
          max={COUNTS.stepsMax}
          addLabel={t("addStep")}
          onAdd={() => onChange({ ...slide, steps: [...slide.steps!, { label: "" }] })}
        >
          {slide.steps.map((step, stepIndex) => (
            <Row
              key={stepIndex}
              deleteLabel={t("deleteStep")}
              canDelete={slide.steps!.length > COUNTS.stepsMin}
              onDelete={() =>
                onChange({
                  ...slide,
                  steps: slide.steps!.filter((_, i) => i !== stepIndex),
                })
              }
            >
              <Field
                id={`slide-step-label-${index}-${stepIndex}`}
                label={t("stepLabel")}
                value={step.label}
                max={LIMITS.stepLabel}
                onChange={(value) =>
                  onChange({
                    ...slide,
                    steps: replace(slide.steps!, stepIndex, { ...step, label: value }),
                  })
                }
              />
              <Field
                id={`slide-step-body-${index}-${stepIndex}`}
                label={t("stepBody")}
                value={step.body ?? ""}
                max={LIMITS.stepBody}
                rows={2}
                onChange={(value) =>
                  onChange({
                    ...slide,
                    steps: replace(slide.steps!, stepIndex, {
                      ...step,
                      body: blank(value),
                    }),
                  })
                }
              />
            </Row>
          ))}
        </ListSection>
      )}

      {slide.comparison !== undefined && (
        <div className="space-y-4">
          <SectionTitle title={t("comparisonLeft")} hint={hint("comparison")} />
          <ColumnEditor
            id={`slide-cmp-left-${index}`}
            title={slide.comparison.leftTitle}
            items={slide.comparison.leftItems}
            labels={{
              columnTitle: t("columnTitle"),
              addItem: t("addItem"),
              deleteItem: t("deleteItem"),
            }}
            onTitle={(value) =>
              onChange({
                ...slide,
                comparison: { ...slide.comparison!, leftTitle: value },
              })
            }
            onItems={(items) =>
              onChange({
                ...slide,
                comparison: { ...slide.comparison!, leftItems: items },
              })
            }
          />

          <SectionTitle title={t("comparisonRight")} />
          <ColumnEditor
            id={`slide-cmp-right-${index}`}
            title={slide.comparison.rightTitle}
            items={slide.comparison.rightItems}
            labels={{
              columnTitle: t("columnTitle"),
              addItem: t("addItem"),
              deleteItem: t("deleteItem"),
            }}
            onTitle={(value) =>
              onChange({
                ...slide,
                comparison: { ...slide.comparison!, rightTitle: value },
              })
            }
            onItems={(items) =>
              onChange({
                ...slide,
                comparison: { ...slide.comparison!, rightItems: items },
              })
            }
          />
        </div>
      )}

      {slide.statistic !== undefined && (
        <div className="space-y-3">
          <SectionTitle title={t("statisticValue")} hint={hint("statistic")} />
          <Field
            id={`slide-stat-value-${index}`}
            label={t("statisticValue")}
            value={slide.statistic.value}
            max={LIMITS.statisticValue}
            onChange={(value) =>
              onChange({ ...slide, statistic: { ...slide.statistic!, value } })
            }
          />
          <Field
            id={`slide-stat-caption-${index}`}
            label={t("statisticCaption")}
            value={slide.statistic.caption}
            max={LIMITS.statisticCaption}
            rows={2}
            onChange={(caption) =>
              onChange({ ...slide, statistic: { ...slide.statistic!, caption } })
            }
          />
        </div>
      )}

      {slide.quote !== undefined && (
        <div className="space-y-3">
          <SectionTitle title={t("quoteText")} hint={hint("quote")} />
          <Field
            id={`slide-quote-text-${index}`}
            label={t("quoteText")}
            value={slide.quote.text}
            max={LIMITS.quoteText}
            rows={3}
            onChange={(text) => onChange({ ...slide, quote: { ...slide.quote!, text } })}
          />
          <Field
            id={`slide-quote-author-${index}`}
            label={t("quoteAuthor")}
            value={slide.quote.author ?? ""}
            max={LIMITS.quoteAuthor}
            onChange={(value) =>
              onChange({ ...slide, quote: { ...slide.quote!, author: blank(value) } })
            }
          />
        </div>
      )}

      {slide.chart !== undefined && (
        /*
          Diagramma ma'lumoti sonli jadval — uni tahrirlash alohida UI
          talab qiladi va bu bosqichdagi ishdan katta. Hozircha ochiq
          aytiladi: o'qituvchi "nega tahrirlay olmayapman" deb izlamasin.
        */
        <p className="rounded-md border border-dashed border-neutral-300 px-3 py-3 text-sm text-neutral-600">
          {t("chartReadOnly")}
        </p>
      )}

      {shows("source", slide.source !== undefined) && (
        <Field
          id={`slide-source-${index}`}
          label={t("source")}
          hint={hint("source")}
          value={slide.source ?? ""}
          max={LIMITS.source}
          onChange={(value) => onChange({ ...slide, source: blank(value) })}
        />
      )}
    </div>
  );
}

/**
 * Bo'sh matnni `undefined` ga aylantiradi.
 *
 * Sxemada bu maydonlar ixtiyoriy va bo'sh satr `min(1)` tekshiruvidan
 * o'tmasdi — ya'ni maydonni tozalash saqlashni yiqitardi.
 */
function blank(value: string): string | undefined {
  return value.trim() === "" ? undefined : value;
}

function replace<T>(items: T[], at: number, next: T): T[] {
  const copy = [...items];
  copy[at] = next;
  return copy;
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-base font-medium text-neutral-800">{title}</span>
      {hint && <span className="text-sm text-neutral-500">· {hint}</span>}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  max,
  rows = 1,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  max: number;
  rows?: number;
  onChange: (value: string) => void;
}) {
  const near = value.length > max * 0.9;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 flex flex-wrap items-baseline gap-2 text-sm font-medium text-neutral-700"
      >
        {label}
        {hint && <span className="font-normal text-neutral-500">· {hint}</span>}
      </label>
      <textarea
        id={id}
        value={value}
        maxLength={max}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-md border border-neutral-300 bg-surface px-3 py-2 text-base text-neutral-900 transition-colors focus:border-primary"
      />
      <p
        className={cn(
          "mt-1 text-right text-xs tabular-nums",
          near ? "text-accent-ink" : "text-neutral-400",
        )}
      >
        {value.length} / {max}
      </p>
    </div>
  );
}

function ListSection({
  title,
  hint,
  count,
  max,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  hint?: string;
  count: number;
  max: number;
  addLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <SectionTitle title={title} hint={hint} />
        <span className="shrink-0 text-sm text-neutral-500 tabular-nums">
          {count} / {max}
        </span>
      </div>
      <div className="space-y-3">{children}</div>
      <button
        type="button"
        onClick={onAdd}
        disabled={count >= max}
        className="mt-2 flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-primary transition-colors hover:bg-primary-soft disabled:pointer-events-none disabled:opacity-50"
      >
        <Plus aria-hidden className="size-5" />
        {addLabel}
      </button>
    </div>
  );
}

function Row({
  deleteLabel,
  onDelete,
  canDelete = true,
  children,
}: {
  deleteLabel: string;
  onDelete: () => void;
  /** Sxemadagi minimumga yetganda o'chirish to'siladi. */
  canDelete?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-neutral-200 bg-surface p-3">
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
      <button
        type="button"
        onClick={onDelete}
        disabled={!canDelete}
        aria-label={deleteLabel}
        title={deleteLabel}
        className="flex size-8 shrink-0 items-center justify-center rounded text-danger transition-colors hover:bg-danger-soft disabled:pointer-events-none disabled:opacity-35"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}

function ColumnEditor({
  id,
  title,
  items,
  labels,
  onTitle,
  onItems,
}: {
  id: string;
  title: string;
  items: string[];
  labels: { columnTitle: string; addItem: string; deleteItem: string };
  onTitle: (value: string) => void;
  onItems: (items: string[]) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-neutral-200 bg-surface p-3">
      <Field
        id={`${id}-title`}
        label={labels.columnTitle}
        value={title}
        max={LIMITS.columnTitle}
        onChange={onTitle}
      />

      {items.map((item, itemIndex) => (
        <div key={itemIndex} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Field
              id={`${id}-item-${itemIndex}`}
              label={`${itemIndex + 1}`}
              value={item}
              max={LIMITS.columnItem}
              onChange={(value) => onItems(replace(items, itemIndex, value))}
            />
          </div>
          <button
            type="button"
            onClick={() => onItems(items.filter((_, i) => i !== itemIndex))}
            aria-label={labels.deleteItem}
            title={labels.deleteItem}
            disabled={items.length <= COUNTS.columnItemsMin}
            className="mt-6 flex size-8 shrink-0 items-center justify-center rounded text-danger transition-colors hover:bg-danger-soft disabled:pointer-events-none disabled:opacity-35"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onItems([...items, ""])}
        disabled={items.length >= COUNTS.columnItemsMax}
        className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-primary transition-colors hover:bg-primary-soft disabled:pointer-events-none disabled:opacity-50"
      >
        <Plus aria-hidden className="size-5" />
        {labels.addItem}
      </button>
    </div>
  );
}
