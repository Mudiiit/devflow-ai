import { SkeletonBlock, SkeletonText } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite" aria-label="Loading dashboard">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="glass-panel px-4 py-4 sm:px-5 sm:py-4">
            <SkeletonBlock className="h-3 w-1/3" />
            <SkeletonBlock className="mt-3 h-7 w-2/5" />
            <SkeletonBlock className="mt-3 h-3 w-1/2" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="glass-panel px-4 py-4 sm:px-5 sm:py-5">
          <SkeletonBlock className="h-4 w-1/4" />
          <div className="mt-4 grid gap-4 sm:grid-cols-[1.4fr_1fr]">
            <SkeletonBlock className="h-40 w-full rounded-2xl" />
            <div className="space-y-3">
              <SkeletonBlock className="h-16 w-full rounded-2xl" />
              <SkeletonBlock className="h-16 w-full rounded-2xl" />
              <SkeletonBlock className="h-16 w-full rounded-2xl" />
            </div>
          </div>
        </div>

        <div className="glass-panel px-4 py-4 sm:px-5 sm:py-5">
          <SkeletonBlock className="h-4 w-1/3" />
          <div className="mt-4 space-y-3">
            <SkeletonText lines={4} />
          </div>
        </div>
      </div>
    </div>
  );
}
