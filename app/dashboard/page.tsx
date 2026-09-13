import { getTranslations } from "next-intl/server";
import {
  BookOpen,
  CalendarDays,
  Languages,
  Camera,
  Presentation,
  Search,
  type LucideIcon,
} from "lucide-react";
import { UserGreeting } from "@/components/user-greeting";
import { Onboarding } from "@/components/dashboard/onboarding";
import { Card, LinkCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HelpLink } from "@/components/ui/help-link";

/**
 * `/dashboard` — o'qituvchining ishchi sahifasi.
 *
 * ── Nega kartalar shu qadar katta ─────────────────────────────────────────
 * Bu sahifa — ilovaning butun mazmuni. Foydalanuvchi bu yerga kelib
 * "endi nima qilaman?" deb o'ylashi KERAK EMAS: uchta katta, rangli,
 * belgili karta uchta savolga javob beradi — nima qila olaman, u nima
 * qiladi, qayerga bosaman.
 *
 * Karta BUTUNLAY bosiladi (sarlavhasi emas) — telefonda barmoq bilan
 * xato bosish deyarli imkonsiz bo'ladi.
 *
 * Avtorizatsiya va umumiy sarlavha `app/dashboard/layout.tsx` da.
 */
export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      {/* Klient komponenti — foydalanuvchini contextdan oladi. */}
      <UserGreeting />

      {/*
        Birinchi tashrifda qisqa qo'llanma. Ro'yxatdan o'tgan odam bo'sh
        ekranga tushmasligi kerak — nimadan boshlashni ko'rsatamiz.
      */}
      <Onboarding />

      {/*
        ── Grid tartibi ────────────────────────────────────────────────────
        Telefonda (390px) 2 ustun: kartalar tor bo'lgani uchun tavsif
        matni yashiriladi (`hidden sm:block`), sarlavha va belgi qoladi.

        `lg` dan boshlab 3 ustun. Nega 4 emas: modullar BESHTA bo'ldi,
        4 ustunda oxirgi qator yolg'iz bitta karta bilan qolardi —
        3 ustunda esa 3 + 2 bo'lib, ancha tekis ko'rinadi.
      */}
      <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {READY_MODULES.map((module) => {
          const Icon = module.icon;
          return (
            <li key={module.key}>
              {/*
                `flex flex-col` + `mt-auto` — "Ochish" HAR DOIM kartaning
                pastida turadi. Bo'lmasa sarlavhasi ikki qatorli karta
                ("Kalendar-tematik reja") qo'shnisidan uzunroq bo'lib,
                havolalar zinapoyaga o'xshab ketardi.
              */}
              <LinkCard
                href={module.href}
                padding="sm"
                className="group flex h-full flex-col"
              >
                <ModuleBody
                  icon={<Icon aria-hidden className="size-7 sm:size-8" />}
                  title={t(`modules.${module.key}.title`)}
                  description={t(`modules.${module.key}.description`)}
                />
                <p className="mt-3 hidden pt-1 text-base font-medium text-primary sm:mt-auto sm:block">
                  {t("open")}
                </p>
              </LinkCard>
            </li>
          );
        })}
      </ul>

      {/*
        "Tez orada" moduli ishlaydiganlardan AJRATILGAN.

        Ilgari u to'rtinchi karta bo'lib, qolganlari bilan bir qatorda
        turardi — foydalanuvchi uni bosib ko'rib, hech narsa bo'lmagach
        "ilova buzuq" degan xulosaga kelishi mumkin edi. Endi u pastda,
        kichikroq va "hali tayyor emas" degani darhol ko'rinadi.
      */}
      {UPCOMING_MODULES.map((module) => {
        const Icon = module.icon;
        return (
          <Card key={module.key} padding="sm" className="mt-4 opacity-75">
            <div className="flex items-center gap-4">
              <span
                aria-hidden
                className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400"
              >
                <Icon className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-neutral-700">
                  {t(`modules.${module.key}.title`)}
                </p>
                <p className="mt-1 text-base leading-relaxed text-neutral-500">
                  {t(`modules.${module.key}.description`)}
                </p>
              </div>
              <Badge tone="neutral" className="hidden sm:inline-flex">
                {t("comingSoon")}
              </Badge>
            </div>
          </Card>
        );
      })}

      <div className="mt-10 flex justify-center border-t border-neutral-200 pt-6">
        <HelpLink />
      </div>
    </div>
  );
}

/** Ishlaydigan modul kartasining ichi. */
function ModuleBody({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <>
      <div className="flex size-12 items-center justify-center rounded-lg bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary sm:size-14">
        {icon}
      </div>

      <h2 className="mt-3 text-lg font-semibold text-neutral-900 sm:mt-4 sm:text-xl">
        {title}
      </h2>

      {/*
        Telefonda (2 ustunli grid) tavsif YASHIRILADI: 190px kenglikda
        uch qatorli matn kartani cho'zib yuboradi va to'rttasi bir
        ekranga sig'may qoladi. Sarlavha va belgi o'zi yetarli —
        "Dars ishlanmasi" nomi allaqachon nima ekanini aytadi.
      */}
      <p className="mt-2 hidden text-base leading-relaxed text-neutral-600 sm:block">
        {description}
      </p>
    </>
  );
}

/**
 * Ishlaydigan modullar — dashboard'dagi asosiy kartalar.
 *
 * Tartib ATAYLAB shunday: eng ko'p ishlatiladigani birinchi. O'qituvchi
 * kuniga dars ishlanmasi yasaydi, kalendar rejani esa chorakda bir marta.
 */
const READY_MODULES: Array<{
  key: "lessonPlans" | "presentations" | "calendarPlans" | "search" | "vision";
  icon: LucideIcon;
  href: string;
}> = [
  { key: "lessonPlans", icon: BookOpen, href: "/dashboard/lesson-plans" },
  { key: "vision", icon: Camera, href: "/dashboard/vision" },
  { key: "presentations", icon: Presentation, href: "/dashboard/presentations" },
  { key: "search", icon: Search, href: "/dashboard/search" },
  { key: "calendarPlans", icon: CalendarDays, href: "/dashboard/calendar-plans" },
];

/** Hali yozilmagan modullar — pastda, alohida va bosilmaydigan. */
const UPCOMING_MODULES: Array<{ key: "translation"; icon: LucideIcon }> = [
  { key: "translation", icon: Languages },
];
