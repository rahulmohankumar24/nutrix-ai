interface MealData {
  time: string
  percentage: number
  isCurrent?: boolean
  isCompleted?: boolean
  details?: {
    items: string[]
    summary?: string
  }
}

interface PathwayVisualizationProps {
  title?: string
  dailyData?: MealData[]
}

export function PathwayVisualization({
  title = "Today's Journey",
  dailyData = [
    {
      time: "Breakfast",
      percentage: 85,
      isCompleted: true,
      details: {
        items: ["Oatmeal with berries", "Greek yogurt", "Black coffee"],
        summary: "Great protein start",
      },
    },
    {
      time: "Lunch",
      percentage: 72,
      isCompleted: true,
      details: {
        items: ["Grilled chicken salad", "Whole grain bread", "Apple"],
        summary: "Could use more carbs",
      },
    },
    {
      time: "Dinner",
      percentage: 0,
      isCurrent: true,
      details: {
        items: [],
        summary: "Not yet logged",
      },
    },
  ],
}: PathwayVisualizationProps) {
  const data = dailyData

  const svgHeight = 280
  const pathWidth = 80
  const waveAmplitude = 30

  const primaryColor = "hsl(140, 35%, 55%)"

  const getOpacity = (percentage: number) => {
    return 0.4 + (percentage / 100) * 0.6
  }

  const calculatePath = () => {
    const points = data.length
    const segmentHeight = svgHeight / (points - 1)
    const centerX = pathWidth / 2

    let path = `M ${centerX} 10`

    for (let i = 1; i < points; i++) {
      const y = 10 + i * segmentHeight
      const prevY = 10 + (i - 1) * segmentHeight
      const midY = prevY + segmentHeight / 2

      const waveOffset = i % 2 === 0 ? -waveAmplitude : waveAmplitude
      const controlX = centerX + waveOffset

      path += ` Q ${controlX} ${midY}, ${centerX} ${y}`
    }

    return path
  }

  const calculateProgressPath = () => {
    const currentIndex = data.findIndex((item) => item.isCurrent)
    if (currentIndex === -1) return ""

    const points = currentIndex + 1
    const segmentHeight = svgHeight / (data.length - 1)
    const centerX = pathWidth / 2

    let path = `M ${centerX} 10`

    for (let i = 1; i < points; i++) {
      const y = 10 + i * segmentHeight
      const prevY = 10 + (i - 1) * segmentHeight
      const midY = prevY + segmentHeight / 2

      const waveOffset = i % 2 === 0 ? -waveAmplitude : waveAmplitude
      const controlX = centerX + waveOffset

      path += ` Q ${controlX} ${midY}, ${centerX} ${y}`
    }

    return path
  }

  const calculateStonePosition = (index: number) => {
    const points = data.length
    const segmentHeight = svgHeight / (points - 1)
    const centerX = pathWidth / 2
    const y = 10 + index * segmentHeight

    return { x: centerX, y }
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-5 h-full flex flex-col">
      <h2 className="mb-4 text-lg font-semibold text-foreground">{title}</h2>

      <div className="flex gap-4 flex-1">
        {/* Pathway SVG */}
        <div className="flex-shrink-0" style={{ width: `${pathWidth}px`, height: `${svgHeight + 20}px` }}>
          <svg width={pathWidth} height={svgHeight + 20} viewBox={`0 0 ${pathWidth} ${svgHeight + 20}`}>
            {/* Background pathway */}
            <path d={calculatePath()} fill="none" stroke="#e5e5e5" strokeWidth="18" strokeLinecap="round" />
            {/* Progress pathway */}
            <path
              d={calculateProgressPath()}
              fill="none"
              stroke={primaryColor}
              strokeWidth="18"
              strokeLinecap="round"
            />

            {/* Stone markers */}
            {data.map((item, index) => {
              const position = calculateStonePosition(index)
              const isCurrent = item.isCurrent
              const isCompleted = item.isCompleted

              return (
                <g key={index}>
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={isCurrent ? 7 : 6}
                    fill={
                      isCompleted ? `rgba(60, 60, 60, ${getOpacity(item.percentage)})` : isCurrent ? "#333" : "#ccc"
                    }
                    stroke={isCurrent ? primaryColor : "white"}
                    strokeWidth={isCurrent ? 2 : 1.5}
                  />
                </g>
              )
            })}
          </svg>
        </div>

        {/* Labels and details */}
        <div className="flex flex-1 flex-col justify-between py-1" style={{ height: `${svgHeight + 20}px` }}>
          {data.map((item, index) => {
            const isCurrent = item.isCurrent
            const isCompleted = item.isCompleted

            return (
              <div key={index} className="flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <span
                    className={`
                      text-sm
                      ${isCurrent ? "font-semibold text-foreground" : isCompleted ? "font-medium text-foreground" : "text-muted-foreground"}
                    `}
                  >
                    {item.time}
                  </span>
                  {(isCompleted || isCurrent) && item.percentage > 0 && (
                    <span className="text-xs font-medium text-primary">{item.percentage}%</span>
                  )}
                </div>

                {item.details && (isCompleted || isCurrent) && (
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    {item.details.items.length > 0 && <p className="line-clamp-1">{item.details.items.join(", ")}</p>}
                    {item.details.summary && (
                      <p className={`mt-0.5 ${isCompleted ? "text-foreground font-medium" : "italic"}`}>
                        {item.details.summary}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
