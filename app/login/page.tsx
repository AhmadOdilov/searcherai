"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { AuthForm } from "@/components/auth-form";
import { safeInternalPath } from "@/lib/auth/safe-redirect";
import { Input } from "@/components/ui/field";

/**
 * `/login` — tizimga kirish.
 *
 * `useSearchParams` Suspense talab qiladi, shuning uchun forma alohida
 * komponentga ajratilgan.
 */
function LoginForm() {
  const searchParams = useSearchParams();
  const t = useTranslations("auth");

  /*
    Proxy foydalanuvchini bu yerga yuborganda qaysi sahifani so'raganini
    `?next=` da uzatadi — kirgandan keyin shu sahifaga qaytaramiz.

    Qiymat SO'ROV qismidan keladi, ya'ni uni istalgan odam yozadi.
    Tekshiruv `safeInternalPath` da: u satr shakliga emas, manzilning
    BRAUZER qoidasi bo'yicha yechilgan natijasiga qaraydi.
    Nega bu shart — lib/auth/safe-redirect.ts
  */
  const redirectTo = safeInternalPath(searchParams.get("next"));

  return (
    <AuthForm
      title={t("login.title")}
      description={t("login.description")}
      submitLabel={t("login.submit")}
      submittingLabel={t("login.submitting")}
      endpoint="/api/auth/login"
      redirectTo={redirectTo}
      footer={
        <>
          {t("login.noAccount")}{" "}
          <Link
            href="/register"
            className="font-medium text-primary underline underline-offset-4"
          >
            {t("login.registerLink")}
          </Link>
        </>
      }
    >
      {(errors) => (
        <>
          <Input
            label={t("fields.email")}
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder={t("fields.emailPlaceholder")}
            help={t("fields.emailHelp")}
            errors={errors}
          />
          <Input
            label={t("fields.password")}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            errors={errors}
          />
        </>
      )}
    </AuthForm>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
