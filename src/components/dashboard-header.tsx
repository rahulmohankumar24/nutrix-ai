interface DashboardHeaderProps {
  userName?: string
  message?: string
  progressPercentage?: number
}

export function DashboardHeader({
  userName = "Sarah",
  message = "Steady momentum today",
  progressPercentage = 65,
}: DashboardHeaderProps) {
  const radius = 40
  const strokeWidth = 8
  const normalizedRadius = radius - strokeWidth / 2
  const circumference = normalizedRadius * Math.PI // Half circle
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference

  return (
    <div className="flex items-end justify-between gap-8">
      <h1 className="text-5xl font-bold tracking-tight text-foreground">
        Good afternoon, <span className="font-bold">{userName}</span>
      </h1>

      <div className="flex flex-col items-center gap-1">
        <div className="relative">
          <svg height={radius + strokeWidth} width={radius * 2 + strokeWidth} className="transform">
            {/* Background arc */}
            <path
              d={`M ${strokeWidth / 2} ${radius + strokeWidth / 2} A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${radius * 2 + strokeWidth / 2} ${radius + strokeWidth / 2}`}
              fill="none"
              stroke="#e5e5e5"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            <path
              d={`M ${strokeWidth / 2} ${radius + strokeWidth / 2} A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${radius * 2 + strokeWidth / 2} ${radius + strokeWidth / 2}`}
              fill="none"
              stroke="hsl(140, 35%, 55%)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          {/* Percentage in center */}
          <div className="absolute inset-0 flex items-end justify-center pb-1">
            <span className="text-xl font-bold text-foreground">{progressPercentage}%</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
