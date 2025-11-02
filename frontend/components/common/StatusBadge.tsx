import { Badge } from "@/components/ui/badge";
import { getStatusColor } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  variant?: "default" | "outline";
}

export function StatusBadge({ status, variant = "default" }: StatusBadgeProps) {
  const color = getStatusColor(status);
  const colorClasses: Record<string, string> = {
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    gray: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };

  return (
    <Badge className={colorClasses[color]} variant={variant}>
      {status}
    </Badge>
  );
}
