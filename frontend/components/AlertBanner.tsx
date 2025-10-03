import { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Project } from '~backend/projects/types';

interface AlertBannerProps {
  project: Project | null;
  onViewDetails: (project: Project) => void;
}

export function AlertBanner({ project, onViewDetails }: AlertBannerProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    const stored = localStorage.getItem('dismissedAlerts');
    if (stored) {
      setDismissed(new Set(JSON.parse(stored)));
    }
  }, []);

  useEffect(() => {
    if (project && project.status === 'critical' && !dismissed.has(project.id)) {
      setVisible(true);
      const timer = setTimeout(() => {
        handleDismiss();
      }, 15000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [project, dismissed]);

  const handleDismiss = () => {
    if (project) {
      const newDismissed = new Set(dismissed);
      newDismissed.add(project.id);
      setDismissed(newDismissed);
      localStorage.setItem('dismissedAlerts', JSON.stringify([...newDismissed]));
      setVisible(false);
    }
  };

  const handleViewDetails = () => {
    if (project) {
      onViewDetails(project);
      handleDismiss();
    }
  };

  if (!visible || !project) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top duration-300">
      <div className="bg-destructive text-destructive-foreground shadow-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">{project.name}</span>
              <span className="mx-2">—</span>
              <span>Critical status detected: System requires immediate attention</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewDetails}
              className="bg-white text-destructive hover:bg-white/90"
            >
              View Details
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="text-destructive-foreground hover:bg-destructive-foreground/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}