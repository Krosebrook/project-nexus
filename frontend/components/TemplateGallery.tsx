import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import backend from '~backend/client';
import { useToast } from './ui/use-toast';
import { Loader2, FileCode, Workflow, Database, Globe, Boxes, TrendingUp } from 'lucide-react';

interface DeploymentTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  templateType: string;
  config: Record<string, any>;
  stages: Array<{ name: string; description: string }>;
  variables: Array<{
    name: string;
    description: string;
    required?: boolean;
    default?: string;
  }>;
  diagramData?: Record<string, any>;
  isBuiltIn: boolean;
  usageCount: number;
}

interface TemplateGalleryProps {
  onSelectTemplate: (templateId: number, variables: Record<string, string>) => void;
}

export function TemplateGallery({ onSelectTemplate }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<DeploymentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<DeploymentTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [showDialog, setShowDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await backend.deployments.listTemplates();
      setTemplates(response.templates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load deployment templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getTemplateIcon = (templateType: string) => {
    switch (templateType) {
      case 'simple':
        return <FileCode className="h-6 w-6" />;
      case 'blue-green':
      case 'canary':
        return <Workflow className="h-6 w-6" />;
      case 'db-migration':
        return <Database className="h-6 w-6" />;
      case 'multi-region':
        return <Globe className="h-6 w-6" />;
      default:
        return <Boxes className="h-6 w-6" />;
    }
  };

  const getCategoryColor = (category: string): "default" | "secondary" | "outline" => {
    switch (category) {
      case 'basic':
        return 'secondary';
      case 'advanced':
        return 'default';
      default:
        return 'outline';
    }
  };

  const handleTemplateClick = (template: DeploymentTemplate) => {
    setSelectedTemplate(template);
    
    const initialValues: Record<string, string> = {};
    template.variables.forEach((variable) => {
      if (variable.default) {
        initialValues[variable.name] = variable.default;
      }
    });
    setVariableValues(initialValues);
    setShowDialog(true);
  };

  const handleUseTemplate = () => {
    if (!selectedTemplate) return;

    const missingRequired = selectedTemplate.variables
      .filter((v) => v.required && !variableValues[v.name])
      .map((v) => v.name);

    if (missingRequired.length > 0) {
      toast({
        title: 'Missing Required Fields',
        description: `Please fill in: ${missingRequired.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    onSelectTemplate(selectedTemplate.id, variableValues);
    setShowDialog(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, DeploymentTemplate[]>);

  return (
    <>
      <div className="space-y-8">
        {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
          <div key={category}>
            <h3 className="text-lg font-semibold mb-4 capitalize">{category} Templates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryTemplates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleTemplateClick(template)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        {getTemplateIcon(template.templateType)}
                      </div>
                      <Badge variant={getCategoryColor(template.category)}>
                        {template.category}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Workflow className="h-4 w-4" />
                        <span>{template.stages.length} stages</span>
                      </div>
                      {template.usageCount > 0 && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <TrendingUp className="h-4 w-4" />
                          <span>Used {template.usageCount} times</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedTemplate && (
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTemplate.name}</DialogTitle>
              <DialogDescription>{selectedTemplate.description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Pipeline Stages</h4>
                <div className="space-y-2">
                  {selectedTemplate.stages.map((stage, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{stage.name}</p>
                        <p className="text-xs text-muted-foreground">{stage.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Configuration</h4>
                <div className="space-y-4">
                  {selectedTemplate.variables.map((variable) => (
                    <div key={variable.name} className="space-y-2">
                      <Label htmlFor={variable.name}>
                        {variable.description}
                        {variable.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      <Input
                        id={variable.name}
                        placeholder={variable.default || `Enter ${variable.name}`}
                        value={variableValues[variable.name] || ''}
                        onChange={(e) =>
                          setVariableValues((prev) => ({
                            ...prev,
                            [variable.name]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUseTemplate}>Use Template</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
