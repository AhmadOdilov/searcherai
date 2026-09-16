"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { useEditorDraft } from "@/lib/hooks/use-editor-draft";
import { SaveBar } from "@/components/editor/save-bar";
import { Button } from "@/components/ui/button";
import { Card, ToneCard } from "@/components/ui/card";
import { cn } from "@/lib/ui/cn";
import {
  totalHours,
  totalRowCount,
  type CalendarPlanContent,
  type CalendarTopic,
  type CalendarWeek,
} from "@/lib/validations/calendar-plan";

/**
 * Kalendar-tematik reja muharriri.
 *
 * ── Nega katakcha jadvali (spreadsheet) EMAS ──────────────────────────────
 * Excel'ning katakcha muharriri — formula dvigateli, tanlov diapazoni,
 * nusxa-joylash mantig'i. Bu bosqichdagi ishdan bir necha barobar katta
 * va telefonda deyarli foydasiz.
 *
 * Bizning reja esa allaqachon STRUKTURA: hafta → mavzular → (nom, soat,
 * izoh). Shu tuzilmani tahrirlash o'qituvchiga aynan kerak bo'lgan
 * narsani beradi — mavzu nomini tuzatish, soatni o'zgartirish, qator
 * qo'shish yoki o'chirish.
 *
 * ── Soat yig'indisi FAQAT ko'rsatiladi ────────────────────────────────────
 * Bu yerdagi hisob — qulaylik: o'qituvchi taqsimot to'g'rimi deb bir
 * qarashda ko'radi. Fayldagi «Jami» qatori esa Excel'ning O'Z SUM
 * formulasi bilan yasaladi (`lib/xlsx/generate.ts`), ya'ni bu son
 * serverga umuman yuborilmaydi va unga ishonilmaydi.
 */
