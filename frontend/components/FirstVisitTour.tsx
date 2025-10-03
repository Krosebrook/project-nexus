import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ArrowRight, ArrowLeft } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

interface TourStep {
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

const tourSteps: TourStep[] = [
  {
    target: "[data-tour='dashboard']",
    title: "Welcome to Project Nexus",
    description: "Your unified dashboard for managing deployments, tests, and project health across all your services.",
    position: "bottom"
  },
  {
    target: "[data-tour='projects']",
    title: "Project Management",
    description: "View all your projects with real-time metrics, health status, and deployment history.",
    position: "bottom"
  },
  {
    target: "[data-tour='quick-actions']",
    title: "Quick Actions",
    description: "Deploy, run tests, or save your context with just one click.",
    position: "left"
  },
  {
    target: "[data-tour='context']",
    title: "Context Snapshots",
    description: "Save and restore your development context to quickly resume work where you left off.",
    position: "bottom"
  },
  {
    target: "[data-tour='settings']",
    title: "Settings & Preferences",
    description: "Customize your experience with themes, notifications, and project configurations.",
    position: "left"
  }
];

export function FirstVisitTour() {
  const [hasCompletedTour, setHasCompletedTour] = useLocalStorage("tour-completed", false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!hasCompletedTour) {
      setTimeout(() => setIsVisible(true), 1000);
    }
  }, [hasCompletedTour]);

  useEffect(() => {
    if (isVisible && currentStep < tourSteps.length) {
      const step = tourSteps[currentStep];
      const element = document.querySelector(step.target);
      
      if (element) {
        const rect = element.getBoundingClientRect();
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;
        
        let top = rect.bottom + scrollY + 16;
        let left = rect.left + scrollX;
        
        if (step.position === "top") {
          top = rect.top + scrollY - 200;
        } else if (step.position === "left") {
          top = rect.top + scrollY;
          left = rect.left + scrollX - 320;
        } else if (step.position === "right") {
          top = rect.top + scrollY;
          left = rect.right + scrollX + 16;
        }
        
        setPosition({ top, left });
        
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentStep, isVisible]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    setHasCompletedTour(true);
    setIsVisible(false);
  };

  const handleComplete = () => {
    setHasCompletedTour(true);
    setIsVisible(false);
  };

  if (!isVisible || currentStep >= tourSteps.length) return null;

  const step = tourSteps[currentStep];

  return (
    <>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40" onClick={handleSkip} />
      
      <Card 
        className="fixed z-50 w-80 p-6 shadow-xl"
        style={{ top: `${position.top}px`, left: `${position.left}px` }}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="h-8 w-8 p-0 -mt-2 -mr-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              Step {currentStep + 1} of {tourSteps.length}
            </div>
            
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  className="gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back
                </Button>
              )}
              <Button onClick={handleNext} size="sm" className="gap-1">
                {currentStep === tourSteps.length - 1 ? "Finish" : "Next"}
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}