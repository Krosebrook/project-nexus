import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectsTab } from "@/components/ProjectsTab";
import { AutomationTab } from "@/components/AutomationTab";
import { ObservabilityTab } from "@/components/ObservabilityTab";
import { DeploymentTab } from "@/components/DeploymentTab";
import { FilesTab } from "@/components/FilesTab";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Header } from "@/components/Header";
import backend from "~backend/client";
import type { Project } from "~backend/projects/types";

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState("projects");
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background">
      <Header 
        projects={projects}
        selectedProject={selectedProject}
        onProjectSelect={handleProjectSelect}
      />

      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
            <TabsTrigger value="observability">Observability</TabsTrigger>
            <TabsTrigger value="deployment">Deployment</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-4">
            <ProjectsTab 
              projects={projects}
              selectedProject={selectedProject}
              onProjectSelect={setSelectedProject}
              onProjectUpdate={loadProjects}
            />
          </TabsContent>

          <TabsContent value="automation" className="space-y-4">
            {selectedProject && <AutomationTab project={selectedProject} />}
          </TabsContent>

          <TabsContent value="observability" className="space-y-4">
            {selectedProject && <ObservabilityTab project={selectedProject} />}
          </TabsContent>

          <TabsContent value="deployment" className="space-y-4">
            {selectedProject && <DeploymentTab project={selectedProject} />}
          </TabsContent>

          <TabsContent value="files" className="space-y-4">
            {selectedProject && <FilesTab project={selectedProject} />}
          </TabsContent>
        </Tabs>
      </main>

      <SettingsDialog />
    </div>
  );
}