export function CalendarEditor({
  planId,
  initialContent,
  detailHref,
  hoursPerWeek,
}: {
  planId: string;
  initialContent: CalendarPlanContent;
  detailHref: string;
  /** Rejadagi haftalik soat — taqsimotni solishtirish uchun. */
  hoursPerWeek: number;
}) {
  const t = useTranslations("calendarPlans.editor");
  const tEditor = useTranslations("editor");
  const router = useRouter();

  const { draft, update, dirty, status, error, save, discard } =
    useEditorDraft<CalendarPlanContent>({
      endpoint: `/api/calendar-plans/${planId}`,
      initial: initialContent,
    });

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  function setWeeks(weeks: CalendarWeek[]) {
    update((current) => ({ ...current, weeks }));
  }

  function updateWeek(index: number, next: CalendarWeek) {
    const weeks = [...draft.weeks];
    weeks[index] = next;
    setWeeks(weeks);
  }

  function addTopic(weekIndex: number) {
    const week = draft.weeks[weekIndex];
    const blank: CalendarTopic = { name: "", hours: 1 };
    updateWeek(weekIndex, { ...week, topics: [...week.topics, blank] });
  }

  function deleteTopic(weekIndex: number, topicIndex: number) {
    const week = draft.weeks[weekIndex];
    updateWeek(weekIndex, {
      ...week,
      topics: week.topics.filter((_, i) => i !== topicIndex),
    });
    setPendingDelete(null);
  }

  function moveTopic(weekIndex: number, topicIndex: number, direction: -1 | 1) {
    const week = draft.weeks[weekIndex];
    const target = topicIndex + direction;
    if (target < 0 || target >= week.topics.length) return;

    const topics = [...week.topics];
    [topics[topicIndex], topics[target]] = [topics[target], topics[topicIndex]];
    updateWeek(weekIndex, { ...week, topics });
  }

  function addWeek() {
    const last = draft.weeks.at(-1);
    const weekNumber = Math.min((last?.weekNumber ?? 0) + 1, 24);

    setWeeks([
      ...draft.weeks,
      {
        weekNumber,
        // Sana oralig'i erkin matn — o'qituvchi o'zi yozadi.
        dateRange: "—",
        topics: [{ name: "", hours: 1 }],
      },
    ]);
  }

  function deleteWeek(index: number) {
    setWeeks(draft.weeks.filter((_, i) => i !== index));
    setPendingDelete(null);
  }

  function handleLeave() {
    if (dirty) {
      setLeaveConfirm(true);
      return;
    }
    router.push(detailHref);
  }

  const hours = totalHours(draft);
  const rows = totalRowCount(draft);
  const expectedHours = draft.weeks.length * hoursPerWeek;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <button
        type="button"
        onClick={handleLeave}
        className="-ml-3 inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-base text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
      >
        <ArrowLeft aria-hidden className="size-5 shrink-0" />
        {t("backToPlan")}
      </button>

      {leaveConfirm && (
        <ToneCard tone="accent" padding="sm" className="mt-4" role="alert">
          <p className="text-base leading-relaxed text-accent-ink">
            {tEditor("unsaved.body")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={status === "saving"}
              onClick={async () => {
                if (await save()) router.push(detailHref);
              }}
            >
              {tEditor("unsaved.saveAndLeave")}
            </Button>
            <Button variant="ghost" onClick={() => router.push(detailHref)}>
              {tEditor("unsaved.leave")}
            </Button>
            <Button variant="ghost" onClick={() => setLeaveConfirm(false)}>
              {tEditor("unsaved.stay")}
            </Button>
          </div>
        </ToneCard>
      )}

      <div className="mt-4">
        <label
          htmlFor="plan-title"
          className="mb-2 block text-base font-medium text-neutral-800"
        >
          {t("planTitle")}
        </label>
        <input
          id="plan-title"
          type="text"
          value={draft.title}
          maxLength={200}
          onChange={(event) =>
            update((current) => ({ ...current, title: event.target.value }))
          }
          className="min-h-11 w-full rounded-md border border-neutral-300 bg-surface px-3 py-2 text-lg font-semibold text-neutral-900 transition-colors focus:border-primary"
        />
      </div>

      {status === "error" && (
        <ToneCard tone="danger" padding="sm" className="mt-4" role="alert">
          <p className="text-base leading-relaxed text-danger-ink">
            {error ?? tEditor("errors.network")}
          </p>
        </ToneCard>
      )}

      {/* ── Yig'indi ────────────────────────────────────────────────── */}
      <Card padding="sm" className="mt-4">
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          <Summary label={t("weeksCount")} value={String(draft.weeks.length)} />
          <Summary label={t("rowsCount")} value={String(rows)} />
          <Summary
            label={t("hoursTotal")}
            value={String(hours)}
            // Taqsimot kutilganidan chetlashsa — ogohlantiramiz, lekin
            // TAQIQLAMAYMIZ: chorak qisqarishi yoki bayram tushishi mumkin.
            tone={hours === expectedHours ? "normal" : "warn"}
            hint={
              hours === expectedHours
                ? undefined
                : t("hoursExpected", { expected: expectedHours })
            }
          />
        </dl>
      </Card>

      {/* ── Haftalar ────────────────────────────────────────────────── */}
      <div className="mt-6 space-y-4">
        {draft.weeks.map((week, weekIndex) => (
          <Card key={weekIndex} padding="sm">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-24">
                <label
                  htmlFor={`week-number-${weekIndex}`}
                  className="mb-1 block text-sm font-medium text-neutral-600"
                >
                  {t("weekNumber")}
                </label>
                <input
                  id={`week-number-${weekIndex}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={24}
                  value={week.weekNumber}
                  onChange={(event) =>
                    updateWeek(weekIndex, {
                      ...week,
                      weekNumber: Number(event.target.value) || 1,
                    })
                  }
                  className="min-h-11 w-full rounded-md border border-neutral-300 bg-surface px-3 py-2 text-base tabular-nums transition-colors focus:border-primary"
                />
              </div>

              <div className="min-w-40 flex-1">
                <label
                  htmlFor={`week-range-${weekIndex}`}
                  className="mb-1 block text-sm font-medium text-neutral-600"
                >
                  {t("dateRange")}
                </label>
                <input
                  id={`week-range-${weekIndex}`}
                  type="text"
                  maxLength={100}
                  value={week.dateRange}
                  onChange={(event) =>
                    updateWeek(weekIndex, { ...week, dateRange: event.target.value })
                  }
                  className="min-h-11 w-full rounded-md border border-neutral-300 bg-surface px-3 py-2 text-base transition-colors focus:border-primary"
                />
              </div>

              <IconButton
                label={t("deleteWeek")}
                tone="danger"
                disabled={draft.weeks.length === 1}
                onClick={() => setPendingDelete(`week-${weekIndex}`)}
              >
                <Trash2 aria-hidden className="size-5" />
              </IconButton>
            </div>

            {pendingDelete === `week-${weekIndex}` && (
              <ConfirmRow
                message={t("confirmDeleteWeek", { number: week.weekNumber })}
                confirmLabel={t("confirmDeleteYes")}
                onConfirm={() => deleteWeek(weekIndex)}
                onCancel={() => setPendingDelete(null)}
                cancelLabel={tEditor("cancel")}
              />
            )}

            {/* ── Mavzular ────────────────────────────────────────── */}
            <ul className="mt-4 space-y-3">
              {week.topics.map((topic, topicIndex) => (
                <li
                  key={topicIndex}
                  className="rounded-md border border-neutral-200 bg-neutral-50 p-3"
                >
                  <div className="flex flex-wrap gap-3">
                    <div className="min-w-48 flex-1">
                      <label
                        htmlFor={`topic-name-${weekIndex}-${topicIndex}`}
                        className="mb-1 block text-sm font-medium text-neutral-600"
                      >
                        {t("topicName")}
                      </label>
                      <input
                        id={`topic-name-${weekIndex}-${topicIndex}`}
                        type="text"
                        maxLength={300}
                        value={topic.name}
                        onChange={(event) => {
                          const topics = [...week.topics];
                          topics[topicIndex] = { ...topic, name: event.target.value };
                          updateWeek(weekIndex, { ...week, topics });
                        }}
                        className="min-h-11 w-full rounded-md border border-neutral-300 bg-surface px-3 py-2 text-base transition-colors focus:border-primary"
                      />
                    </div>

                    <div className="w-24">
                      <label
                        htmlFor={`topic-hours-${weekIndex}-${topicIndex}`}
                        className="mb-1 block text-sm font-medium text-neutral-600"
                      >
                        {t("hours")}
                      </label>
                      <input
                        id={`topic-hours-${weekIndex}-${topicIndex}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={20}
                        value={topic.hours}
                        onChange={(event) => {
                          const topics = [...week.topics];
                          topics[topicIndex] = {
                            ...topic,
                            hours: Number(event.target.value) || 1,
                          };
                          updateWeek(weekIndex, { ...week, topics });
                        }}
                        className="min-h-11 w-full rounded-md border border-neutral-300 bg-surface px-3 py-2 text-base tabular-nums transition-colors focus:border-primary"
                      />
                    </div>

                    <div className="flex items-end gap-1">
                      <IconButton
                        label={t("moveUp")}
                        disabled={topicIndex === 0}
                        onClick={() => moveTopic(weekIndex, topicIndex, -1)}
                      >
                        <ChevronUp aria-hidden className="size-5" />
                      </IconButton>
                      <IconButton
                        label={t("moveDown")}
                        disabled={topicIndex === week.topics.length - 1}
                        onClick={() => moveTopic(weekIndex, topicIndex, 1)}
                      >
                        <ChevronDown aria-hidden className="size-5" />
                      </IconButton>
                      <IconButton
                        label={t("deleteTopic")}
                        tone="danger"
                        // Haftada kamida bitta mavzu qolishi kerak.
                        disabled={week.topics.length === 1}
                        onClick={() =>
                          setPendingDelete(`topic-${weekIndex}-${topicIndex}`)
                        }
                      >
                        <X aria-hidden className="size-5" />
                      </IconButton>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label
                      htmlFor={`topic-note-${weekIndex}-${topicIndex}`}
                      className="mb-1 block text-sm font-medium text-neutral-600"
                    >
                      {t("note")}
                    </label>
                    <input
                      id={`topic-note-${weekIndex}-${topicIndex}`}
                      type="text"
                      maxLength={500}
                      value={topic.note ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        const topics = [...week.topics];
                        topics[topicIndex] = {
                          ...topic,
                          // Bo'sh izoh `undefined` — sxemada ixtiyoriy.
                          note: value.trim() === "" ? undefined : value,
                        };
                        updateWeek(weekIndex, { ...week, topics });
                      }}
                      className="min-h-11 w-full rounded-md border border-neutral-300 bg-surface px-3 py-2 text-base transition-colors focus:border-primary"
                    />
                  </div>

                  {pendingDelete === `topic-${weekIndex}-${topicIndex}` && (
                    <ConfirmRow
                      message={t("confirmDeleteTopic")}
                      confirmLabel={t("confirmDeleteYes")}
                      onConfirm={() => deleteTopic(weekIndex, topicIndex)}
                      onCancel={() => setPendingDelete(null)}
                      cancelLabel={tEditor("cancel")}
                    />
                  )}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => addTopic(weekIndex)}
              disabled={week.topics.length >= 10}
              className="mt-3 flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-primary transition-colors hover:bg-primary-soft disabled:pointer-events-none disabled:opacity-50"
            >
              <Plus aria-hidden className="size-5" />
              {t("addTopic")}
            </button>
          </Card>
        ))}
      </div>

      <button
        type="button"
        onClick={addWeek}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 px-3 py-2 text-base font-medium text-neutral-700 transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-ink"
      >
        <Plus aria-hidden className="size-5" />
        {t("addWeek")}
      </button>

      <SaveBar dirty={dirty} status={status} onSave={save} onDiscard={discard} />

      <p className="mt-6 text-center text-sm text-neutral-500">{t("noAiHint")}</p>
    </div>
  );
}

function Summary({
  label,
  value,
  tone = "normal",
  hint,
}: {
  label: string;
  value: string;
  tone?: "normal" | "warn";
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "warn" ? "text-accent-ink" : "text-neutral-900",
        )}
      >
        {value}
      </dd>
      {hint !== undefined && <p className="text-sm text-accent-ink">{hint}</p>}
    </div>
  );
}

function ConfirmRow({
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ToneCard tone="danger" padding="sm" className="mt-3" role="alert">
      <p className="text-base font-medium text-danger-ink">{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </ToneCard>
  );
}

function IconButton({
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
        "flex size-11 items-center justify-center rounded-md transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
        tone === "danger"
          ? "text-danger hover:bg-danger-soft"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
      )}
    >
      {children}
    </button>
  );
}
