import "server-only";
import { generateJson } from "@/lib/ai/provider";
import type { AiUsage } from "@/lib/ai/types";
import { getEnv } from "@/lib/env";
import { buildSearchSystemPrompt, buildSearchUserPrompt } from "@/lib/search/prompt";
import {
  searchAnswerSchema,
  type SearchAnswer,
  type SearchInput,
} from "@/lib/validations/search";
import { understandQuery, type QueryUnderstanding, type ConversationTurnContext } from "./understanding";
import { matchCurriculumTopics, type RankedCurriculumMatch } from "./curriculum-matcher";
import { validateAndGroundAnswer, type GroundingValidationResult } from "./validator";
import { buildOrchestrationActions, type OrchestrationAction } from "./orchestration";
import { searchCache } from "./cache";
import { createLogger } from "@/lib/observability/log";
import { determineAdaptiveStrategy, type AdaptiveSearchStrategy } from "./adaptive";
import { calculateSearchCost, type SearchCostMetrics } from "./cost";

const searchLog = createLogger("search");

/**
 * AI qidiruv — biznes mantiq qatlami (Intelligence V3).
 *
 * Pipeline bosqichlari:
 *  1. UNDERSTAND: normalizatsiya, til, fan (disambiguation bilan), sinf, intent confidence, auditoriya tahlili.
 *  2. ADAPTIVE ROUTE: so'rov murakkabligini aniqlash va qidiruv chuqurligini moslash (Phase 20).
 *  3. CACHE CHECK: agar ayni so'rov keshda mavjud bo'lsa, DB va AI chaqirilmasdan darhol qaytariladi (0ms DB).
 *  4. RETRIEVE & RANK: gibrid qidiruv, cross-lingual moslik, reranker va provenans.
 *  5. GENERATE: o'quv dasturi bilan boyitilgan, auditoriya va intentga mos prompt asosida AI javobini generatsiya qilish.
 *  6. VALIDATE & GROUND: da'volarni tekshirish (claims), soat/sinf ziddiyatlari va gallyutsinatsiya filtri.
 *  7. EXPLAIN & COST: xavfsiz izoh va token/xarajat monitoringini hisoblash.
 *  8. ORCHESTRATE: dars ishlanma (Word), prezentatsiya (PPT) yoki taqvim rejaga (Excel) dinamik o'tish harakatlari.
 */

export interface SearchLatencyBreakdown {
  understandingMs: number;
  retrievalMs: number;
  aiMs: number;
  validationMs: number;
  totalMs: number;
}

export interface SearchResult {
  answer: SearchAnswer;
  understanding: QueryUnderstanding;
  curriculumMatches: RankedCurriculumMatch[];
  grounding: GroundingValidationResult;
  suggestedActions: OrchestrationAction[];
  cached?: boolean;
  /** Qancha davom etgani — diagnostika uchun. */
  durationMs: number;
  latencyBreakdown: SearchLatencyBreakdown;
  model: string;
  usage: AiUsage;
  explanation?: string;
  adaptiveStrategy?: AdaptiveSearchStrategy;
  costMetrics?: SearchCostMetrics;
}

