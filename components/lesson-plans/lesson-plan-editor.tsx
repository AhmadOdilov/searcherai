"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { useEditorDraft } from "@/lib/hooks/use-editor-draft";
import { useUnsavedGuard } from "@/lib/hooks/use-unsaved-guard";
import { SaveBar } from "@/components/editor/save-bar";
import { Button } from "@/components/ui/button";
import { Card, ToneCard } from "@/components/ui/card";
import { cn } from "@/lib/ui/cn";
import {
  totalStageMinutes,
  type LessonPlanContent,
  type LessonStage,
} from "@/lib/validations/lesson-plan";

/**
 * Dars ishlanmasi muharriri.
 *
 * ── Nega "inline" emas, to'liq forma ──────────────────────────────────────
 * Dars ishlanmasi — uzun hujjat: maqsad, natijalar, resurslar, bosqichlar
 * va baholash. Har bir bo'lakni sahifaning o'zida "bosib tahrirlash"
 * qilsak, o'qituvchi qayer tahrirlanadigan-u qayer yo'qligini bilmay
 * qolardi. Alohida muharrirda esa hamma narsa ochiq va bir xil ko'rinadi.
 *
 * ── Bosqichlar ALOHIDA e'tibor talab qiladi ───────────────────────────────
 * Ular ichma-ich: har birida nom, daqiqa va uchta matn bor. Shuning
 * uchun bosqichlar kartada, qolgan ro'yxatlar esa oddiy qatorlarda.
 */
