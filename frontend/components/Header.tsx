import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Project } from "~backend/projects/types";

interface HeaderProps {
  projects: Project[];
  selectedProject: Project | null;
  onProjectSelect: (project: Project) => void;
}

export function Header({ projects, selectedProject, onProjectSelect }: HeaderProps) {
  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">PROJECT NEXUS</h1>
              <p className="text-sm text-muted-foreground">SRE Command Center</p>
            </div>
            
            <Select 
              value={selectedProject?.id.toString() ?? ""} 
              onValueChange={(id) => {
                const project = projects.find(p => p.id.toString() === id);
                if (project) onProjectSelect(project);
              }}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
