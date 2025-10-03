import { lazy } from "react";

export const LazyProjectDetailModal = lazy(() => 
  import("@/components/ProjectDetailModal").then(m => ({ default: m.ProjectDetailModal }))
);

export const LazyDeploymentDetailsModal = lazy(() => 
  import("@/components/DeploymentDetailsModal").then(m => ({ default: m.DeploymentDetailsModal }))
);

export const LazyTestDetailsModal = lazy(() => 
  import("@/components/TestDetailsModal").then(m => ({ default: m.TestDetailsModal }))
);

export const LazyDocsPanel = lazy(() => 
  import("@/components/DocsPanel").then(m => ({ default: m.DocsPanel }))
);

export const LazyLogsModal = lazy(() => 
  import("@/components/LogsModal").then(m => ({ default: m.LogsModal }))
);