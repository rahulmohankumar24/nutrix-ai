import { Suspense } from "react"
import { RestaurantsList } from "@/components/restaurants-list"

export default function RestaurantsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:px-12">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground mb-1">Nearby Restaurants</h1>
          <p className="text-sm text-muted-foreground">Find meals that match your nutrition goals</p>
        </div>

        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto"></div>
              <p className="mt-3 text-muted-foreground text-sm">Loading...</p>
            </div>
          </div>
        }>
          <RestaurantsList />
        </Suspense>
      </div>
    </main>
  )
}
