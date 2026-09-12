import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { listPresentations } from "@/lib/presentations/service";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatFileSize } from "@/lib/ui/labels";

/** `/dashboard/presentations` — prezentatsiyalar ro'yxati. */
export default async function PresentationsPage() {
  const user = (await getCurrentUser())!;
  const { items } = await listPresentations(user.id, { limit: 50 });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Prezentatsiyalar</h1>
          <p className="mt-1 text-sm text-slate-500">
            {items.length === 0
              ? "Hozircha bo'sh."
              : `Jami ${items.length} ta prezentatsiya.`}
          </p>
        </div>
        <Link
          href="/dashboard/presentations/new"
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Yangi yaratish
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-900">
            Birinchi prezentatsiyangizni yarating
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Mavjud dars ishlanmasidan yoki faqat mavzu kiritib — tizim tayyor slaydlarni
            o&apos;zi tuzadi.
          </p>
          <Link
            href="/dashboard/presentations/new"
            className="mt-5 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Boshlash
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/dashboard/presentations/${item.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {item.title ?? item.topic}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[item.subject, item.grade].filter(Boolean).join(" · ") ||
                        "Mustaqil prezentatsiya"}
                      {item.slideCount !== null && ` · ${item.slideCount} slayd`}
                      {item.fileSize !== null && ` · ${formatFileSize(item.fileSize)}`}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>

                {item.lessonPlanId !== null && (
                  <p className="mt-2 text-xs text-slate-400">Dars ishlanmasi asosida</p>
                )}

                {item.status === "FAILED" && item.errorMessage !== null && (
                  <p className="mt-2 text-xs text-red-600">{item.errorMessage}</p>
                )}

                <p className="mt-2 text-xs text-slate-400">
                  {formatDate(item.createdAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
