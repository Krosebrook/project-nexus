import { useState, useEffect, Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ContextSnapshotFAB } from "@/components/ContextSnapshotPanel";
import { NetworkErrorBanner } from "@/components/NetworkErrorBanner";
import { SkipToContent } from "@/components/SkipToContent";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useNavigation } from "@/hooks/useNavigation";
import { useModals } from "@/hooks/useModals";
import { AppHeader } from "@/components/AppHeader";
import { AppNavigation } from "@/components/AppNavigation";
import { DeploymentToast } from "@/components/DeploymentToast";
import { Toaster } from "@/components/ui/toaster";
import backend from "~backend/client";
import type { Project } from "~backend/projects/types";
import type { ContextSnapshot } from "~backend/snapshots/types";
import {
  LazyEnhancedProjectsTab,
  LazyAutomationTab,
  LazyDeploymentTab,
  LazySettingsTab,
  LazySettingsDialog,
  LazyContextSnapshotPanel,
  LazyDeployModal,
  LazyLogsModal,
  LazyDocsPanel,
  LazyAlertBanner,
  LazyCommandPalette,
  LazyProjectDetailModal,
  LazyFirstVisitTour,
  LazyDatabaseProvisioningTab,
} from "@/lib/lazy-components";

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [criticalProject, setCriticalProject] = useState<Project | null>(null);

  const { activeTab, sidebarOpen, handleTabChange, toggleSidebar, closeSidebar } = useNavigation();
  const {
    settingsOpen,
    setSettingsOpen,
    snapshotPanelOpen,
    setSnapshotPanelOpen,
    deployModalOpen,
    setDeployModalOpen,
    logsModalOpen,
    setLogsModalOpen,
    docsPanelOpen,
    setDocsPanelOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    projectDetailModalOpen,
    setProjectDetailModalOpen,
    closeAllModals,
  } = useModals();

  useEffect(() => {
    loadProjects();
  }, []);

  useKeyboardShortcut([
    { key: 'k', meta: true, callback: () => setCommandPaletteOpen(true) },
    { key: 's', meta: true, callback: () => setSnapshotPanelOpen(true) },
    { key: 'Escape', callback: closeAllModals }
  ]);

  useEffect(() => {
    const critical = projects.find(p => p.status === 'critical');
    setCriticalProject(critical || null);
  }, [projects]);

  const loadProjects = async () => {
    try {
      const { projects } = await backend.projects.list();
      setProjects(projects);
      if (projects.length > 0 && !selectedProject) {
        setSelectedProject(projects[0]);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    handleTabChange("projects");
  };



  const handleCommandAction = (action: string, project?: Project) => {
    const targetProject = project || selectedProject;
    
    switch (action) {
      case 'deploy':
        if (targetProject) {
          setSelectedProject(targetProject);
          setDeployModalOpen(true);
        }
        break;
      case 'save-context':
        setSnapshotPanelOpen(true);
        break;
      case 'view-logs':
        if (targetProject) {
          setSelectedProject(targetProject);
          setLogsModalOpen(true);
        }
        break;
      case 'docs':
        setDocsPanelOpen(true);
        break;
    }
  };

  const handleRestoreSnapshot = (snapshot: ContextSnapshot) => {
    const project = projects.find(p => p.id === snapshot.project_id);
    if (project) {
      setSelectedProject(project);
      handleTabChange('projects');
    }
    if (snapshot.urls.length > 0) {
      snapshot.urls.forEach(url => window.open(url, '_blank'));
    }
  };

  const handleAlertViewDetails = (project: Project) => {
    setSelectedProject(project);
    setProjectDetailModalOpen(true);
  };

  if (loading) {
    return (
      <div className="dark min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-64">
          <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
          <div className="h-4 bg-zinc-800 rounded w-full"></div>
          <div className="h-4 bg-zinc-800 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <SkipToContent />
      <NetworkErrorBanner />
      <Suspense fallback={<div />}>
        <LazyFirstVisitTour />
      </Suspense>
      <div className="dark min-h-screen bg-[#0a0a0a] text-foreground">
        <Suspense fallback={<div />}>
          <LazyAlertBanner project={criticalProject} onViewDetails={handleAlertViewDetails} />
        </Suspense>
        
        <AppHeader sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />

        <div className="flex">
          <aside
            className={`
              fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-black/30 border-r border-zinc-800
              transition-transform duration-300 ease-in-out z-40
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}
            data-tour="projects"
          >
            <AppNavigation activeTab={activeTab} onTabChange={handleTabChange} />
          </aside>

          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-30 lg:hidden"
              onClick={closeSidebar}
            />
          )}

          <main id="main-content" className="flex-1 p-6 lg:p-8" data-tour="dashboard" role="main" aria-label="Main content">
            {activeTab === "dashboard" && (
              <ErrorBoundary>
                <Dashboard projects={projects} onProjectSelect={handleProjectSelect} />
              </ErrorBoundary>
            )}

            {activeTab === "projects" && (
              <ErrorBoundary>
                <Suspense fallback={<TableSkeleton rows={8} />}>
                  <LazyEnhancedProjectsTab
                    projects={projects}
                    onProjectUpdate={loadProjects}
                  />
                </Suspense>
              </ErrorBoundary>
            )}

            {activeTab === "automation" && (
              <ErrorBoundary>
                <Suspense fallback={<TableSkeleton rows={8} />}>
                  {selectedProject ? (
                    <LazyAutomationTab project={selectedProject} />
                  ) : (
                    <div className="text-center text-zinc-500 py-12">
                      Select a project to view automation settings
                    </div>
                  )}
                </Suspense>
              </ErrorBoundary>
            )}

            {activeTab === "deployment" && (
              <ErrorBoundary>
                <Suspense fallback={<TableSkeleton rows={8} />}>
                  {selectedProject ? (
                    <LazyDeploymentTab project={selectedProject} />
                  ) : (
                    <div className="text-center text-zinc-500 py-12">
                      Select a project to view deployment options
                    </div>
                  )}
                </Suspense>
              </ErrorBoundary>
            )}

            {activeTab === "databases" && (
              <ErrorBoundary>
                <Suspense fallback={<TableSkeleton rows={8} />}>
                  <LazyDatabaseProvisioningTab />
                </Suspense>
              </ErrorBoundary>
            )}

            {activeTab === "settings" && (
              <ErrorBoundary>
                <Suspense fallback={<TableSkeleton rows={8} />}>
                  <LazySettingsTab />
                </Suspense>
              </ErrorBoundary>
            )}
          </main>
        </div>

        <Suspense fallback={null}>
          <LazySettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        </Suspense>
        
        <div data-tour="context">
          <Suspense fallback={null}>
            <LazyContextSnapshotPanel
              isOpen={snapshotPanelOpen}
              onClose={() => setSnapshotPanelOpen(false)}
              currentProject={selectedProject}
              onRestore={handleRestoreSnapshot}
            />
          </Suspense>
          
          <ContextSnapshotFAB onClick={() => setSnapshotPanelOpen(true)} />
        </div>
        
        <Suspense fallback={null}>
          <LazyDeployModal
            isOpen={deployModalOpen}
            onClose={() => setDeployModalOpen(false)}
            project={selectedProject}
          />
        </Suspense>
        
        <Suspense fallback={null}>
          <LazyLogsModal
            isOpen={logsModalOpen}
            onClose={() => setLogsModalOpen(false)}
            project={selectedProject}
          />
        </Suspense>
        
        <Suspense fallback={null}>
          <LazyDocsPanel
            isOpen={docsPanelOpen}
            onClose={() => setDocsPanelOpen(false)}
          />
        </Suspense>
        
        <Suspense fallback={null}>
          <LazyCommandPalette
            isOpen={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            projects={projects}
            onSelectProject={(project) => {
              setSelectedProject(project);
              handleTabChange('projects');
            }}
            onAction={handleCommandAction}
          />
        </Suspense>
        
        {projectDetailModalOpen && selectedProject && (
          <Suspense fallback={null}>
            <LazyProjectDetailModal
              onClose={() => setProjectDetailModalOpen(false)}
              project={selectedProject}
              latencyData={[]}
              errorRateData={[]}
              uptimeData={[]}
            />
          </Suspense>
        )}

        <DeploymentToast enabled={true} />
        <Toaster />
      </div>
    </ErrorBoundary>
  );
}
