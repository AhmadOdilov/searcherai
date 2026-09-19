/**
 * Cost Intelligence & AI Token Observability (Phase 19).
 *
 * Vazifasi:
 *  1. Har bir qidiruv so'rovi uchun token sarfi va taxminiy narxni hisoblash.
 *  2. Kesh urilishi (cache hit) hisobiga tejalgan xarajatni (cache savings) o'lchash.
 *  3. Dashboard va monitoring uchun agregatsiya ko'rsatkichlarini tayyorlash.
 *
 * Model tariflari (Gemini 2.5 Flash / Standard baseline):
 *  - Input: $0.10 / 1,000,000 token ($0.0000001 per token)
 *  - Output: $0.40 / 1,000,000 token ($0.0000004 per token)
 *  - Cached search: $0.00 (100% tejalgan)
 */

export interface TokenPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const DEFAULT_PRICING: TokenPricing = {
  inputPerMillion: 0.1, // $0.10 per 1M tokens
  outputPerMillion: 0.4, // $0.40 per 1M tokens
};

export interface SearchCostMetrics {
  cached: boolean;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  cacheSavingsUsd: number;
  model: string;
  retrievalMs: number;
  generationMs: number;
  totalMs: number;
}

/**
 * Bitta qidiruv so'rovi uchun xarajat va kesh tejamkorligini hisoblaydi.
 */
export function calculateSearchCost(params: {
  cached: boolean;
  inputTokens: number;
  outputTokens: number;
  model: string;
  retrievalMs: number;
  generationMs: number;
  totalMs: number;
  pricing?: TokenPricing;
}): SearchCostMetrics {
  const pricing = params.pricing ?? DEFAULT_PRICING;

  // Agar keshdan qaytgan bo'lsa, xarajat 0, tejamkorlik esa ushbu tokenlarning to'liq narxi
  const standardCost =
    (params.inputTokens / 1_000_000) * pricing.inputPerMillion +
    (params.outputTokens / 1_000_000) * pricing.outputPerMillion;

  if (params.cached) {
    return {
      cached: true,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens: params.inputTokens + params.outputTokens,
      estimatedCostUsd: 0,
      cacheSavingsUsd: Number(standardCost.toFixed(6)),
      model: params.model,
      retrievalMs: params.retrievalMs,
      generationMs: 0,
      totalMs: params.totalMs,
    };
  }

  return {
    cached: false,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    totalTokens: params.inputTokens + params.outputTokens,
    estimatedCostUsd: Number(standardCost.toFixed(6)),
    cacheSavingsUsd: 0,
    model: params.model,
    retrievalMs: params.retrievalMs,
    generationMs: params.generationMs,
    totalMs: params.totalMs,
  };
}

/**
 * 1,000 ta so'rov uchun o'rtacha prognoz xarajatini hisoblaydi.
 */
export function estimateMonthlyCost(params: {
  totalQueries: number;
  cacheHitRate: number; // 0..1 (masalan 0.50)
  avgInputTokens?: number;
  avgOutputTokens?: number;
}): {
  totalQueries: number;
  cacheHits: number;
  coldSearches: number;
  estimatedTotalCostUsd: number;
  estimatedTotalSavingsUsd: number;
  costPer1kQueriesUsd: number;
} {
  const avgInput = params.avgInputTokens ?? 420;
  const avgOutput = params.avgOutputTokens ?? 280;
  const hitRate = Math.min(1, Math.max(0, params.cacheHitRate));

  const cacheHits = Math.round(params.totalQueries * hitRate);
  const coldSearches = params.totalQueries - cacheHits;

  const coldQueryCost = calculateSearchCost({
    cached: false,
    inputTokens: avgInput,
    outputTokens: avgOutput,
    model: "gemini-flash",
    retrievalMs: 8,
    generationMs: 800,
    totalMs: 808,
  });

  const totalCost = coldSearches * coldQueryCost.estimatedCostUsd;
  const totalSavings = cacheHits * coldQueryCost.estimatedCostUsd;
  const costPer1k = (totalCost / Math.max(1, params.totalQueries)) * 1000;

  return {
    totalQueries: params.totalQueries,
    cacheHits,
    coldSearches,
    estimatedTotalCostUsd: Number(totalCost.toFixed(4)),
    estimatedTotalSavingsUsd: Number(totalSavings.toFixed(4)),
    costPer1kQueriesUsd: Number(costPer1k.toFixed(4)),
  };
}