export async function runSearch(
  input: SearchInput,
  conversationContext?: ConversationTurnContext,
): Promise<SearchResult> {
  const startTime = Date.now();

  // 1. UNDERSTAND (Tahlil va normalizatsiya)
  const tUnderstandStart = Date.now();
  const understanding = understandQuery(
    input.question,
    input.subject,
    input.grade,
    input.language,
    conversationContext,
  );
  const understandingMs = Date.now() - tUnderstandStart;

  // 2. ADAPTIVE STRATEGY (Phase 20 & 21)
  const adaptiveStrategy = determineAdaptiveStrategy(understanding);

  // 3. CACHE CHECK (DB va AIdan oldin tekshiriladi — optimal latency)
  const cacheKey = searchCache.generateKey(understanding);
  const cachedResult = searchCache.get(cacheKey);
  if (cachedResult) {
    const costMetrics = calculateSearchCost({
      cached: true,
      inputTokens: cachedResult.usage.inputTokens,
      outputTokens: cachedResult.usage.outputTokens,
      model: cachedResult.model,
      retrievalMs: 0,
      generationMs: 0,
      totalMs: Date.now() - startTime,
    });

    return {
      ...cachedResult,
      cached: true,
      adaptiveStrategy,
      costMetrics,
      durationMs: Date.now() - startTime,
      latencyBreakdown: {
        understandingMs,
        retrievalMs: 0,
        aiMs: 0,
        validationMs: 0,
        totalMs: Date.now() - startTime,
      },
    };
  }

  // 4. RETRIEVE & RANK (O'quv dasturi bilan boyitish — Adaptive Depth)
  const tRetrievalStart = Date.now();
  const curriculumMatches = await matchCurriculumTopics(understanding, adaptiveStrategy.finalLimit);
  const retrievalMs = Date.now() - tRetrievalStart;

  // 5. GENERATE (AI chaqiruvi)
  const tAiStart = Date.now();
  const { data, meta } = await generateJson({
    schema: searchAnswerSchema,
    systemPrompt: buildSearchSystemPrompt(input.language),
    prompt: buildSearchUserPrompt(input, understanding, curriculumMatches),
    model: getEnv().searchAiModel,
  });
  const aiMs = Date.now() - tAiStart;

  // 6. VALIDATE & GROUND (Faktlar va da'volar tekshiruvi)
  const tValStart = Date.now();
  const grounding = validateAndGroundAnswer(data, understanding, curriculumMatches);

  // Agar grounding caution yoki contradiction bo'lsa, uni javobga qo'shamiz
  const finalAnswer: SearchAnswer = {
    ...data,
    caution: grounding.caution ?? data.caution,
  };
  const validationMs = Date.now() - tValStart;

  // 7. EXPLANATION & COST INTELLIGENCE (Phase 19 & 24)
  let explanation = "Javob umumiy metodik tavsiyalar asosida tayyorlandi.";
  if (curriculumMatches.length > 0) {
    const top = curriculumMatches[0];
    explanation = top.isCrossGrade && top.requestedGrade && top.availableGrade
      ? `Bu javob ${top.availableGrade} ${top.subject} o'quv dasturidagi «${top.topicName}» mavzusiga asoslandi (so'ralgan: ${top.requestedGrade}).`
      : `Bu javob ${top.grade} ${top.subject} o'quv dasturidagi «${top.topicName}» mavzusiga asoslandi.`;
  }

  const totalMs = Date.now() - startTime;

  const costMetrics = calculateSearchCost({
    cached: false,
    inputTokens: meta.usage.inputTokens,
    outputTokens: meta.usage.outputTokens,
    model: meta.model,
    retrievalMs,
    generationMs: aiMs,
    totalMs,
  });

  // 8. ORCHESTRATE (Word, PPT, Excel handoff)
  const suggestedActions = buildOrchestrationActions(understanding);

  const finalResult: SearchResult = {
    answer: finalAnswer,
    understanding,
    curriculumMatches,
    grounding,
    suggestedActions,
    explanation,
    adaptiveStrategy,
    costMetrics,
    durationMs: totalMs,
    latencyBreakdown: {
      understandingMs,
      retrievalMs,
      aiMs,
      validationMs,
      totalMs,
    },
    model: meta.model,
    usage: meta.usage,
  };

  // Production Observability (Phase 26): xavfsiz qidiruv ko'rsatkichlari (full prompt va maxfiy ma'lumotlarsiz)
  searchLog.info("search_pipeline_completed", {
    language: understanding.detectedLanguage,
    subject: understanding.detectedSubject,
    grade: understanding.detectedGrade,
    intent: understanding.detectedIntent,
    confidence: understanding.intentConfidence,
    audience: understanding.audience,
    retrievalCount: curriculumMatches.length,
    topScore: curriculumMatches[0]?.score ?? 0,
    cached: false,
    durationMs: totalMs,
    aiMs,
    grounded: grounding.isGrounded,
    supportedClaimRate: grounding.supportedClaimRate,
  });

  // Faqat muvaffaqiyatli natijani keshlaymiz
  searchCache.set(cacheKey, finalResult);

  return finalResult;
}
