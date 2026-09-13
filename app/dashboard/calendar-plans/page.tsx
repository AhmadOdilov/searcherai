import { getTranslations } from "next-intl/server";
import { CalendarDays, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listCalendarPlans } from "@/lib/calendar-plans/service";
import { CalendarPlanList } from "@/components/calendar-plans/plan-list";
import { PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpLink } from "@/components/ui/help-link";
import { PAGE_SIZE } from "@/lib/ui/pagination";

/** `/dashboard/calendar-plans` — kalendar rejalar ro'yxati. */
export default async function CalendarPlansPage() {
  const user = (await getCurrentUser())!;
  const { items, nextCursor } = await listCalendarPlans(user.id, {
    limit: PAGE_SIZE,
  });

  const t = await getTranslations("calendarPlans");
  const tRoot = await getTranslations();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <PageHeader
        title={t("title")}
        // Har sahifada bitta jumla: bu yerda nima qilinadi.
        description={t("pageHint")}
        action={
          <LinkButton
            href="/dashboard/calendar-plans/new"
            size="lg"
            icon={<Plus aria-hidden className="size-5" />}
          >
            {t("new.submit")}
          </LinkButton>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<CalendarDays aria-hidden className="size-9" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <LinkButton href="/dashboard/calendar-plans/new" size="lg">
              {tRoot("common.start")}
            </LinkButton>
          }
        />
      ) : (
        <>
          <p className="mt-6 text-base text-neutral-600">
            {t("count", { count: items.length })}
          </p>
          <CalendarPlanList initialItems={items} initialCursor={nextCursor} />
        </>
      )}

      <div className="mt-10 flex justify-center border-t border-neutral-200 pt-6">
        <HelpLink />
      </div>
    </div>
  );
}
