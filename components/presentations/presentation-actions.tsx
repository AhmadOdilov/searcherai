"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ApiClientError, apiRequest } from "@/lib/api-client";

/** Prezentatsiya ustidagi amallar: qayta yaratish va o'chirish. */
export function PresentationActions({
  presentationId,
  status,
}: {
  presentationId: string;
  status: "PENDING" | "READY" | "FAILED";
}) {
  const router = useRouter();
  const t = useTranslations("common");
  const [busy, setBusy] = useState<null | "retry" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleRetry() {
    setBusy("retry");
    setError(null);
    try {
      await apiRequest(`/api/presentations/${presentationId}/regenerate`, {
        method: "POST",
      });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : t("unexpectedError"));
    }
    setBusy(null);
  }

  async function handleDelete() {
    setBusy("delete");
    setError(null);
    try {
      await apiRequest(`/api/presentations/${presentationId}`, {
        method: "DELETE",
      });
      router.replace("/dashboard/presentations");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : t("unexpectedError"));
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleRetry}
          disabled={busy !== null}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
            status === "FAILED"
              ? "bg-slate-900 text-white hover:bg-slate-800"
              : "border border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
        >
          {busy === "retry"
            ? t("regenerating")
            : status === "FAILED"
              ? t("retry")
              : t("regenerate")}
        </button>

        {confirmingDelete ? (
          <>
            <span className="text-sm text-slate-600">{t("confirmDelete")}</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy !== null}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {busy === "delete" ? t("deleting") : t("confirmDeleteYes")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={busy !== null}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              {t("cancel")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={busy !== null}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {t("delete")}
          </button>
        )}
      </div>

      {error !== null && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {busy === "retry" && (
        <p aria-live="polite" className="mt-2 text-xs text-slate-500">
          {t("doNotClosePage")}
        </p>
      )}
    </div>
  );
}
