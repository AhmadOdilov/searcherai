"use client";

import { useTranslations } from "next-intl";

/** "Ko'proq yuklash" tugmasi — uchala ro'yxatda bir xil. */
export function LoadMoreButton({
  hasMore,
  loading,
  error,
  onClick,
}: {
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  onClick: () => void;
}) {
  const t = useTranslations("common");

  if (!hasMore && error === null) return null;

  return (
    <div className="mt-4 text-center">
      {error !== null && (
        <p role="alert" className="mb-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={onClick}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? t("loading") : t("loadMore")}
        </button>
      )}
    </div>
  );
}
