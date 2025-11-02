import { Badge } from "@/components/ui/badge";
import { getHealthColor } from "@/lib/utils";

interface HealthBadgeProps {
  healthScore: number;
  showScore?: boolean;
}

export function HealthBadge({ healthScore, showScore = false }: HealthBadgeProps) {
  const color = getHealthColor(healthScore);
  
  const colorClasses: Record<string, string> = {
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const labels: Record<string, string> = {
    green: "Healthy",
    yellow: "Warning",
    red: "Critical",
  };

  return (
    <Badge className={colorClasses[color]}>
      {labels[color]}{showScore && ` (${healthScore})`}
    </Badge>
  );
}
