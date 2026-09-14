"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { GraduationCap } from "lucide-react";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { HelpLink } from "@/components/ui/help-link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";

/**
 * Kirish va ro'yxatdan o'tish formalari uchun umumiy qobiq.
 *
 * Ikkala sahifada bir xil bo'lgan narsalar shu yerda: yuborish holati,
 * xato ko'rsatish (umumiy va maydon bo'yicha), muvaffaqiyatda
 * yo'naltirish. Sahifalar faqat maydonlarni beradi.
 */

export interface AuthFormProps {
  title: string;
  /** Sarlavha ostidagi bir jumlalik tushuntirish. */
  description?: string;
  submitLabel: string;
  /**
   * Yuborish davomidagi yozuv — "Tekshirilmoqda…", "Hisob yaratilmoqda…".
   *
   * Umumiy "Yuborilmoqda…" dan ATAYLAB voz kechildi: kutish paytida
   * odam nima bo'layotganini bilishi kerak, ayniqsa sekin internetda.
   */
  submittingLabel: string;
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
  description,
  submitLabel,
  submittingLabel,
  endpoint,
  children,
  footer,
  redirectTo,
}: AuthFormProps) {
  const router = useRouter();
  const t = useTranslations("common");
  const tApp = useTranslations("app");
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
        setFormError(t("unexpectedError"));
      }
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-canvas px-4 py-4">
      {/* Til almashtirgich KIRISHDAN oldin ham kerak — foydalanuvchi hali
          tizimga kirmagan bo'lsa ham interfeysni o'z tilida ko'rsin. */}
      <div className="flex justify-end">
        <LocaleSwitcher />
      </div>

      <div className="mx-auto w-full max-w-md flex-1 pt-6 pb-10">
        <div className="text-center">
          {/*
            Logotip — bosh sahifaga havola. Kirish sahifasiga tasodifan
            tushgan odam uchun chiqish yo'li; busiz u faqat brauzerning
            "orqaga" tugmasiga qolardi.
          */}
          <Link
            href="/"
            className="mx-auto inline-flex flex-col items-center rounded-md px-3 py-1"
          >
            <span
              aria-hidden
              className="flex size-14 items-center justify-center rounded-xl bg-primary-soft text-primary"
            >
              <GraduationCap className="size-8" />
            </span>
            <span className="mt-3 text-base font-semibold text-neutral-900">
              {tApp("name")}
            </span>
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900">
            {title}
          </h1>
          {description !== undefined && (
            <p className="mt-2 text-base leading-relaxed text-neutral-600">
              {description}
            </p>
          )}
        </div>

        <Card className="mt-6" padding="md">
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {formError !== null && <FormError message={formError} />}

            {children(fieldErrors)}

            <Button type="submit" size="lg" fullWidth loading={submitting}>
              {submitting ? submittingLabel : submitLabel}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-base text-neutral-600">{footer}</p>

        <div className="mt-8 flex justify-center">
          <HelpLink />
        </div>
      </div>
    </main>
  );
}
