import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings } from "lucide-react";
import backend from "~backend/client";
import type { UserPreferences } from "~backend/settings/types";

export function SettingsDialog() {
  const [settings, setSettings] = useState<UserPreferences | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [defaultView, setDefaultView] = useState("projects");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { settings } = await backend.settings.get();
      setSettings(settings);
      setRefreshInterval(settings.refresh_interval);
      setDefaultView(settings.default_view);
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const saveSettings = async () => {
    try {
      await backend.settings.update({
        refresh_interval: refreshInterval,
        default_view: defaultView,
      });
      await loadSettings();
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="fixed bottom-6 right-6">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your preferences and defaults
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="refresh">Auto-refresh interval (seconds)</Label>
            <Input
              id="refresh"
              type="number"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              min={10}
              max={300}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="view">Default view</Label>
            <Select value={defaultView} onValueChange={setDefaultView}>
              <SelectTrigger id="view">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="projects">Projects</SelectItem>
                <SelectItem value="automation">Automation</SelectItem>
                <SelectItem value="observability">Observability</SelectItem>
                <SelectItem value="deployment">Deployment</SelectItem>
                <SelectItem value="files">Files</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={saveSettings} className="w-full">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
