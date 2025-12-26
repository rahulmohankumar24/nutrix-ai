interface NutritionStat {
  label: string
  current: number
  target: number
  unit: string
}

interface NutritionStatsCardsProps {
  protein?: NutritionStat
  fat?: NutritionStat
  carbs?: NutritionStat
  calories?: NutritionStat
}

export function NutritionStatsCards({
  protein = { label: "Protein", current: 92, target: 140, unit: "g" },
  fat = { label: "Fat", current: 48, target: 75, unit: "g" },
  carbs = { label: "Carbs", current: 180, target: 280, unit: "g" },
  calories = { label: "Calories", current: 1450, target: 2700, unit: "" },
}: NutritionStatsCardsProps) {
  const renderStatRow = (stat: NutritionStat) => {
    const percentage = (stat.current / stat.target) * 100

    return (
      <div key={stat.label} className="flex flex-1 items-center justify-between gap-4 py-3">
        <div className="flex-1">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</p>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-baseline gap-1 tabular-nums">
          <span className="text-lg font-semibold text-foreground">
            {stat.current}
            {stat.unit}
          </span>
          <span className="text-sm text-muted-foreground">
            / {stat.target}
            {stat.unit}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-2xl bg-card border border-border p-5">
      <h3 className="mb-3 text-lg font-semibold text-foreground">Today's Goals</h3>
      <div className="flex flex-1 flex-col justify-between divide-y divide-border">
        {renderStatRow(protein)}
        {renderStatRow(fat)}
        {renderStatRow(carbs)}
        {renderStatRow(calories)}
      </div>
    </div>
  )
}
