"use client";

import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "Ko'proq ko'rsatish" tugmasi — uchala ro'yxatda bir xil. */
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
    <div className="mt-6 text-center">
      {error !== null && (
        <p role="alert" className="mb-3 text-base text-danger">
          {error}
        </p>
      )}

      {hasMore && (
        <Button
          variant="secondary"
          onClick={onClick}
          loading={loading}
          icon={loading ? undefined : <ChevronDown aria-hidden className="size-5" />}
        >
          {loading ? t("loading") : t("loadMore")}
        </Button>
      )}
    </div>
  );
}
