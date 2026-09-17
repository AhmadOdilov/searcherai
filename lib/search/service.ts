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

const searchLog = createLogger("search");

/**
 * AI qidiruv — biznes mantiq qatlami (Intelligence V2).
 *
 * Pipeline bosqichlari:
 *  1. UNDERSTAND: normalizatsiya, til, fan (disambiguation bilan), sinf, intent confidence, auditoriya tahlili.
 *  2. CACHE CHECK: agar ayni so'rov keshda mavjud bo'lsa, DB va AI chaqirilmasdan darhol qaytariladi (0ms DB).
 *  3. RETRIEVE & RANK: rasmiy o'quv dasturidan (CurriculumTopic) gibrid qidiruv, cross-lingual moslik va provenans.
 *  4. GENERATE: o'quv dasturi bilan boyitilgan, auditoriya va intentga mos prompt asosida AI javobini generatsiya qilish.
 *  5. VALIDATE & GROUND: da'volarni tekshirish (claims), soat/sinf ziddiyatlari va gallyutsinatsiya filtri.
 *  6. ORCHESTRATE: dars ishlanma (Word), prezentatsiya (PPT) yoki taqvim rejaga (Excel) dinamik o'tish harakatlari.
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

  // 2. CACHE CHECK (DB va AIdan oldin tekshiriladi — optimal latency)
  const cacheKey = searchCache.generateKey(understanding);
  const cachedResult = searchCache.get(cacheKey);
  if (cachedResult) {
    return {
      ...cachedResult,
      cached: true,
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

  // 3. RETRIEVE & RANK (O'quv dasturi bilan boyitish)
  const tRetrievalStart = Date.now();
  const curriculumMatches = await matchCurriculumTopics(understanding, 3);
  const retrievalMs = Date.now() - tRetrievalStart;

  // 4. GENERATE (AI chaqiruvi)
  const tAiStart = Date.now();
  const { data, meta } = await generateJson({
    schema: searchAnswerSchema,
    systemPrompt: buildSearchSystemPrompt(input.language),
    prompt: buildSearchUserPrompt(input, understanding, curriculumMatches),
    model: getEnv().searchAiModel,
  });
  const aiMs = Date.now() - tAiStart;

  // 5. VALIDATE & GROUND (Faktlar va da'volar tekshiruvi)
  const tValStart = Date.now();
  const grounding = validateAndGroundAnswer(data, understanding, curriculumMatches);

  // Agar grounding caution yoki contradiction bo'lsa, uni javobga qo'shamiz
  const finalAnswer: SearchAnswer = {
    ...data,
    caution: grounding.caution ?? data.caution,
  };
  const validationMs = Date.now() - tValStart;

  // 6. ORCHESTRATE (Word, PPT, Excel handoff)
  const suggestedActions = buildOrchestrationActions(understanding);

  const totalMs = Date.now() - startTime;

  const finalResult: SearchResult = {
    answer: finalAnswer,
    understanding,
    curriculumMatches,
    grounding,
    suggestedActions,
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
