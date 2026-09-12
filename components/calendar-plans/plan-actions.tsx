"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, apiRequest } from "@/lib/api-client";

/** Kalendar reja ustidagi amallar: qayta yaratish va o'chirish. */
export function CalendarPlanActions({
  planId,
  status,
}: {
  planId: string;
  status: "PENDING" | "READY" | "FAILED";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "retry" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleRetry() {
    setBusy("retry");
    setError(null);
    try {
      await apiRequest(`/api/calendar-plans/${planId}/regenerate`, {
        method: "POST",
      });
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Qayta urinish muvaffaqiyatsiz tugadi.",
      );
    }
    setBusy(null);
  }

  async function handleDelete() {
    setBusy("delete");
    setError(null);
    try {
      await apiRequest(`/api/calendar-plans/${planId}`, { method: "DELETE" });
      router.replace("/dashboard/calendar-plans");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "O'chirish muvaffaqiyatsiz tugadi.",
      );
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
            ? "Qayta yaratilmoqda…"
            : status === "FAILED"
              ? "Qayta urinish"
              : "Qaytadan yaratish"}
        </button>

        {confirmingDelete ? (
          <>
            <span className="text-sm text-slate-600">O&apos;chirilsinmi?</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy !== null}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {busy === "delete" ? "O'chirilmoqda…" : "Ha, o'chirish"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={busy !== null}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Bekor qilish
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={busy !== null}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            O&apos;chirish
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
          Bu 40-60 soniya davom etishi mumkin — sahifani yopmang.
        </p>
      )}
    </div>
  );
}
