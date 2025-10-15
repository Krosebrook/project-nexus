import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";

interface CreateTestModalProps {
  open: boolean;
  onClose: () => void;
  onCreateTest: (test: {
    name: string;
    description: string;
    project: string;
    promptInput: string;
    expectedOutput: string;
    tags: string[];
  }) => void;
}

export function CreateTestModal({ open, onClose, onCreateTest }: CreateTestModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    project: "",
    promptInput: "",
    expectedOutput: "",
    tags: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Test name is required";
    }
    
    if (!formData.project) {
      newErrors.project = "Project is required";
    }
    
    if (!formData.promptInput.trim()) {
      newErrors.promptInput = "Prompt input is required";
    }
    
    if (formData.promptInput.length > 500) {
      newErrors.promptInput = "Prompt input must be 500 characters or less";
    }
    
    if (!formData.expectedOutput.trim()) {
      newErrors.expectedOutput = "Expected output is required";
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    const tags = formData.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    onCreateTest({
      name: formData.name.trim(),
      description: formData.description.trim(),
      project: formData.project,
      promptInput: formData.promptInput.trim(),
      expectedOutput: formData.expectedOutput.trim(),
      tags,
    });
    
    setFormData({
      name: "",
      description: "",
      project: "",
      promptInput: "",
      expectedOutput: "",
      tags: "",
    });
    setErrors({});
    onClose();
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Test</DialogTitle>
          <DialogDescription>
            Add a new prompt regression test to your test suite
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Test Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g., Bug classification test"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Brief description of what this test validates"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">
              Project <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.project}
              onValueChange={(value) => handleChange("project", value)}
            >
              <SelectTrigger className={errors.project ? "border-destructive" : ""}>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INT-triage-ai">INT-triage-ai</SelectItem>
                <SelectItem value="INT-support-bot">INT-support-bot</SelectItem>
                <SelectItem value="INT-api-gateway">INT-api-gateway</SelectItem>
              </SelectContent>
            </Select>
            {errors.project && (
              <p className="text-xs text-destructive">{errors.project}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="promptInput">
              Prompt Input <span className="text-destructive">*</span>
              <span className="text-xs text-muted-foreground ml-2">
                ({formData.promptInput.length}/500)
              </span>
            </Label>
            <Textarea
              id="promptInput"
              value={formData.promptInput}
              onChange={(e) => handleChange("promptInput", e.target.value)}
              placeholder="Enter the prompt or input text to test..."
              rows={6}
              maxLength={500}
              className={errors.promptInput ? "border-destructive font-mono text-xs" : "font-mono text-xs"}
            />
            {errors.promptInput && (
              <p className="text-xs text-destructive">{errors.promptInput}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expectedOutput">
              Expected Output <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="expectedOutput"
              value={formData.expectedOutput}
              onChange={(e) => handleChange("expectedOutput", e.target.value)}
              placeholder="Enter the expected output or response..."
              rows={6}
              className={errors.expectedOutput ? "border-destructive font-mono text-xs" : "font-mono text-xs"}
            />
            {errors.expectedOutput && (
              <p className="text-xs text-destructive">{errors.expectedOutput}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">
              Tags
              <span className="text-xs text-muted-foreground ml-2">
                (comma-separated: classification, edge-case)
              </span>
            </Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => handleChange("tags", e.target.value)}
              placeholder="classification, edge-case"
            />
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Test
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}