export function LessonPlanEditor({
  planId,
  initialContent,
  detailHref,
  durationMinutes,
}: {
  planId: string;
  initialContent: LessonPlanContent;
  detailHref: string;
  /** Darsning umumiy davomiyligi — taqsimotni solishtirish uchun. */
  durationMinutes: number;
}) {
  const t = useTranslations("lessonPlans.editor");
  const tEditor = useTranslations("editor");
  const router = useRouter();
  const { requestLeave } = useUnsavedGuard();

  const { draft, update, dirty, status, error, save, discard } =
    useEditorDraft<LessonPlanContent>({
      endpoint: `/api/lesson-plans/${planId}`,
      initial: initialContent,
    });

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  function setStages(stages: LessonStage[]) {
    update((current) => ({ ...current, stages }));
  }

  function updateStage(index: number, next: LessonStage) {
    const stages = [...draft.stages];
    stages[index] = next;
    setStages(stages);
  }

  function moveStage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.stages.length) return;

    const stages = [...draft.stages];
    [stages[index], stages[target]] = [stages[target], stages[index]];
    setStages(stages);
  }

  /*
    Chiqish qo'riqchidan so'raladi — tasdiq oynasi endi maketda, bitta
    joyda. Ilgari har muharrirda o'z nusxasi bor edi va u FAQAT shu
    tugmani qoplardi: sarlavhadagi havolalar ogohlantirishsiz o'tib
    ketardi. Batafsil: lib/hooks/use-unsaved-guard.tsx
  */
  function handleLeave() {
    requestLeave(() => router.push(detailHref));
  }

  const minutes = totalStageMinutes(draft);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <button
        type="button"
        onClick={handleLeave}
        className="-ml-3 inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-base text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
      >
        <ArrowLeft aria-hidden className="size-5 shrink-0" />
        {t("backToPlan")}
      </button>

      {status === "error" && (
        <ToneCard tone="danger" padding="sm" className="mt-4" role="alert">
          <p className="text-base leading-relaxed text-danger-ink">
            {error ?? tEditor("errors.network")}
          </p>
        </ToneCard>
      )}

      {/* ── Maqsad ─────────────────────────────────────────────────── */}
      <section className="mt-6">
        <label
          htmlFor="objective"
          className="mb-2 block text-lg font-semibold text-neutral-900"
        >
          {t("objective")}
        </label>
        <textarea
          id="objective"
          value={draft.objective}
          maxLength={1000}
          rows={3}
          onChange={(event) =>
            update((current) => ({ ...current, objective: event.target.value }))
          }
          className="w-full resize-y rounded-md border border-neutral-300 bg-surface px-3 py-2 text-base text-neutral-900 transition-colors focus:border-primary"
        />
      </section>

      {/* ── Kutilayotgan natijalar ─────────────────────────────────── */}
      <TextList
        title={t("outcomes")}
        items={draft.outcomes}
        maxLength={500}
        addLabel={t("addOutcome")}
        itemLabel={(n) => t("outcomeNumber", { number: n })}
        deleteLabel={t("deleteOutcome")}
        // Sxemada kamida 2 ta natija bo'lishi kerak.
        minItems={2}
        onChange={(outcomes) => update((current) => ({ ...current, outcomes }))}
      />

      {/* ── Resurslar ──────────────────────────────────────────────── */}
      <TextList
        title={t("resources")}
        items={draft.resources}
        maxLength={300}
        addLabel={t("addResource")}
        itemLabel={(n) => t("resourceNumber", { number: n })}
        deleteLabel={t("deleteResource")}
        minItems={1}
        onChange={(resources) => update((current) => ({ ...current, resources }))}
      />

      {/* ── Bosqichlar ─────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900">{t("stages")}</h2>
          {/*
            Vaqt yig'indisi — faqat KO'RSATKICH. Chetlashish taqiqlanmaydi:
            o'qituvchi qo'ng'iroqqacha qolgan vaqtni o'zi taqsimlaydi.
          */}
          <p
            className={cn(
              "text-base tabular-nums",
              minutes === durationMinutes ? "text-neutral-500" : "text-accent-ink",
            )}
          >
            {t("minutesTotal", { total: minutes, expected: durationMinutes })}
          </p>
        </div>

        <div className="mt-3 space-y-4">
          {draft.stages.map((stage, index) => (
            <Card key={index} padding="sm">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-40 flex-1">
                  <label
                    htmlFor={`stage-name-${index}`}
                    className="mb-1 block text-sm font-medium text-neutral-600"
                  >
                    {t("stageName")}
                  </label>
                  <input
                    id={`stage-name-${index}`}
                    type="text"
                    maxLength={120}
                    value={stage.name}
                    onChange={(event) =>
                      updateStage(index, { ...stage, name: event.target.value })
                    }
                    className="min-h-11 w-full rounded-md border border-neutral-300 bg-surface px-3 py-2 text-base transition-colors focus:border-primary"
                  />
                </div>

                <div className="w-28">
                  <label
                    htmlFor={`stage-minutes-${index}`}
                    className="mb-1 block text-sm font-medium text-neutral-600"
                  >
                    {t("stageMinutes")}
                  </label>
                  <input
                    id={`stage-minutes-${index}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={240}
                    value={stage.durationMinutes}
                    onChange={(event) =>
                      updateStage(index, {
                        ...stage,
                        durationMinutes: Number(event.target.value) || 1,
                      })
                    }
                    className="min-h-11 w-full rounded-md border border-neutral-300 bg-surface px-3 py-2 text-base tabular-nums transition-colors focus:border-primary"
                  />
                </div>

                <div className="flex items-end gap-1">
                  <IconButton
                    label={t("moveUp")}
                    disabled={index === 0}
                    onClick={() => moveStage(index, -1)}
                  >
                    <ChevronUp aria-hidden className="size-5" />
                  </IconButton>
                  <IconButton
                    label={t("moveDown")}
                    disabled={index === draft.stages.length - 1}
                    onClick={() => moveStage(index, 1)}
                  >
                    <ChevronDown aria-hidden className="size-5" />
                  </IconButton>
                  <IconButton
                    label={t("deleteStage")}
                    tone="danger"
                    // Sxemada kamida 3 bosqich bo'lishi kerak.
                    disabled={draft.stages.length <= 3}
                    onClick={() => setPendingDelete(`stage-${index}`)}
                  >
                    <X aria-hidden className="size-5" />
                  </IconButton>
                </div>
              </div>

              {pendingDelete === `stage-${index}` && (
                <ToneCard tone="danger" padding="sm" className="mt-3" role="alert">
                  <p className="text-base font-medium text-danger-ink">
                    {t("confirmDeleteStage", { name: stage.name })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="danger"
                      onClick={() => {
                        setStages(draft.stages.filter((_, i) => i !== index));
                        setPendingDelete(null);
                      }}
                    >
                      {t("confirmDeleteYes")}
                    </Button>
                    <Button variant="ghost" onClick={() => setPendingDelete(null)}>
                      {tEditor("cancel")}
                    </Button>
                  </div>
                </ToneCard>
              )}

              <StageField
                id={`stage-description-${index}`}
                label={t("stageDescription")}
                value={stage.description}
                maxLength={2000}
                onChange={(description) => updateStage(index, { ...stage, description })}
              />
              <StageField
                id={`stage-teacher-${index}`}
                label={t("teacherActivity")}
                value={stage.teacherActivity}
                maxLength={2000}
                onChange={(teacherActivity) =>
                  updateStage(index, { ...stage, teacherActivity })
                }
              />
              <StageField
                id={`stage-student-${index}`}
                label={t("studentActivity")}
                value={stage.studentActivity}
                maxLength={2000}
                onChange={(studentActivity) =>
                  updateStage(index, { ...stage, studentActivity })
                }
              />
            </Card>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setStages([
              ...draft.stages,
              {
                name: "",
                durationMinutes: 5,
                description: "",
                teacherActivity: "",
                studentActivity: "",
              },
            ])
          }
          disabled={draft.stages.length >= 12}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 px-3 py-2 text-base font-medium text-neutral-700 transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-ink disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus aria-hidden className="size-5" />
          {t("addStage")}
        </button>
      </section>

      {/* ── Baholash mezonlari (ixtiyoriy) ─────────────────────────── */}
      <TextList
        title={t("assessmentCriteria")}
        items={draft.assessmentCriteria ?? []}
        maxLength={500}
        addLabel={t("addCriterion")}
        itemLabel={(n) => t("criterionNumber", { number: n })}
        deleteLabel={t("deleteCriterion")}
        minItems={0}
        onChange={(items) =>
          update((current) => ({
            ...current,
            // Bo'sh massiv `undefined` — sxemada bu maydon ixtiyoriy.
            assessmentCriteria: items.length === 0 ? undefined : items,
          }))
        }
      />

      <SaveBar dirty={dirty} status={status} onSave={save} onDiscard={discard} />

      <p className="mt-6 text-center text-sm text-neutral-500">{t("noAiHint")}</p>
    </div>
  );
}

/** Bosqich ichidagi uzun matn maydoni. */
function StageField({
  id,
  label,
  value,
  maxLength,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-3">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-neutral-600">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        maxLength={maxLength}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-md border border-neutral-300 bg-surface px-3 py-2 text-base text-neutral-900 transition-colors focus:border-primary"
      />
    </div>
  );
}

/**
 * Oddiy matnlar ro'yxati — natijalar, resurslar, baholash mezonlari.
 *
 * Uchtasi ham bir xil shaklda (qator matn + o'chirish), shuning uchun
 * bitta komponent. Farq faqat sarlavha, chegara va eng kam elementda.
 */
function TextList({
  title,
  items,
  maxLength,
  addLabel,
  itemLabel,
  deleteLabel,
  minItems,
  onChange,
}: {
  title: string;
  items: string[];
  maxLength: number;
  addLabel: string;
  itemLabel: (number: number) => string;
  deleteLabel: string;
  minItems: number;
  onChange: (items: string[]) => void;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold text-neutral-900">{title}</h2>

      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <textarea
              value={item}
              maxLength={maxLength}
              rows={2}
              aria-label={itemLabel(index + 1)}
              onChange={(event) => {
                const next = [...items];
                next[index] = event.target.value;
                onChange(next);
              }}
              className="min-w-0 flex-1 resize-y rounded-md border border-neutral-300 bg-surface px-3 py-2 text-base text-neutral-900 transition-colors focus:border-primary"
            />
            <IconButton
              label={deleteLabel}
              tone="danger"
              disabled={items.length <= minItems}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <X aria-hidden className="size-5" />
            </IconButton>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="mt-2 flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-primary transition-colors hover:bg-primary-soft"
      >
        <Plus aria-hidden className="size-5" />
        {addLabel}
      </button>
    </section>
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
        "flex size-11 shrink-0 items-center justify-center rounded-md transition-colors",
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
