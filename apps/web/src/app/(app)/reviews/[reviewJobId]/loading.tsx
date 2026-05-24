import { SkeletonBlock, SkeletonText } from "@/components/ui";

export default function ReviewDetailLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite" aria-label="Loading review details">
      <div className="glass-panel px-5 py-5">
        <SkeletonBlock className="h-4 w-1/4" />
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-6 w-24 rounded-full" />
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-9 w-full" />
          ))}
        </div>
      </div>

      <div className="glass-panel px-5 py-5">
        <SkeletonBlock className="h-4 w-1/5" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3">
              <SkeletonText lines={3} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
