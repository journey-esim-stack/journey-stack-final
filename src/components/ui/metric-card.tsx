import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ReactNode
  trend?: {
    value: number
    label: string
  }
  illustration?: string
  className?: string
  onClick?: () => void
}

export function MetricCard({
  title,
  value,
  description,
  icon,
  trend,
  illustration,
  className,
  onClick
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null
    
    if (trend.value > 0) {
      return <TrendingUp className="h-3 w-3 text-green-600" />
    } else if (trend.value < 0) {
      return <TrendingDown className="h-3 w-3 text-red-600" />
    } else {
      return <Minus className="h-3 w-3 text-gray-600" />
    }
  }

  const getTrendColor = () => {
    if (!trend) return ""
    
    if (trend.value > 0) {
      return "text-green-600"
    } else if (trend.value < 0) {
      return "text-red-600"
    } else {
      return "text-gray-600"
    }
  }

  return (
    <Card 
      className={cn(
        "glass-card hover-glow transition-all duration-300 relative overflow-hidden group",
        onClick && "cursor-pointer hover:scale-105",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2 relative">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          {icon}
          {title}
        </CardTitle>
        {illustration && (
          <img 
            src={illustration} 
            alt={`${title} illustration`}
            className="absolute top-2 right-2 w-16 h-16 opacity-80 group-hover:scale-110 transition-transform duration-300"
          />
        )}
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-bold font-heading">
          {value}
        </div>
        
        {description && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
        
        {trend && (
          <div className="flex items-center gap-1 text-xs">
            {getTrendIcon()}
            <span className={cn("font-medium", getTrendColor())}>
              {Math.abs(trend.value)}%
            </span>
            <span className="text-muted-foreground">
              {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}