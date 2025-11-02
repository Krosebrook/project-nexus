import { formatNumber, formatPercentage } from "@/lib/utils";

interface MetricDisplayProps {
  label: string;
  value: number;
  unit?: "ms" | "%" | "number";
  thresholds?: {
    good: number;
    warning: number;
  };
  reverse?: boolean;
}

export function MetricDisplay({ 
  label, 
  value, 
  unit = "number",
  thresholds,
  reverse = false
}: MetricDisplayProps) {
  const getColor = () => {
    if (!thresholds) return "text-foreground";
    
    const { good, warning } = thresholds;
    
    if (reverse) {
      if (value <= good) return "text-green-400";
      if (value <= warning) return "text-yellow-400";
      return "text-red-400";
    } else {
      if (value >= good) return "text-green-400";
      if (value >= warning) return "text-yellow-400";
      return "text-red-400";
    }
  };

  const formatValue = () => {
    switch (unit) {
      case "ms":
        return `${formatNumber(value)}ms`;
      case "%":
        return formatPercentage(value);
      default:
        return formatNumber(value);
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-lg font-semibold ${getColor()}`}>
        {formatValue()}
      </p>
    </div>
  );
}
