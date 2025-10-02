import { Skeleton } from "@/components/ui/skeleton";

export function ProjectCardSkeleton() {
  return (
    <div className="border border-border rounded-lg p-6 space-y-4">
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-2 w-full" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

export function TestCaseSkeleton() {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

export function AlertRuleSkeleton() {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-6 w-12" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 pb-3 border-b border-border">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}
