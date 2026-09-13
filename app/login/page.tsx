"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { AuthForm } from "@/components/auth-form";
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

  // Proxy foydalanuvchini bu yerga yuborganda qaysi sahifani so'raganini
  // `?next=` da uzatadi — kirgandan keyin shu sahifaga qaytaramiz.
  const next = searchParams.get("next");
  // Faqat ichki yo'llarga ruxsat: tashqi manzil bo'lsa hujumchi
  // foydalanuvchini o'z saytiga yo'naltirib, ishonchli ko'rinishdan
  // foydalanishi mumkin (open redirect).
  const redirectTo =
    next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return (
    <AuthForm
      title={t("login.title")}
      description={t("login.description")}
      submitLabel={t("login.submit")}
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
