import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStatusColor } from "@/lib/deployment-data";
import type { Deployment } from "@/lib/deployment-data";

interface DeploymentTimelineProps {
  deployments: Deployment[];
  onSelectDeployment: (deployment: Deployment) => void;
}

export function DeploymentTimeline({ deployments, onSelectDeployment }: DeploymentTimelineProps) {
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return date;
  });

  const projectNames = [...new Set(deployments.map(d => d.projectName))];

  const getDeploymentsForDateAndProject = (date: Date, projectName: string) => {
    return deployments.filter(d => {
      const deployDate = new Date(d.timestamp);
      return (
        deployDate.toDateString() === date.toDateString() &&
        d.projectName === projectName
      );
    });
  };

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case "success": return "bg-green-500";
      case "failed": return "bg-red-500";
      case "in_progress": return "bg-yellow-500";
      case "rolled_back": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployment Timeline (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="flex gap-1 mb-4 text-xs text-muted-foreground">
              <div className="w-40 flex-shrink-0"></div>
              {last30Days.map((date, i) => (
                <div key={i} className="flex-1 text-center min-w-[24px]">
                  {i % 5 === 0 ? date.getDate() : ""}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {projectNames.slice(0, 8).map(projectName => (
                <div key={projectName} className="flex gap-1 items-center">
                  <div className="w-40 flex-shrink-0 text-sm font-medium truncate pr-2">
                    {projectName}
                  </div>
                  {last30Days.map((date, i) => {
                    const deploymentsOnDate = getDeploymentsForDateAndProject(date, projectName);
                    return (
                      <div key={i} className="flex-1 min-w-[24px] h-8 flex items-center justify-center">
                        {deploymentsOnDate.length > 0 ? (
                          <div className="relative group">
                            <button
                              onClick={() => onSelectDeployment(deploymentsOnDate[0])}
                              className={`w-3 h-3 rounded-full ${getStatusDotColor(deploymentsOnDate[0].status)} hover:scale-150 transition-transform cursor-pointer`}
                            />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                              <div className="bg-popover text-popover-foreground text-xs rounded-md shadow-lg p-2 whitespace-nowrap border">
                                <div className="font-semibold">{deploymentsOnDate[0].projectName}</div>
                                <div className="text-muted-foreground">{deploymentsOnDate[0].version}</div>
                                <div className={getStatusColor(deploymentsOnDate[0].status)}>
                                  {deploymentsOnDate[0].status}
                                </div>
                                <div className="text-muted-foreground">
                                  {Math.floor(deploymentsOnDate[0].duration / 60)}m {deploymentsOnDate[0].duration % 60}s
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-1 h-1 bg-muted rounded-full" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Success</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-muted-foreground">Failed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-muted-foreground">In Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">Rolled Back</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}