import { useState, useEffect } from "react";
import { Home, FolderKanban, Bot, Rocket, Settings, Menu, X } from "lucide-react";
import { Dashboard } from "@/components/Dashboard";
import { ProjectsTab } from "@/components/ProjectsTab";
import { AutomationTab } from "@/components/AutomationTab";
import { DeploymentTab } from "@/components/DeploymentTab";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import backend from "~backend/client";
import type { Project } from "~backend/projects/types";

type TabValue = "dashboard" | "projects" | "automation" | "deployment" | "settings";

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>("dashboard");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

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
    setActiveTab("projects");
  };

  const handleTabChange = (tab: TabValue) => {
    if (tab === "settings") {
      setSettingsOpen(true);
    } else {
      setActiveTab(tab);
      setSidebarOpen(false);
    }
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

  const navItems = [
    { id: "dashboard" as const, label: "Dashboard", icon: Home },
    { id: "projects" as const, label: "Projects", icon: FolderKanban },
    { id: "automation" as const, label: "Automation", icon: Bot },
    { id: "deployment" as const, label: "Deployment", icon: Rocket },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <ErrorBoundary>
      <div className="dark min-h-screen bg-[#0a0a0a] text-foreground">
        <nav className="border-b border-zinc-800 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="flex items-center justify-between px-4 h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X /> : <Menu />}
              </Button>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                PROJECT NEXUS
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-medium">
                UN
              </div>
            </div>
          </div>
        </nav>

        <div className="flex">
          <aside
            className={`
              fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-black/30 border-r border-zinc-800
              transition-transform duration-300 ease-in-out z-40
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}
          >
            <nav className="p-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                      ${isActive
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-30 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <main className="flex-1 p-6 lg:p-8">
            {activeTab === "dashboard" && (
              <ErrorBoundary>
                <Dashboard projects={projects} onProjectSelect={handleProjectSelect} />
              </ErrorBoundary>
            )}

            {activeTab === "projects" && (
              <ErrorBoundary>
                <ProjectsTab
                  projects={projects}
                  selectedProject={selectedProject}
                  onProjectSelect={setSelectedProject}
                  onProjectUpdate={loadProjects}
                />
              </ErrorBoundary>
            )}

            {activeTab === "automation" && (
              <ErrorBoundary>
                {selectedProject ? (
                  <AutomationTab project={selectedProject} />
                ) : (
                  <div className="text-center text-zinc-500 py-12">
                    Select a project to view automation settings
                  </div>
                )}
              </ErrorBoundary>
            )}

            {activeTab === "deployment" && (
              <ErrorBoundary>
                {selectedProject ? (
                  <DeploymentTab project={selectedProject} />
                ) : (
                  <div className="text-center text-zinc-500 py-12">
                    Select a project to view deployment options
                  </div>
                )}
              </ErrorBoundary>
            )}
          </main>
        </div>

        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
    </ErrorBoundary>
  );
}
