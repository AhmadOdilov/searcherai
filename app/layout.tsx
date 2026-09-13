import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Sahifa sarlavhasi ham tarjima qilinadi — u brauzer yorlig'ida va
 * qidiruv natijalarida ko'rinadi.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Til `i18n/request.ts` da aniqlangan: foydalanuvchi → cookie →
  // brauzer tili → "uz".
  const locale = await getLocale();

  return (
    <html
      // Ilgari qattiq "uz" edi. Bu skrinriderlar uchun muhim: ular
      // matnni shu atributga qarab to'g'ri talaffuz qiladi.
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-neutral-900">
        {/*
          Klient komponentlari `useTranslations()` ni shu provayder orqali
          oladi. Tarjimalar `i18n/request.ts` dan avtomatik uzatiladi.
        */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
