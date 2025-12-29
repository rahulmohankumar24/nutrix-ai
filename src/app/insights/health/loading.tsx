import { InsightCardSkeleton, Skeleton } from '@/components/skeletons'

export default function HealthInsightsLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-100">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div>
              <Skeleton className="h-7 w-40 mb-2" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Health score */}
        <div className="p-6 rounded-xl border border-border bg-card animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>

        {/* Nutrition insights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-border bg-card animate-pulse text-center">
              <Skeleton className="h-10 w-10 mx-auto mb-2 rounded-full" />
              <Skeleton className="h-4 w-20 mx-auto" />
            </div>
          ))}
        </div>

        {/* Recommendations */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          {[1, 2, 3].map((i) => (
            <InsightCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  )
}
