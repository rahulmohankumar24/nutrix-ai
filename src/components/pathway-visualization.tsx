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

interface PathwayVisualizationProps {
  dailyData?: MealData[]
}

export function PathwayVisualization({
  dailyData = [
    { time: "Breakfast", percentage: 0, isCurrent: true },
    { time: "Lunch", percentage: 0 },
    { time: "Dinner", percentage: 0 },
  ],
}: PathwayVisualizationProps) {
  const data = dailyData

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <p className="text-base text-muted-foreground tracking-wide">your path today</p>
      </div>

      {/* Pathway with line through middle */}
      <div className="relative">
        {/* Connecting line - goes through middle of circles */}
        <div className="absolute top-6 left-0 right-0 flex items-center px-6">
          <div className="w-6" /> {/* Spacer for first circle */}
          <div className={`flex-1 h-px rounded-full ${data[0]?.isCompleted ? 'bg-primary/40' : 'bg-border'}`} />
          <div className="w-12" /> {/* Spacer for middle circle */}
          <div className={`flex-1 h-px rounded-full ${data[1]?.isCompleted ? 'bg-primary/40' : 'bg-border'}`} />
          <div className="w-6" /> {/* Spacer for last circle */}
        </div>

        {/* Circles and labels */}
        <div className="relative flex items-start justify-between w-full">
          {data.map((meal, index) => {
            const isCompleted = meal.isCompleted
            const isCurrent = meal.isCurrent

            return (
              <div key={index} className="flex flex-col items-center flex-1">
                {/* Circle */}
                <div
                  className={`
                    relative z-10 w-12 h-12 rounded-full flex items-center justify-center
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
                    <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className={`text-base font-semibold ${isCurrent ? 'text-primary' : 'text-muted-foreground/40'}`}>
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Label */}
                <div className="mt-3 text-center">
                  <p className={`text-base font-medium ${
                    isCompleted ? 'text-primary' : isCurrent ? 'text-foreground' : 'text-muted-foreground/50'
                  }`}>
                    {meal.time}
                  </p>

                  {/* All Macros */}
                  <div className="mt-1.5">
                    {meal.macros && meal.macros.calories > 0 ? (
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-sm">
                        <div className="text-right">
                          <span className="text-muted-foreground">{meal.macros.calories}</span>
                          <span className="text-muted-foreground/60 ml-0.5">cal</span>
                        </div>
                        <div className="text-left">
                          <span className="text-primary font-medium">{meal.macros.protein}g</span>
                          <span className="text-muted-foreground/60 ml-0.5">pro</span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground">{meal.macros.carbs}g</span>
                          <span className="text-muted-foreground/60 ml-0.5">carb</span>
                        </div>
                        <div className="text-left">
                          <span className="text-muted-foreground">{meal.macros.fat}g</span>
                          <span className="text-muted-foreground/60 ml-0.5">fat</span>
                        </div>
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
