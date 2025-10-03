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

export const LazyCreateTestModal = lazy(() =>
  import("@/components/CreateTestModal").then(m => ({ default: m.CreateTestModal }))
);

export const LazyRunTestsProgressModal = lazy(() =>
  import("@/components/RunTestsProgressModal").then(m => ({ default: m.RunTestsProgressModal }))
);

export const LazyDeployModal = lazy(() =>
  import("@/components/DeployModal").then(m => ({ default: m.DeployModal }))
);

export const LazyNewDeploymentWizard = lazy(() =>
  import("@/components/NewDeploymentWizard").then(m => ({ default: m.NewDeploymentWizard }))
);

export const LazyIncidentManagement = lazy(() =>
  import("@/components/IncidentManagement").then(m => ({ default: m.IncidentManagement }))
);

export const LazyDependencyGraph = lazy(() =>
  import("@/components/DependencyGraph").then(m => ({ default: m.DependencyGraph }))
);

export const LazySettingsDialog = lazy(() =>
  import("@/components/SettingsDialog").then(m => ({ default: m.SettingsDialog }))
);

export const LazyFirstVisitTour = lazy(() =>
  import("@/components/FirstVisitTour").then(m => ({ default: m.FirstVisitTour }))
);

export const LazyCommandPalette = lazy(() =>
  import("@/components/CommandPalette").then(m => ({ default: m.CommandPalette }))
);