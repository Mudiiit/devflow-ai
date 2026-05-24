import { SkeletonBlock, SkeletonText } from "@/components/ui";

export default function ReviewsLoading() {
  return (
    <div className="glass-panel px-5 py-5" role="status" aria-live="polite" aria-label="Loading reviews">
      <SkeletonBlock className="h-4 w-1/4" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3">
            <SkeletonBlock className="h-3 w-1/2" />
            <div className="mt-3">
              <SkeletonText lines={2} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
