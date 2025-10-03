import { useEffect, useState } from "react";

export function useCountUp(
  targetValue: number,
  duration: number = 500
): number {
  const [displayValue, setDisplayValue] = useState(targetValue);
  
  useEffect(() => {
    const startValue = displayValue;
    const difference = targetValue - startValue;
    const startTime = Date.now();
    
    if (Math.abs(difference) < 0.01) return;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOutQuad = 1 - Math.pow(1 - progress, 2);
      const currentValue = startValue + difference * easeOutQuad;
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [targetValue]);
  
  return displayValue;
}