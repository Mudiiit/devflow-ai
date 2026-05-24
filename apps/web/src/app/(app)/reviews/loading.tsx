import { SkeletonBlock, SkeletonText } from "@/components/ui";

export default function ReviewsLoading() {
  return (
    <div className="glass-panel px-5 py-5" role="status" aria-live="polite" aria-label="Loading reviews">
      <SkeletonBlock className="h-4 w-1/4" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-panel)]/55 px-4 py-4">
            <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <SkeletonBlock className="h-3 w-1/2" />
                <SkeletonBlock className="mt-2 h-3 w-1/4" />
                <div className="mt-3 max-w-72">
                  <SkeletonText lines={2} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <SkeletonBlock className="h-6 w-20 rounded-full" />
                <SkeletonBlock className="h-6 w-16 rounded-full" />
                <SkeletonBlock className="h-6 w-18 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
