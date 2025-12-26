interface DayData {
  label: string
  dayName: string
  calories: number
  caloriesTarget: number
  protein: number
  proteinTarget: number
  summary: string
  isCurrent?: boolean
}

interface WeekSummaryProps {
  days?: DayData[]
}

export function WeekSummary({
  days = [
    {
      label: "Mon",
      dayName: "Monday",
      calories: 2450,
      caloriesTarget: 2700,
      protein: 125,
      proteinTarget: 140,
      summary: "Strong day",
    },
    {
      label: "Tue",
      dayName: "Tuesday",
      calories: 2100,
      caloriesTarget: 2700,
      protein: 98,
      proteinTarget: 140,
      summary: "Light on protein",
    },
    {
      label: "Wed",
      dayName: "Wednesday",
      calories: 2680,
      caloriesTarget: 2700,
      protein: 142,
      proteinTarget: 140,
      summary: "Excellent balance",
    },
    {
      label: "Thu",
      dayName: "Thursday",
      calories: 1850,
      caloriesTarget: 2700,
      protein: 88,
      proteinTarget: 140,
      summary: "Under target",
    },
    {
      label: "Fri",
      dayName: "Friday",
      calories: 2300,
      caloriesTarget: 2700,
      protein: 110,
      proteinTarget: 140,
      summary: "Good effort",
    },
    {
      label: "Sat",
      dayName: "Saturday",
      calories: 2550,
      caloriesTarget: 2700,
      protein: 135,
      proteinTarget: 140,
      summary: "Well balanced",
    },
    {
      label: "Sun",
      dayName: "Sunday",
      calories: 1450,
      caloriesTarget: 2700,
      protein: 92,
      proteinTarget: 140,
      summary: "In progress",
      isCurrent: true,
    },
  ],
}: WeekSummaryProps) {
  const primaryColor = "hsl(140, 35%, 55%)"
  const belowTargetColor = "hsl(45, 90%, 50%)"

  const getCaloriePercentage = (day: DayData) => (day.calories / day.caloriesTarget) * 100
  const getProteinPercentage = (day: DayData) => (day.protein / day.proteinTarget) * 100

  const weeklyCalories = days.reduce((sum, day) => sum + day.calories, 0)
  const weeklyProtein = days.reduce((sum, day) => sum + day.protein, 0)
  const weeklyCaloriesTarget = days.reduce((sum, day) => sum + day.caloriesTarget, 0)
  const weeklyProteinTarget = days.reduce((sum, day) => sum + day.proteinTarget, 0)

  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">This Week</h2>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{weeklyCalories.toLocaleString()}</span> /{" "}
            {weeklyCaloriesTarget.toLocaleString()} cal
          </span>
          <span>
            <span className="font-medium text-foreground">{weeklyProtein}g</span> / {weeklyProteinTarget}g protein
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          const calPercent = Math.min(getCaloriePercentage(day), 100)
          const protPercent = Math.min(getProteinPercentage(day), 100)
          const avgPercent = (calPercent + protPercent) / 2
          const isGood = avgPercent >= 80

          return (
            <div
              key={index}
              className={`
                rounded-lg p-3 text-center transition-all
                ${day.isCurrent ? "bg-muted/50 ring-1 ring-primary/30" : "hover:bg-muted/30"}
              `}
            >
              <p className={`text-xs font-medium mb-2 ${day.isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                {day.label}
              </p>

              {/* Circular progress indicator */}
              <div className="relative mx-auto mb-2 h-14 w-14">
                <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e5e5" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke={isGood ? primaryColor : belowTargetColor}
                    strokeWidth="3"
                    strokeDasharray={`${avgPercent * 0.88} 88`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-foreground">
                  {Math.round(avgPercent)}%
                </span>
              </div>

              <div className="text-xs text-muted-foreground">
                <p>{day.calories.toLocaleString()}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: primaryColor }} />
          <span>On track</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: belowTargetColor }} />
          <span>Below target</span>
        </div>
      </div>
    </div>
  )
}
