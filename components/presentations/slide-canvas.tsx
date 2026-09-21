import { cn } from "@/lib/ui/cn";
import { viewOf, type SlideBlock } from "@/lib/presentations/blocks";
import type { Slide } from "@/lib/validations/presentation";

/**
 * SLAYD TUVALI — slaydni ekranda `.pptx` dagidek chizadi.
 *
 * ── Nega bu komponent kerak bo'ldi ────────────────────────────────────────
 * Ko'rish rejimi slaydning atigi ikkita maydonini bilardi: `heading` va
 * `bullets`. Renderer esa o'n beshtasini chizardi. Ya'ni kartali,
 * bosqichli yoki diagrammali slayd EKRANDA BO'SH ko'rinar, yuklab
 * olingan faylda esa to'la chiqardi — o'qituvchi buni faqat faylni
 * ochgandan keyin bilardi.
 *
 * ── Yagona manba ──────────────────────────────────────────────────────────
 * "Bu slaydda nima chiziladi" degan qaror bu yerda QAYTA hisoblanmaydi —
 * u `lib/presentations/blocks.ts` dan (`viewOf`) keladi va o'sha modul
 * `.pptx` renderer mantiqini takrorlaydi. Ikkisi ajralib ketmasligini
 * `tests/preview-parity.test.ts` ikkala yo'nalishda tekshiradi.
 *
 * ── Nisbat 16:9 ───────────────────────────────────────────────────────────
 * Fayl bilan bir xil nisbat: bu yerda sig'magan matn faylda ham sig'maydi.
 */

export function SlideCanvas({ slide, className }: { slide: Slide; className?: string }) {
  const view = viewOf(slide);
  const isCover = view.layout === "cover";

  return (
    <div
      className={cn(
        "flex aspect-video w-full max-w-full flex-col overflow-hidden rounded-lg px-6 py-6 sm:px-10 sm:py-8",
        isCover
          ? "items-center justify-center text-center bg-primary text-on-primary"
          : "bg-surface text-neutral-900",
        className,
      )}
    >
      {view.showsHeading && (
        <h2
          className={cn(
            "text-balance",
            isCover
              ? "text-2xl font-semibold sm:text-4xl"
              : "shrink-0 text-lg font-semibold sm:text-2xl",
          )}
        >
          {view.heading}
        </h2>
      )}

      {!isCover && view.showsHeading && (
        <span aria-hidden className="mt-2 h-0.5 w-12 shrink-0 rounded bg-primary" />
      )}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-3",
          isCover ? "justify-center" : "mt-3 overflow-y-auto sm:mt-4",
        )}
      >
        {view.blocks.map((block, index) => (
          <BlockView key={index} block={block} isCover={isCover} />
        ))}
      </div>
    </div>
  );
}

