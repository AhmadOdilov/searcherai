"use client";

import { useCallback, useState } from "react";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { PAGE_SIZE } from "@/lib/ui/pagination";

/**
 * Cursor asosidagi "Ko'proq yuklash".
 *
 * ── Nega cheksiz scroll emas ──────────────────────────────────────────────
 * Tugma soddaroq va ishonchliroq: klaviatura bilan ham ishlaydi,
 * skrinriderlar uchun tushunarli, va tasodifan pastga tushib ketganda
 * keraksiz so'rov yubormaydi. MVP uchun shu yetarli.
 *
 * Birinchi sahifa SERVERDA render qilinadi (qo'shimcha so'rovsiz),
 * keyingilari shu hook orqali olinadi.
 */

interface ListResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export interface UseLoadMoreResult<T> {
  items: T[];
  /** Yana yozuv bormi. */
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  loadMore: () => void;
}

export function useLoadMore<T>(options: {
  /** API yo'li, masalan "/api/lesson-plans". */
  resource: string;
  initialItems: T[];
  initialCursor: string | null;
}): UseLoadMoreResult<T> {
  const { resource, initialItems, initialCursor } = options;

  const [items, setItems] = useState<T[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(() => {
    if (cursor === null || loading) return;

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const data = await apiRequest<ListResponse<T>>(
          `${resource}?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}`,
        );
        setItems((current) => [...current, ...data.items]);
        setCursor(data.nextCursor);
      } catch (caught) {
        setError(caught instanceof ApiClientError ? caught.message : "errors.unknown");
      } finally {
        setLoading(false);
      }
    })();
  }, [resource, cursor, loading]);

  return { items, hasMore: cursor !== null, loading, error, loadMore };
}
