"use client"
import { ArrowRight, Star } from "lucide-react"

interface Restaurant {
  name: string
  distance: string
  rating: number
  type: string
  matchScore: number
  goalReason: string
}

interface FoodSuggestionsCardProps {
  onRestaurantClick?: (restaurant: Restaurant) => void
}

export function FoodSuggestionsCard({ onRestaurantClick }: FoodSuggestionsCardProps) {
  const restaurants: Restaurant[] = [
    {
      name: "Fresh & Green",
      distance: "0.3 mi",
      rating: 4.8,
      type: "Salads & Bowls",
      matchScore: 95,
      goalReason: "High protein salads",
    },
    {
      name: "Protein Kitchen",
      distance: "0.5 mi",
      rating: 4.6,
      type: "Healthy Bowls",
      matchScore: 88,
      goalReason: "Low carb options",
    },
    {
      name: "Mediterranean Grill",
      distance: "0.7 mi",
      rating: 4.7,
      type: "Mediterranean",
      matchScore: 82,
      goalReason: "Lean proteins",
    },
    {
      name: "Green Leaf Cafe",
      distance: "0.9 mi",
      rating: 4.5,
      type: "Vegetarian",
      matchScore: 78,
      goalReason: "Light options",
    },
    {
      name: "Poke Paradise",
      distance: "1.1 mi",
      rating: 4.4,
      type: "Hawaiian",
      matchScore: 75,
      goalReason: "Protein-rich bowls",
    },
    {
      name: "The Fit Bowl",
      distance: "1.2 mi",
      rating: 4.6,
      type: "Power Bowls",
      matchScore: 72,
      goalReason: "Balanced macros",
    },
  ]

  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Nearby Restaurants</h3>
        <button className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
          View all <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {restaurants.map((restaurant, index) => (
          <button
            key={index}
            onClick={() => onRestaurantClick?.(restaurant)}
            className="group flex flex-col p-4 rounded-xl border border-border hover:border-primary/30 transition-all text-left"
          >
            <div className="flex items-center justify-between w-full mb-1.5">
              <h4 className="font-medium text-foreground text-sm">{restaurant.name}</h4>
              <span className="text-xs text-primary font-semibold">{restaurant.matchScore}% match</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {restaurant.rating}
              </span>
              <span>•</span>
              <span>{restaurant.distance}</span>
            </div>

            <p className="text-xs text-muted-foreground mt-2">{restaurant.goalReason}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
