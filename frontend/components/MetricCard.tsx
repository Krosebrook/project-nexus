import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
  valueClassName?: string;
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  valueClassName,
}: MetricCardProps) {
  const getTrendColor = (trendValue: number) => {
    if (trendValue > 0) return "text-green-500";
    if (trendValue < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", valueClassName)}>{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <p className={cn("text-xs mt-1", getTrendColor(trend.value))}>
            {trend.value > 0 ? "+" : ""}
            {trend.value}% {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