function BlockView({ block, isCover }: { block: SlideBlock; isCover: boolean }) {
  switch (block.kind) {
    case "eyebrow":
      return (
        <p
          className={cn(
            "shrink-0 text-xs font-semibold tracking-widest uppercase",
            isCover ? "text-on-primary/70" : "text-neutral-500",
          )}
        >
          {block.text}
        </p>
      );

    case "keyMessage":
      return (
        <p
          className={cn(
            "text-balance",
            isCover
              ? "text-base sm:text-xl text-on-primary/90"
              : "text-lg leading-snug font-medium sm:text-2xl",
          )}
        >
          {block.text}
        </p>
      );

    case "bullets":
      return (
        <ul className="space-y-2 sm:space-y-3">
          {block.items.map((item, index) => (
            <li key={index} className="flex gap-3">
              <span
                aria-hidden
                className={cn(
                  "mt-2 size-1.5 shrink-0 rounded-full sm:mt-2.5 sm:size-2",
                  isCover ? "bg-on-primary" : "bg-primary",
                )}
              />
              <span className="text-sm leading-relaxed sm:text-lg">{item}</span>
            </li>
          ))}
        </ul>
      );

    case "cards":
      return (
        <div
          className={cn(
            "grid gap-2 sm:gap-3",
            block.items.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : "sm:grid-cols-3",
          )}
        >
          {block.items.map((card, index) => (
            <div
              key={index}
              className="rounded-md border border-neutral-200 bg-canvas p-3"
            >
              <span className="text-xs font-semibold text-primary tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-1 text-sm font-semibold sm:text-base">{card.title}</p>
              {card.body && (
                <p className="mt-1 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                  {card.body}
                </p>
              )}
            </div>
          ))}
        </div>
      );

    case "steps":
      return (
        <ol className="grid gap-2 sm:grid-cols-3 sm:gap-3">
          {block.items.map((step, index) => (
            <li key={index} className="flex gap-2 sm:flex-col sm:gap-1">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold sm:text-base">{step.label}</p>
                {/*
                  `timeline` maketi tavsiflarni CHIZMAYDI — bu dizayn
                  qarori va preview uni takrorlashi kerak, aks holda
                  ekranda ko'ringan matn faylda yo'q bo'lardi.
                */}
                {block.withBodies && step.body && (
                  <p className="mt-0.5 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                    {step.body}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      );

    case "comparison":
      return (
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
          {[block.left, block.right].map((column, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-md border border-neutral-200 bg-canvas"
            >
              <p
                className={cn(
                  "px-3 py-2 text-sm font-semibold sm:text-base",
                  index === 0 ? "text-primary" : "text-accent",
                )}
              >
                {column.title}
              </p>
              <ul className="space-y-1 px-3 pb-3">
                {column.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 size-1 shrink-0 rounded-full bg-neutral-400"
                    />
                    <span className="text-xs leading-relaxed sm:text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );

    case "statistic":
      return (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-4xl leading-none font-semibold tabular-nums sm:text-6xl">
            {block.value}
          </p>
          <p className="mt-2 text-sm text-neutral-600 sm:text-base">{block.caption}</p>
        </div>
      );

    case "chart":
      return <ChartView block={block} />;

    case "quote":
      return (
        <div className="flex flex-1 flex-col justify-center">
          <span aria-hidden className="text-5xl leading-none text-neutral-300">
            “
          </span>
          <p className="mt-1 text-base leading-snug italic sm:text-2xl">{block.text}</p>
          {block.author && (
            <p className="mt-3 text-xs text-neutral-500 sm:text-sm">— {block.author}</p>
          )}
        </div>
      );

    case "source":
      return (
        <p className="mt-auto shrink-0 pt-2 text-xs text-neutral-500 italic">
          Manba: {block.text}
        </p>
      );
  }
}

/**
 * Diagramma ko'rinishi.
 *
 * ── Nega ustunlar, haqiqiy diagramma emas ─────────────────────────────────
 * Faylda `pptxgenjs.addChart` haqiqiy, tahrirlanadigan diagramma obyektini
 * quradi. Uni brauzerda piksel-aniq takrorlash uchun grafik kutubxona
 * kerak bo'lardi — bu yangi bog'liqlik va yangi nosozlik nuqtasi.
 *
 * Shuning uchun bu yerda MA'LUMOTNING O'ZI rost ko'rsatiladi:
 * toifalar, qiymatlar va ularning nisbati. O'qituvchi raqamlar
 * to'g'riligini tekshira oladi; diagramma turi esa yorliqda aytiladi,
 * ya'ni ko'rgan narsasi soxta emas.
 */
function ChartView({ block }: { block: Extract<SlideBlock, { kind: "chart" }> }) {
  const max = Math.max(
    1,
    ...block.series.flatMap((series) => series.values.map((value) => Math.abs(value))),
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-500">
        {block.chartKind} · {block.series.map((series) => series.name).join(", ")}
      </p>
      <div className="space-y-1.5">
        {block.categories.map((category, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-xs text-neutral-600 sm:w-28 sm:text-sm">
              {category}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {block.series.map((series, seriesIndex) => {
                const value = series.values[index] ?? 0;
                return (
                  <div key={seriesIndex} className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2 rounded-sm bg-primary"
                      style={{
                        width: `${Math.max(2, (Math.abs(value) / max) * 100)}%`,
                      }}
                    />
                    <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
