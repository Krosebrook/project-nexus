import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import type { Project } from "~backend/projects/types";
import { EnhancedProjectCard } from "./EnhancedProjectCard";
import { ProjectDetailModal } from "./ProjectDetailModal";
import { ProjectFilters, type ViewMode, type StatusFilter, type SortOption } from "./ProjectFilters";
import { 
  generateHistoricalData, 
  simulateMetricUpdate, 
  getHealthStatus,
  formatLastUpdated,
  type HistoricalMetrics 
} from "@/lib/metrics-utils";
import { RefreshCw, FolderOpen, Search } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { SkeletonCard } from "./SkeletonCard";
import { cn } from "@/lib/utils";

interface EnhancedProjectsTabProps {
  projects: Project[];
  onProjectUpdate: () => void;
  isLoading?: boolean;
  onCreateProject?: () => void;
}

export function EnhancedProjectsTab({ projects, onProjectUpdate, isLoading = false, onCreateProject }: EnhancedProjectsTabProps) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [enhancedProjects, setEnhancedProjects] = useState<Project[]>(projects);
  const [historicalMetrics, setHistoricalMetrics] = useState<Map<number, HistoricalMetrics>>(new Map());
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  
  useEffect(() => {
    const metrics = new Map<number, HistoricalMetrics>();
    projects.forEach(project => {
      metrics.set(project.id, generateHistoricalData(24));
    });
    setHistoricalMetrics(metrics);
    setEnhancedProjects(projects);
  }, [projects]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setIsRefreshing(true);
      
      setEnhancedProjects(prev => prev.map(project => {
        const currentLatency = project.metrics.avg_response_time || 200;
        const currentErrorRate = project.metrics.error_rate || 0.5;
        const currentUptime = project.metrics.uptime_pct || 99.5;
        
        const newLatency = simulateMetricUpdate(currentLatency, 200, 10);
        const newErrorRate = simulateMetricUpdate(currentErrorRate, 0.5, 0.1);
        const newUptime = Math.min(100, currentUptime + (Math.random() * 0.1));
        
        const newProject = {
          ...project,
          metrics: {
            ...project.metrics,
            avg_response_time: newLatency,
            error_rate: newErrorRate,
            uptime_pct: newUptime
          },
          last_activity: new Date()
        };
        
        setHistoricalMetrics(prev => {
          const projectMetrics = prev.get(project.id);
          if (projectMetrics) {
            const now = Date.now();
            projectMetrics.latency.push({ timestamp: now, value: newLatency });
            projectMetrics.errorRate.push({ timestamp: now, value: newErrorRate });
            projectMetrics.uptime.push({ timestamp: now, value: newUptime });
            
            if (projectMetrics.latency.length > 168) {
              projectMetrics.latency.shift();
              projectMetrics.errorRate.shift();
              projectMetrics.uptime.shift();
            }
          }
          return new Map(prev);
        });
        
        return newProject;
      }));
      
      setLastUpdated(0);
      setTimeout(() => setIsRefreshing(false), 300);
    }, 15000);
    
    const timer = setInterval(() => {
      setLastUpdated(prev => prev + 1);
    }, 1000);
    
    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, []);
  
  const filteredAndSortedProjects = useMemo(() => {
    let filtered = enhancedProjects;
    
    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(p => {
        const health = getHealthStatus(
          p.metrics.error_rate || 0,
          p.metrics.uptime_pct || 0,
          p.metrics.avg_response_time || 0
        );
        return health === statusFilter;
      });
    }
    
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "lastDeployed":
          return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
        case "status":
          return a.status.localeCompare(b.status);
        case "latency":
          return (b.metrics.avg_response_time || 0) - (a.metrics.avg_response_time || 0);
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [enhancedProjects, searchQuery, statusFilter, sortBy]);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <ProjectFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>
      
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>{filteredAndSortedProjects.length} projects</span>
          {filteredAndSortedProjects.length !== enhancedProjects.length && (
            <Badge variant="secondary" className="text-xs">
              {enhancedProjects.length - filteredAndSortedProjects.length} hidden
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw className={cn(
            "h-3 w-3",
            isRefreshing && "animate-spin"
          )} />
          <span>Last updated: {formatLastUpdated(lastUpdated)}</span>
        </div>
      </div>
      
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : enhancedProjects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Create your first project to get started with deployment tracking and monitoring."
          action={onCreateProject ? {
            label: "Create Project",
            onClick: onCreateProject
          } : undefined}
        />
      ) : filteredAndSortedProjects.length === 0 ? (
        <EmptyState
          icon={Search}
          title={`No results found${searchQuery ? ` for "${searchQuery}"` : ""}`}
          description="Try adjusting your search or filter criteria."
          action={{
            label: "Clear Filters",
            onClick: () => {
              setSearchQuery("");
              setStatusFilter("all");
            }
          }}
        />
      ) : (
        <div className={cn(
          viewMode === "grid" 
            ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            : "flex flex-col gap-3"
        )}>
          {filteredAndSortedProjects.map((project) => {
            const metrics = historicalMetrics.get(project.id);
            return (
              <EnhancedProjectCard
                key={project.id}
                project={project}
                latencyData={metrics?.latency || []}
                errorRateData={metrics?.errorRate || []}
                onSelect={setSelectedProject}
                isSelected={selectedProject?.id === project.id}
              />
            );
          })}
        </div>
      )}
      
      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          latencyData={historicalMetrics.get(selectedProject.id)?.latency || []}
          errorRateData={historicalMetrics.get(selectedProject.id)?.errorRate || []}
          uptimeData={historicalMetrics.get(selectedProject.id)?.uptime || []}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
}