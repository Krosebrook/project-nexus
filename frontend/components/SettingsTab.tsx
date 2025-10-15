import { useState, useEffect } from "react";
import { Search, Palette, Layout, Bell, Link2, FolderKanban, Database, Keyboard, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/use-toast";
import backend from "~backend/client";
import type { UserPreferences } from "~backend/settings/types";
import { AppearanceSettings } from "./settings/AppearanceSettings";
import { DashboardPreferences } from "./settings/DashboardPreferences";
import { NotificationsSettings } from "./settings/NotificationsSettings";
import { IntegrationsSettings } from "./settings/IntegrationsSettings";
import { ProjectManagement } from "./settings/ProjectManagement";
import { DataPrivacy } from "./settings/DataPrivacy";
import { KeyboardShortcuts } from "./settings/KeyboardShortcuts";
import { AboutHelp } from "./settings/AboutHelp";

interface SettingsState extends Partial<UserPreferences> {
  preferences?: Record<string, any>;
}

export function SettingsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState<SettingsState>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();

  const sections = [
    { id: "appearance", label: "Appearance", icon: Palette, component: AppearanceSettings },
    { id: "dashboard", label: "Dashboard Preferences", icon: Layout, component: DashboardPreferences },
    { id: "notifications", label: "Notifications", icon: Bell, component: NotificationsSettings },
    { id: "integrations", label: "Integrations", icon: Link2, component: IntegrationsSettings },
    { id: "projects", label: "Project Management", icon: FolderKanban, component: ProjectManagement },
    { id: "data", label: "Data & Privacy", icon: Database, component: DataPrivacy },
    { id: "shortcuts", label: "Keyboard Shortcuts", icon: Keyboard, component: KeyboardShortcuts },
    { id: "about", label: "About & Help", icon: Info, component: AboutHelp },
  ];

  const filteredSections = sections.filter((section) =>
    section.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const loadSettings = async () => {
    try {
      const response = await backend.settings.get();
      setSettings(response.settings);
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load settings",
      });
    }
  };

  const saveSettings = async (updates: Partial<SettingsState>) => {
    setIsSaving(true);
    setHasUnsavedChanges(false);

    try {
      const updatedSettings = await backend.settings.update(updates);
      setSettings(updatedSettings);
      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
      });
      setHasUnsavedChanges(true);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSettings = (updates: Partial<SettingsState>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
    
    const timeoutId = setTimeout(() => {
      saveSettings(updates);
    }, 1000);

    return () => clearTimeout(timeoutId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">
            Customize your PROJECT NEXUS experience
          </p>
        </div>
        {isSaving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
            Saving...
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search settings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-4">
        {filteredSections.map((section) => (
          <Collapsible key={section.id} defaultOpen={section.id === "appearance"}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-3">
                <section.icon className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold">{section.label}</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-x border-b rounded-b-lg bg-card p-6">
              <section.component
                settings={settings}
                updateSettings={updateSettings}
                isSaving={isSaving}
              />
            </CollapsibleContent>
          </Collapsible>
        ))}

        {filteredSections.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No settings found matching "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}