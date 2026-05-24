import { SkeletonBlock, SkeletonText } from "@/components/ui";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite" aria-label="Loading workspace insights">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="glass-panel flex flex-col gap-3 px-5 py-4">
            <SkeletonBlock className="h-3 w-1/3" />
            <SkeletonBlock className="h-8 w-2/5" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel px-5 py-5">
          <SkeletonBlock className="h-4 w-1/4" />
          <div className="mt-4 space-y-3">
            <SkeletonText lines={4} />
          </div>
        </div>
        <div className="glass-panel px-5 py-5">
          <SkeletonBlock className="h-4 w-1/3" />
          <div className="mt-4 space-y-3">
            <SkeletonText lines={4} />
          </div>
        </div>
      </div>
    </div>
  );
}
