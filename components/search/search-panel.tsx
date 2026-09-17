"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Lightbulb,
  ListChecks,
  Presentation,
  Search,
  Sparkles,
} from "lucide-react";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { GENERATION_LANGUAGES } from "@/lib/ui/options";
import { Card, FormSection, ToneCard } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { FormError, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import type { SearchAnswer } from "@/lib/validations/search";
import type { QueryUnderstanding } from "@/lib/search/understanding";
import type { RankedCurriculumMatch } from "@/lib/search/curriculum-matcher";
import type { GroundingValidationResult } from "@/lib/search/validator";
import type { OrchestrationAction } from "@/lib/search/orchestration";

interface SearchResponse {
  answer: SearchAnswer;
  understanding?: QueryUnderstanding;
  curriculumMatches?: RankedCurriculumMatch[];
  grounding?: GroundingValidationResult;
  suggestedActions?: OrchestrationAction[];
}

export function SearchPanel() {
  const t = useTranslations("search");
  const tRoot = useTranslations();

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<SearchResponse | null>(null);
  /** Javob qaysi savolga berilganini ko'rsatish uchun. */
  const [askedQuestion, setAskedQuestion] = useState<string>("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const question = String(formData.get("question") ?? "");

    const body: Record<string, unknown> = {
      question,
      language: formData.get("language"),
    };
    const subject = String(formData.get("subject") ?? "").trim();
    const grade = String(formData.get("grade") ?? "").trim();
    if (subject !== "") body.subject = subject;
    if (grade !== "") body.grade = grade;

    try {
      const res = await apiRequest<SearchResponse>("/api/search", {
        method: "POST",
        body,
      });
      setResult(res);
      setAskedQuestion(question);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fieldErrors) setFieldErrors(error.fieldErrors);
        else setFormError(error.message);
      } else {
        setFormError(tRoot("common.unexpectedError"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card className="mt-6">
        <form onSubmit={handleSubmit} noValidate className="space-y-8">
          {formError !== null && <FormError message={formError} />}

          <FormSection step={1} title={t("sectionQuestion")}>
            <Textarea
              label={t("fields.question")}
              name="question"
              required
              rows={3}
              placeholder={t("fields.questionPlaceholder")}
              hint={t("fields.questionHint")}
              help={t("fields.questionHelp")}
              errors={fieldErrors}
              disabled={loading}
            />
          </FormSection>

          <FormSection
            step={2}
            title={t("sectionContext")}
            description={t("contextHint")}
          >
            <Input
              label={tRoot("lessonPlans.fields.subject")}
              name="subject"
              placeholder={tRoot("lessonPlans.fields.subjectPlaceholder")}
              hint={tRoot("common.optional")}
              errors={fieldErrors}
              disabled={loading}
            />
            <Input
              label={tRoot("lessonPlans.fields.grade")}
              name="grade"
              placeholder={tRoot("lessonPlans.fields.gradePlaceholder")}
              hint={tRoot("common.optional")}
              errors={fieldErrors}
              disabled={loading}
            />
            <Select
              label={tRoot("common.contentLanguage")}
              name="language"
              defaultValue="UZ"
              help={tRoot("common.contentLanguageHelp")}
              errors={fieldErrors}
              disabled={loading}
              options={GENERATION_LANGUAGES.map((value) => ({
                value,
                label: tRoot(`languages.${value}`),
              }))}
            />
          </FormSection>

          <div>
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={loading}
              icon={loading ? undefined : <Search aria-hidden className="size-5" />}
            >
              {loading ? t("asking") : t("submit")}
            </Button>
            <p className="mt-3 text-center text-base text-neutral-600">
              {loading ? tRoot("common.almostReady") : t("timeNotice")}
            </p>
          </div>
        </form>
      </Card>

      {result === null ? (
        !loading && (
          <EmptyState
            icon={<Sparkles aria-hidden className="size-9" />}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              <ul className="w-full max-w-md space-y-2 text-left">
                {EXAMPLE_KEYS.map((key) => (
                  <li
                    key={key}
                    className="rounded-md bg-neutral-100 px-4 py-3 text-base text-neutral-700"
                  >
                    {t(`examples.${key}`)}
                  </li>
                ))}
              </ul>
            }
          />
        )
      ) : (
        <AnswerView result={result} question={askedQuestion} />
      )}
    </>
  );
}

/** Bo'sh ekrandagi namuna savollar — nimadan boshlashni ko'rsatadi. */
const EXAMPLE_KEYS = ["first", "second", "third"] as const;

function AnswerView({
  result,
  question,
}: {
  result: SearchResponse;
  question: string;
}) {
  const t = useTranslations("search");
  const { answer, curriculumMatches, suggestedActions, understanding } = result;

  return (
    <section className="mt-8 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">{t("answerTitle")}</h2>
        <p className="mt-2 text-base leading-relaxed text-neutral-600">
          {t("answerFor", { question })}
        </p>

        {understanding && (
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-neutral-600">
            {understanding.detectedSubject && (
              <span className="rounded-full bg-neutral-100 px-3 py-1 font-medium text-neutral-700">
                Fan: {understanding.detectedSubject}
              </span>
            )}
            {understanding.detectedGrade && (
              <span className="rounded-full bg-neutral-100 px-3 py-1 font-medium text-neutral-700">
                Sinf: {understanding.detectedGrade}
              </span>
            )}
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-600">
              Rejim: {understanding.audience === "student" ? "O'quvchi" : "O'qituvchi"}
            </span>
          </div>
        )}
      </div>

      {/* ── Asosiy javob ────────────────────────────────────────────────── */}
      <ToneCard tone="primary">
        <p className="text-lg leading-relaxed text-primary-ink">{answer.answer}</p>
      </ToneCard>

      {/* ── Asosiy nuqtalar ─────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"
          >
            <ListChecks className="size-6" />
          </span>
          <h3 className="text-xl font-semibold text-neutral-900">{t("keyPoints")}</h3>
        </div>

        <ul className="mt-4 space-y-2">
          {answer.keyPoints.map((point, index) => (
            <li key={index} className="flex gap-3 text-base text-neutral-700">
              <span
                aria-hidden
                className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
              />
              <span className="leading-relaxed">{point}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* ── Sinfda qanday ishlatish ─────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"
          >
            <Lightbulb className="size-6" />
          </span>
          <h3 className="text-xl font-semibold text-neutral-900">
            {t("classroomIdeas")}
          </h3>
        </div>

        <ol className="mt-4 space-y-3">
          {answer.classroomIdeas.map((idea, index) => (
            <li key={index} className="flex gap-3">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-on-primary"
              >
                {index + 1}
              </span>
              <span className="pt-1 text-base leading-relaxed text-neutral-700">
                {idea}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      {/* ── Rasmiy o'quv dasturi manbalari (Citations & Grounding) ───────── */}
      {curriculumMatches && curriculumMatches.length > 0 && (
        <Card>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"
            >
              <BookOpen className="size-6" />
            </span>
            <div>
              <h3 className="text-xl font-semibold text-neutral-900">
                Rasmiy o'quv dasturi (DTS)
              </h3>
              <p className="text-sm text-neutral-500">
                O'zbekiston Respublikasi maktab dasturi bo'limlari bilan moslashtirilgan
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {curriculumMatches.map((topic, index) => (
              <div
                key={index}
                className="rounded-lg border border-neutral-200 bg-neutral-50 p-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-900">
                    {topic.topicName}
                  </span>
                  {topic.expectedHours && (
                    <span className="text-xs font-medium text-neutral-500">
                      {topic.expectedHours} soat ajratilgan
                    </span>
                  )}
                </div>
                {topic.expectedOutcomes.length > 0 && (
                  <div className="mt-2 text-sm text-neutral-600">
                    <span className="font-medium text-neutral-700">Kutilayotgan natija:</span>{" "}
                    {topic.expectedOutcomes[0]}
                  </div>
                )}
                {topic.source && (
                  <div className="mt-2 text-xs text-primary">
                    <a
                      href={topic.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      <CheckCircle2 className="size-3.5" /> Rasmiy o'quv dasturi havolasi
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Ehtiyot bo'ling ─────────────────────────────────────────────── */}
      {answer.caution !== undefined && (
        <ToneCard tone="accent">
          <div className="flex gap-3">
            <AlertTriangle aria-hidden className="mt-0.5 size-6 shrink-0 text-accent" />
            <div>
              <p className="text-lg font-semibold text-accent-ink">{t("caution")}</p>
              <p className="mt-2 text-base leading-relaxed text-accent-ink">
                {answer.caution}
              </p>
            </div>
          </div>
        </ToneCard>
      )}

      {/* ── Tezkor harakatlar va Handoff (Word, PPT, Excel) ──────────────── */}
      {suggestedActions && suggestedActions.length > 0 && (
        <Card>
          <h3 className="text-xl font-semibold text-neutral-900">
            Tavsiya etilgan amallar
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            Ushbu mavzu bo'yicha to'g'ridan-to'g'ri dars materiallarini tayyorlang:
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggestedActions.map((action, idx) => {
              const icon =
                action.type === "create_lesson_plan" ? (
                  <FileText className="size-5" />
                ) : action.type === "create_presentation" ? (
                  <Presentation className="size-5" />
                ) : (
                  <FileSpreadsheet className="size-5" />
                );

              return (
                <div
                  key={idx}
                  className="flex flex-col justify-between rounded-lg border border-neutral-200 bg-surface p-4 shadow-sm"
                >
                  <div>
                    <div className="flex items-center gap-2 text-primary font-medium">
                      {icon}
                      <span className="text-base font-semibold text-neutral-900">
                        {action.title}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-neutral-600 leading-normal">
                      {action.description}
                    </p>
                  </div>
                  <div className="mt-4">
                    <LinkButton
                      href={action.url}
                      variant="secondary"
                      size="sm"
                      fullWidth
                    >
                      Tayyorlashga o'tish
                    </LinkButton>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </section>
  );
}
