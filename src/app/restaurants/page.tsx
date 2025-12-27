import { Suspense } from "react"
import { RestaurantsList } from "@/components/restaurants-list"

export default function RestaurantsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:px-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Nearby Restaurants</h1>
          <p className="text-muted-foreground">Find meals that match your nutrition goals</p>
        </div>

        <Suspense fallback={null}>
          <RestaurantsList />
        </Suspense>
      </div>
    </main>
  )
}
