import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertTriangle, 
  Wifi, 
  WifiOff,
  Pause,
  Timer
} from "lucide-react"

interface StatusBadgeProps {
  status: string
  variant?: "default" | "with-icon"
  className?: string
}

export function StatusBadge({ status, variant = "default", className }: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    const normalizedStatus = status.toLowerCase()
    
    switch (normalizedStatus) {
      case "active":
      case "activated":
      case "connected":
      case "online":
      case "completed":
        return {
          variant: "default" as const,
          className: "status-active",
          icon: variant === "with-icon" ? CheckCircle : null,
          text: "Active"
        }
      
      case "inactive":
      case "not_activated":
      case "not_active":
      case "offline":
        return {
          variant: "secondary" as const,
          className: "status-inactive",
          icon: variant === "with-icon" ? WifiOff : null,
          text: "Inactive"
        }
      
      case "suspended":
      case "blocked":
        return {
          variant: "outline" as const,
          className: "status-warning",
          icon: variant === "with-icon" ? Pause : null,
          text: "Suspended"
        }
      
      case "expired":
        return {
          variant: "destructive" as const,
          className: "status-error",
          icon: variant === "with-icon" ? Timer : null,
          text: "Expired"
        }
      
      case "pending":
      case "processing":
        return {
          variant: "outline" as const,
          className: "status-warning",
          icon: variant === "with-icon" ? Clock : null,
          text: "Processing"
        }
      
      case "failed":
      case "cancelled":
      case "error":
        return {
          variant: "destructive" as const,
          className: "status-error",
          icon: variant === "with-icon" ? XCircle : null,
          text: "Failed"
        }
      
      default:
        return {
          variant: "outline" as const,
          className: "bg-gray-100 text-gray-800 border-gray-200",
          icon: variant === "with-icon" ? AlertTriangle : null,
          text: status.charAt(0).toUpperCase() + status.slice(1)
        }
    }
  }

  const config = getStatusConfig(status)
  const Icon = config.icon

  return (
    <Badge 
      variant={config.variant}
      className={cn(
        "flex items-center gap-1.5 font-medium transition-all",
        config.className,
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {config.text}
    </Badge>
  )
}

export function StatusDot({ status, className }: { status: string; className?: string }) {
  const getColor = (status: string) => {
    const normalizedStatus = status.toLowerCase()
    
    switch (normalizedStatus) {
      case "active":
      case "activated":
      case "connected":
      case "online":
      case "completed":
        return "bg-green-500"
      
      case "inactive":
      case "not_activated":
      case "not_active":
      case "offline":
        return "bg-blue-500"
      
      case "suspended":
      case "blocked":
        return "bg-orange-500"
      
      case "expired":
        return "bg-red-500"
      
      case "pending":
      case "processing":
        return "bg-yellow-500 animate-pulse"
      
      case "failed":
      case "cancelled":
      case "error":
        return "bg-red-500"
      
      default:
        return "bg-gray-500"
    }
  }

  return (
    <div 
      className={cn(
        "w-2 h-2 rounded-full",
        getColor(status),
        className
      )}
    />
  )
}