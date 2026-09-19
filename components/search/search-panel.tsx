"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Info,
  Lightbulb,
  ListChecks,
  Presentation,
  Search,
  Sparkles,
  Zap,
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
import {
  isOfficiallyVerified,
  type GroundingValidationResult,
} from "@/lib/search/validator";
import type { OrchestrationAction } from "@/lib/search/orchestration";
import type { AdaptiveSearchStrategy } from "@/lib/search/adaptive";
import type { SearchCostMetrics } from "@/lib/search/cost";
import type { SearchLatencyBreakdown } from "@/lib/search/service";

interface SearchResponse {
  answer: SearchAnswer;
  understanding?: QueryUnderstanding;
  curriculumMatches?: RankedCurriculumMatch[];
  grounding?: GroundingValidationResult;
  suggestedActions?: OrchestrationAction[];
  explanation?: string;
  adaptiveStrategy?: AdaptiveSearchStrategy;
  costMetrics?: SearchCostMetrics;
  cached?: boolean;
  durationMs?: number;
  latencyBreakdown?: SearchLatencyBreakdown;
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
  const [questionText, setQuestionText] = useState<string>("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const question = questionText.trim() || String(formData.get("question") ?? "");

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
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
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
        <AnswerView
          result={result}
          question={askedQuestion}
          onSelectClarification={(opt) => {
            setQuestionText(opt);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </>
  );
}

/**
 * Manba havolasi faqat http(s) bo'lsa chiqariladi.
 *
 * Havola bazadan keladi va hozir u faqat seed skripti orqali to'ladi,
 * lekin `javascript:` yoki `data:` sxemali qiymat UI'ga yetib bormasligi
 * uchun tekshiruv arzon va o'rinli.
 */
function isSafeHttpUrl(value: string | undefined | null): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Bo'sh ekrandagi namuna savollar — nimadan boshlashni ko'rsatadi. */
const EXAMPLE_KEYS = ["first", "second", "third"] as const;

function AnswerView({
  result,
  question,
  onSelectClarification,
}: {
  result: SearchResponse;
  question: string;
  onSelectClarification?: (text: string) => void;
}) {
  const t = useTranslations("search");
  const { answer, curriculumMatches, suggestedActions, understanding } = result;

  /*
    Sinf tafovuti — FAQAT eng yuqori moslik bo'yicha.

    V4 da bu `curriculumMatches.find((m) => m.isCrossGrade)` edi, ya'ni
    ro'yxatdagi ISTALGAN moslik boshqa sinfdan bo'lsa ogohlantirish
    chiqardi. Backend validatori esa faqat 1-o'rindagi moslikni tekshiradi.

    Natijada haqiqiy E2E tekshiruvida shu holat kuzatildi: «8-sinf
    matematika kvadrat tenglamalar» so'rovi 1-o'rinda 8-sinf bo'limini
    topdi va RASMIY DTS deb tasdiqlandi, lekin ro'yxatning 3-o'rnidagi
    boshqa sinf bo'limi tufayli UI «Sinf tafovuti aniqlandi» deb
    ogohlantirardi — javob to'g'ri sinfdan bo'lsa ham.
  */
  const topMatch = curriculumMatches?.[0];
  const crossGradeMatch = topMatch?.isCrossGrade ? topMatch : undefined;

  /*
    ── TASDIQLANGANLIK YAGONA MANBADAN ANIQLANADI ──────────────────────────

    V4 da yuqoridagi banner `isGrounded` ni hisobga olardi, lekin pastdagi
    «Rasmiy o'quv dasturi (DTS)» kartasi `curriculumMatches.length > 0`
    shartigina tekshirardi. Natijada javob TASDIQLANMAGAN bo'lsa ham
    (ball past, qisman moslik yoki boshqa sinf) foydalanuvchi yashil
    belgili «Rasmiy o'quv dasturi havolasi» kartasini ko'rardi va uni
    rasmiy dalil deb qabul qilardi.

    Endi bitta qiymat ikkala blokni ham boshqaradi.
  */
  const isVerified = isOfficiallyVerified(
    result.grounding,
    curriculumMatches?.length ?? 0,
  );

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
                {t("detected.subject")}: {understanding.detectedSubject}
              </span>
            )}
            {understanding.detectedGrade && (
              <span className="rounded-full bg-neutral-100 px-3 py-1 font-medium text-neutral-700">
                {t("detected.grade")}: {understanding.detectedGrade}
              </span>
            )}
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-600">
              {t("detected.mode")}:{" "}
              {understanding.audience === "student"
                ? t("detected.student")
                : t("detected.teacher")}
            </span>
          </div>
        )}

        {/* ── Grounding Explanation & Performance/Cost Badge (Phase 19 & 24) ── */}
        {result.explanation && (
          <div
            className={`mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border p-3.5 text-sm ${
              isVerified
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                : "border-sky-200 bg-sky-50/80 text-sky-950"
            }`}
          >
            <div className="flex items-start sm:items-center gap-2">
              {isVerified ? (
                <CheckCircle2 className="mt-0.5 sm:mt-0 size-4 shrink-0 text-emerald-600" />
              ) : (
                <Info className="mt-0.5 sm:mt-0 size-4 shrink-0 text-sky-600" />
              )}
              <div>
                <span className="font-semibold">
                  {isVerified
                    ? t("grounding.verifiedTitle")
                    : t("grounding.generalTitle")}
                </span>
                <span>{result.explanation}</span>
              </div>
            </div>
            {result.costMetrics && (
              <span
                className={`inline-flex items-center gap-1 self-start sm:self-auto rounded bg-white px-2 py-1 text-xs font-mono border shrink-0 ${
                  isVerified
                    ? "text-emerald-800 border-emerald-200"
                    : "text-sky-800 border-sky-200"
                }`}
              >
                <Zap className="size-3 text-amber-500" />
                {result.cached
                  ? t("grounding.cached")
                  : `${result.costMetrics.totalMs.toFixed(1)}ms | ~$${result.costMetrics.estimatedCostUsd.toFixed(4)}`}
              </span>
            )}
          </div>
        )}

        {/* ── Cross-Grade Alert (Phase 7) ─────────────────────────────────── */}
        {crossGradeMatch && (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div>
              <span className="font-semibold">{t("crossGrade.title")}</span>
              <span>
                {t("crossGrade.body", { grade: crossGradeMatch.availableGrade ?? "" })}
              </span>
            </div>
          </div>
        )}

        {/* ── Clarification Options (Phase 21) ────────────────────────────── */}
        {result.adaptiveStrategy?.needsClarification &&
          result.adaptiveStrategy.clarification?.options &&
          result.adaptiveStrategy.clarification.options.length > 0 && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3.5 text-sm text-blue-900">
              <div className="flex items-center gap-2 font-medium">
                <Info className="size-4 text-blue-600" />
                <span>
                  {result.adaptiveStrategy.clarification.question ||
                    t("clarification.fallbackQuestion")}
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {result.adaptiveStrategy.clarification.options.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSelectClarification?.(`${opt.subject} ${question}`)}
                    className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 hover:border-blue-400 cursor-pointer"
                  >
                    {opt.label} ({opt.subject}) →
                  </button>
                ))}
              </div>
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
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                isVerified
                  ? "bg-primary-soft text-primary"
                  : "bg-neutral-100 text-neutral-500"
              }`}
            >
              <BookOpen className="size-6" />
            </span>
            <div>
              <h3 className="text-xl font-semibold text-neutral-900">
                {isVerified
                  ? t("curriculum.verifiedTitle")
                  : t("curriculum.relatedTitle")}
              </h3>
              <p className="text-sm text-neutral-500">
                {isVerified ? t("curriculum.verifiedHint") : t("curriculum.relatedHint")}
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
                  {/* `&&` emas, aniq taqqoslash: 0 soat React'da "0" bo'lib chiqib qolardi. */}
                  {typeof topic.expectedHours === "number" && topic.expectedHours > 0 ? (
                    <span className="text-xs font-medium text-neutral-500">
                      {t("curriculum.hours", { hours: topic.expectedHours })}
                    </span>
                  ) : null}
                </div>
                {topic.expectedOutcomes.length > 0 && (
                  <div className="mt-2 text-sm text-neutral-600">
                    <span className="font-medium text-neutral-700">
                      {t("curriculum.outcome")}
                    </span>{" "}
                    {topic.expectedOutcomes[0]}
                  </div>
                )}
                {isSafeHttpUrl(topic.source) && (
                  <div
                    className={`mt-2 text-xs ${isVerified ? "text-primary" : "text-neutral-500"}`}
                  >
                    <a
                      href={topic.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {/* Yashil "tasdiqlangan" belgisi FAQAT asoslangan javobda. */}
                      {isVerified ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <Info className="size-3.5" />
                      )}{" "}
                      {t("curriculum.sourceLink")}
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
          <h3 className="text-xl font-semibold text-neutral-900">{t("actions.title")}</h3>
          <p className="mt-1 text-sm text-neutral-600">{t("actions.hint")}</p>

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
                    <LinkButton href={action.url} variant="secondary" size="sm" fullWidth>
                      {t("actions.open")}
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
