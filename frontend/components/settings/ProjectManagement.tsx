import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Upload, Download } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import backend from "~backend/client";

interface Project {
  id: number;
  name: string;
  status: string;
  repository?: string;
}

interface ProjectManagementProps {
  settings: any;
  updateSettings: (updates: any) => void;
  isSaving: boolean;
}

export function ProjectManagement({ }: ProjectManagementProps) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    repository: "",
    healthCheckEndpoint: "",
    documentationUrl: "",
    status: "healthy",
    tags: "",
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await backend.projects.list();
      setProjects(response.projects);
    } catch (error) {
      console.error("Failed to load projects:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load projects",
      });
    }
  };

  const handleAdd = () => {
    setFormData({
      name: "",
      repository: "",
      healthCheckEndpoint: "",
      documentationUrl: "",
      status: "healthy",
      tags: "",
    });
    setIsAddDialogOpen(true);
  };

  const handleEdit = (project: Project) => {
    setSelectedProject(project);
    setFormData({
      name: project.name,
      repository: project.repository || "",
      healthCheckEndpoint: "",
      documentationUrl: "",
      status: project.status,
      tags: "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (project: Project) => {
    setSelectedProject(project);
    setIsDeleteDialogOpen(true);
  };

  const confirmAdd = async () => {
    try {
      await backend.projects.create({
        name: formData.name,
        description: "",
        status: formData.status,
      });
      toast({
        title: "Success",
        description: "Project added successfully",
      });
      setIsAddDialogOpen(false);
      loadProjects();
    } catch (error) {
      console.error("Failed to add project:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add project",
      });
    }
  };

  const confirmEdit = async () => {
    if (!selectedProject) return;
    
    try {
      await backend.projects.update({
        id: selectedProject.id,
        name: formData.name,
        status: formData.status as any,
      });
      toast({
        title: "Success",
        description: "Project updated successfully",
      });
      setIsEditDialogOpen(false);
      loadProjects();
    } catch (error) {
      console.error("Failed to update project:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update project",
      });
    }
  };

  const confirmDelete = async () => {
    if (!selectedProject) return;
    
    try {
      await backend.projects.deleteProject({ id: selectedProject.id });
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      loadProjects();
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete project",
      });
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(projects, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "projects-export.json";
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Success",
      description: "Projects exported successfully",
    });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        toast({
          title: "Import",
          description: `Ready to import ${data.length} projects`,
        });
      } catch (error) {
        console.error("Failed to parse import file:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Invalid JSON file",
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Project List</Label>
          <p className="text-sm text-muted-foreground">Manage all your projects</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              Import
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
            </label>
          </Button>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Project
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Repository</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="font-medium">{project.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      project.status === "healthy"
                        ? "default"
                        : project.status === "warning"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {project.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {project.repository || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(project)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(project)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Project</DialogTitle>
            <DialogDescription>
              Create a new project to track in PROJECT NEXUS
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">Project Name *</Label>
              <Input
                id="add-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Project"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-repository">Repository URL</Label>
              <Input
                id="add-repository"
                value={formData.repository}
                onChange={(e) => setFormData({ ...formData, repository: e.target.value })}
                placeholder="https://github.com/user/repo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-health">Health Check Endpoint</Label>
              <Input
                id="add-health"
                value={formData.healthCheckEndpoint}
                onChange={(e) => setFormData({ ...formData, healthCheckEndpoint: e.target.value })}
                placeholder="https://api.example.com/health"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-docs">Documentation URL</Label>
              <Input
                id="add-docs"
                value={formData.documentationUrl}
                onChange={(e) => setFormData({ ...formData, documentationUrl: e.target.value })}
                placeholder="https://docs.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-status">Initial Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger id="add-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="healthy">Healthy</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-tags">Tags (comma-separated)</Label>
              <Input
                id="add-tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="production, api, frontend"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAdd} disabled={!formData.name}>
              Add Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update project information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Project Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-repository">Repository URL</Label>
              <Input
                id="edit-repository"
                value={formData.repository}
                onChange={(e) => setFormData({ ...formData, repository: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="healthy">Healthy</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedProject?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}