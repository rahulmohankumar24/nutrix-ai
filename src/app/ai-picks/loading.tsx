import { MealSuggestionsGridSkeleton, Skeleton } from '@/components/skeletons'

export default function AIPicksLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-100 to-blue-50 border-b border-sky-200/50">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div>
                <Skeleton className="h-7 w-40 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-48 rounded-xl" />
              <Skeleton className="h-10 w-24 rounded-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Target display skeleton */}
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="p-4 rounded-xl border border-sky-200 bg-sky-50 animate-pulse">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-6 w-16 rounded" />
          </div>
          <Skeleton className="h-5 w-72" />
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <MealSuggestionsGridSkeleton count={9} />
      </main>
    </div>
  )
}
