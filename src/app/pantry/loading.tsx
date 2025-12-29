import { PantryItemSkeleton, Skeleton } from '@/components/skeletons'

export default function PantryLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div>
                <Skeleton className="h-7 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Search bar */}
        <Skeleton className="h-12 w-full rounded-xl" />

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Pantry items */}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <PantryItemSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  )
}
