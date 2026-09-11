"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, apiRequest } from "@/lib/api-client";

/**
 * Login va register formalari uchun umumiy qobiq.
 *
 * Ikkala sahifada bir xil bo'lgan narsalar shu yerda: yuborish holati,
 * xato ko'rsatish (umumiy va maydon bo'yicha), muvaffaqiyatda yo'naltirish.
 * Sahifalar faqat maydonlarni beradi.
 *
 * Dizayn ataylab minimal — chiroylashtirish keyingi bosqichda.
 */

export interface AuthFormProps {
  title: string;
  submitLabel: string;
  /** Qaysi endpointga yuborish: /api/auth/login yoki /api/auth/register. */
  endpoint: string;
  /** Forma maydonlari — `fieldErrors` ni ko'rsatish uchun `errors` beriladi. */
  children: (errors: Record<string, string[]>) => ReactNode;
  /** Forma ostidagi havola ("Hisobingiz bormi?"). */
  footer: ReactNode;
  /** Muvaffaqiyatdan keyin qayerga. */
  redirectTo: string;
}

export function AuthForm({
  title,
  submitLabel,
  endpoint,
  children,
  footer,
  redirectTo,
}: AuthFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());

    try {
      await apiRequest(endpoint, { method: "POST", body });
      // `refresh()` server komponentlarini qayta o'qitadi — shunda yangi
      // sessiya darhol amalga oshadi.
      router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fieldErrors) setFieldErrors(error.fieldErrors);
        // Maydon xatolari bo'lsa umumiy xabar ortiqcha shovqin bo'ladi.
        if (!error.fieldErrors) setFormError(error.message);
      } else {
        setFormError("Kutilmagan xatolik yuz berdi. Qayta urinib ko'ring.");
      }
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">Searcher AI</h1>
        <p className="mb-6 text-sm text-slate-500">{title}</p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          {formError !== null && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {formError}
            </p>
          )}

          {children(fieldErrors)}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Yuborilmoqda…" : submitLabel}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">{footer}</p>
      </div>
    </main>
  );
}

export interface FieldProps {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  /** Yordamchi matn (masalan "kamida 8 belgi"). */
  hint?: string;
  errors: Record<string, string[]>;
}

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required = true,
  defaultValue,
  placeholder,
  hint,
  errors,
}: FieldProps) {
  const fieldErrors = errors[name];
  const hasError = fieldErrors !== undefined && fieldErrors.length > 0;
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;

  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={hasError}
        // Skrinrider xato yoki izohni o'qishi uchun.
        aria-describedby={hasError ? errorId : hint ? hintId : undefined}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 ${
          hasError
            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
            : "border-slate-300 focus:border-slate-400 focus:ring-slate-100"
        }`}
      />
      {hasError ? (
        <p id={errorId} className="mt-1.5 text-xs text-red-600">
          {fieldErrors.join(" ")}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
