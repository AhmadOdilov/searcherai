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
import { understandQuery, type QueryUnderstanding } from "./understanding";
import { matchCurriculumTopics, type RankedCurriculumMatch } from "./curriculum-matcher";
import { validateAndGroundAnswer, type GroundingValidationResult } from "./validator";
import { buildOrchestrationActions, type OrchestrationAction } from "./orchestration";
import { searchCache } from "./cache";

/**
 * AI qidiruv — biznes mantiq qatlami.
 *
 * Pipeline bosqichlari:
 *  1. UNDERSTAND: normalizatsiya, apostroflar, til, fan, sinf, intent, auditoriya tahlili.
 *  2. RETRIEVE & RANK: rasmiy o'quv dasturidan (CurriculumTopic) gibrid qidiruv va ko'p mezonli reyting.
 *  3. CACHE CHECK: agar ayni so'rov keshda mavjud bo'lsa, AI chaqirilmasdan darhol qaytariladi.
 *  4. GENERATE: o'quv dasturi bilan boyitilgan, auditoriya va intentga mos prompt asosida AI javobini generatsiya qilish.
 *  5. VALIDATE & GROUND: gallyutsinatsiya tekshiruvi, manba havolalari va ogohlantirishlar (caution).
 *  6. ORCHESTRATE: dars ishlanma (Word), prezentatsiya (PPT) yoki taqvim rejaga (Excel) tezkor o'tish harakatlari.
 */

export interface SearchResult {
  answer: SearchAnswer;
  understanding: QueryUnderstanding;
  curriculumMatches: RankedCurriculumMatch[];
  grounding: GroundingValidationResult;
  suggestedActions: OrchestrationAction[];
  cached?: boolean;
  /** Qancha davom etgani — diagnostika uchun, foydalanuvchiga ko'rsatilmaydi. */
  durationMs: number;
  model: string;
  usage: AiUsage;
}

export async function runSearch(input: SearchInput): Promise<SearchResult> {
  const startTime = Date.now();

  // 1. UNDERSTAND
  const understanding = understandQuery(
    input.question,
    input.subject,
    input.grade,
    input.language,
  );

  // 2. RETRIEVE & RANK (O'quv dasturi bilan boyitish)
  const curriculumMatches = await matchCurriculumTopics(understanding, 3);

  // 3. CACHE CHECK
  const cacheKey = searchCache.generateKey(understanding);
  const cachedResult = searchCache.get(cacheKey);
  if (cachedResult) {
    return {
      ...cachedResult,
      cached: true,
      durationMs: Date.now() - startTime,
    };
  }

  // 4. GENERATE (AI chaqiruvi)
  const { data, meta } = await generateJson({
    schema: searchAnswerSchema,
    systemPrompt: buildSearchSystemPrompt(input.language),
    prompt: buildSearchUserPrompt(input, understanding, curriculumMatches),
    model: getEnv().searchAiModel,
  });

  // 5. VALIDATE & GROUND
  const grounding = validateAndGroundAnswer(data, understanding, curriculumMatches);

  // Agar grounding caution bo'lsa, uni javobga qo'shamiz
  const finalAnswer: SearchAnswer = {
    ...data,
    caution: grounding.caution ?? data.caution,
  };

  // 6. ORCHESTRATE (Word, PPT, Excel handoff)
  const suggestedActions = buildOrchestrationActions(understanding);

  const finalResult: SearchResult = {
    answer: finalAnswer,
    understanding,
    curriculumMatches,
    grounding,
    suggestedActions,
    durationMs: meta.totalDurationMs,
    model: meta.model,
    usage: meta.usage,
  };

  // Faqat muvaffaqiyatli natijani keshlaymiz
  searchCache.set(cacheKey, finalResult);

  return finalResult;
}
