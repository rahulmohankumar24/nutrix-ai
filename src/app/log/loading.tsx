import { ChatInterfaceSkeleton, Skeleton } from '@/components/skeletons'

export default function LogLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div>
                <Skeleton className="h-5 w-24 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 max-w-2xl mx-auto w-full">
        <ChatInterfaceSkeleton />
      </div>
    </div>
  )
}
