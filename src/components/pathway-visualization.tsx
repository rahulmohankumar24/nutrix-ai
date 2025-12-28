import { Sparkles } from 'lucide-react'

interface MealData {
  time: string
  percentage: number
  isCurrent?: boolean
  isCompleted?: boolean
  macros?: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
}

interface InsightsData {
  status: 'on_track' | 'needs_attention' | 'great_job'
  headline: string
  insights: string[]
  loading?: boolean
}

interface PathwayVisualizationProps {
  dailyData?: MealData[]
  insights?: InsightsData
}

export function PathwayVisualization({
  dailyData = [
    { time: "Breakfast", percentage: 0, isCurrent: true },
    { time: "Lunch", percentage: 0 },
    { time: "Dinner", percentage: 0 },
  ],
  insights,
}: PathwayVisualizationProps) {
  const data = dailyData

  // Keep consistent, pleasant purple color for insights
  const insightColor = 'text-purple-500'
  const insightBgColor = 'bg-purple-500/10'

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <p className="text-base text-muted-foreground tracking-wide">your path today</p>
      </div>

      {/* AI Insights */}
      {insights && (
        <div className={`rounded-xl p-4 mb-5 ${insightBgColor}`}>
          {insights.loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-full bg-muted rounded" />
              <div className="h-3 w-3/4 bg-muted rounded" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className={`h-4 w-4 ${insightColor}`} />
                <span className={`text-sm font-semibold ${insightColor}`}>
                  {insights.headline}
                </span>
              </div>
              <ul className="space-y-1">
                {insights.insights.map((insight, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-muted-foreground/40 mt-0.5">•</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Vertical Pathway */}
      <div className="relative flex-1">
        {/* Vertical connecting line */}
        <div className="absolute left-5 top-5 bottom-5 w-px">
          <div className={`h-1/2 ${data[0]?.isCompleted ? 'bg-primary/40' : 'bg-border'}`} />
          <div className={`h-1/2 ${data[1]?.isCompleted ? 'bg-primary/40' : 'bg-border'}`} />
        </div>

        {/* Meal items stacked vertically */}
        <div className="relative flex flex-col justify-between h-full">
          {data.map((meal, index) => {
            const isCompleted = meal.isCompleted
            const isCurrent = meal.isCurrent

            return (
              <div key={index} className="flex items-center gap-4">
                {/* Circle */}
                <div
                  className={`
                    relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                    transition-all duration-300
                    ${isCompleted
                      ? 'bg-primary'
                      : isCurrent
                        ? 'bg-card ring-2 ring-primary'
                        : 'bg-muted/50'
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className={`text-sm font-semibold ${isCurrent ? 'text-primary' : 'text-muted-foreground/40'}`}>
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Label and Macros */}
                <div className="flex-1 min-w-0">
                  <p className={`text-base font-medium ${
                    isCompleted ? 'text-primary' : isCurrent ? 'text-foreground' : 'text-muted-foreground/50'
                  }`}>
                    {meal.time}
                  </p>

                  {/* Macros in a row */}
                  <div className="mt-1">
                    {meal.macros && meal.macros.calories > 0 ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                        <span>
                          <span className="text-muted-foreground">{meal.macros.calories}</span>
                          <span className="text-muted-foreground/60 ml-0.5">cal</span>
                        </span>
                        <span>
                          <span className="text-primary font-medium">{meal.macros.protein}g</span>
                          <span className="text-muted-foreground/60 ml-0.5">pro</span>
                        </span>
                        <span>
                          <span className="text-muted-foreground">{meal.macros.carbs}g</span>
                          <span className="text-muted-foreground/60 ml-0.5">carb</span>
                        </span>
                        <span>
                          <span className="text-muted-foreground">{meal.macros.fat}g</span>
                          <span className="text-muted-foreground/60 ml-0.5">fat</span>
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground/40">
                        {isCurrent ? "up next" : "—"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
