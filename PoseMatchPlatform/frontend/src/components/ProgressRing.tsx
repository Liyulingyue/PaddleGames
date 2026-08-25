import { cn } from '@/lib/utils'

interface ProgressRingProps {
  percent: number
  size?: number
  strokeWidth?: number
  className?: string
}

export default function ProgressRing({
  percent,
  size = 120,
  strokeWidth = 8,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percent / 100) * circumference

  const getColor = () => {
    if (percent >= 80) return '#22c55e'
    if (percent >= 50) return '#eab308'
    return '#ef4444'
  }

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-300 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-2xl font-bold"
          style={{ color: getColor() }}
        >
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  )
}
