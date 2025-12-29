/**
 * Reusable skeleton loading components
 */

// Base skeleton with pulse animation
export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} style={style} />
}

// Macro ring skeleton (for dashboard)
export function MacroRingSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-16 w-16 rounded-full bg-muted animate-pulse" />
      <Skeleton className="h-3 w-12" />
      <Skeleton className="h-4 w-8" />
    </div>
  )
}

// Meal card skeleton
export function MealCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-border bg-card animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-12 rounded-md" />
      </div>
      <Skeleton className="h-5 w-3/4 mb-2" />
      <Skeleton className="h-4 w-full mb-3" />
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-2 rounded-lg bg-muted/50">
            <Skeleton className="h-5 w-full mb-1" />
            <Skeleton className="h-3 w-8 mx-auto" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-full rounded-lg" />
    </div>
  )
}

// Meal suggestions grid skeleton
export function MealSuggestionsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <MealCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Dashboard header skeleton
export function DashboardHeaderSkeleton() {
  return (
    <div className="p-6 rounded-2xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        <MacroRingSkeleton />
        <MacroRingSkeleton />
        <MacroRingSkeleton />
        <MacroRingSkeleton />
      </div>
    </div>
  )
}

// Profile card skeleton
export function ProfileCardSkeleton() {
  return (
    <div className="p-6 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Chat message skeleton
export function ChatMessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] p-4 rounded-2xl ${isUser ? 'bg-primary/10' : 'bg-muted'} animate-pulse`}>
        <Skeleton className="h-4 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  )
}

// Chat interface skeleton
export function ChatInterfaceSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-4">
        <ChatMessageSkeleton />
        <ChatMessageSkeleton isUser />
        <ChatMessageSkeleton />
      </div>
      <div className="p-4 border-t border-border">
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  )
}

// Insights card skeleton
export function InsightCardSkeleton() {
  return (
    <div className="p-5 rounded-xl border border-border bg-card animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div>
          <Skeleton className="h-5 w-32 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}

// Weekly chart skeleton
export function WeeklyChartSkeleton() {
  return (
    <div className="p-6 rounded-xl border border-border bg-card">
      <Skeleton className="h-6 w-40 mb-4" />
      <div className="flex items-end justify-between h-40 gap-2">
        {[40, 65, 80, 55, 90, 70, 45].map((height, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <Skeleton className={`w-full rounded-t`} style={{ height: `${height}%` }} />
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Stats row skeleton
export function StatsRowSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="p-4 rounded-xl border border-border bg-card animate-pulse">
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  )
}

// Pantry item skeleton
export function PantryItemSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-border bg-card animate-pulse flex items-center gap-3">
      <Skeleton className="h-12 w-12 rounded-lg" />
      <div className="flex-1">
        <Skeleton className="h-5 w-32 mb-1" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>
  )
}

// Restaurant card skeleton
export function RestaurantCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-border bg-card animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div>
          <Skeleton className="h-5 w-28 mb-1" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  )
}

// Full page loading skeleton wrapper
export function PageLoadingSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}

// Simple centered spinner (for quick loading states)
export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <p className="mt-3 text-muted-foreground text-sm">{message}</p>
    </div>
  )
}

// Meal log list skeleton
export function MealLogListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl border border-border bg-card animate-pulse flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-5 w-40 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="text-right">
            <Skeleton className="h-5 w-16 mb-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}
