import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface DashboardPreferencesProps {
  settings: any;
  updateSettings: (updates: any) => void;
  isSaving: boolean;
}

export function DashboardPreferences({ settings, updateSettings }: DashboardPreferencesProps) {
  const defaultView = settings.default_view || "projects";
  const refreshInterval = settings.refresh_interval || 30;
  const projectsPerPage = settings.preferences?.projectsPerPage || 12;
  const dateFormat = settings.preferences?.dateFormat || "relative";
  const timeZone = settings.preferences?.timeZone || "auto";

  const handleDefaultViewChange = (value: string) => {
    updateSettings({ default_view: value });
  };

  const handleRefreshIntervalChange = (value: string) => {
    updateSettings({ refresh_interval: parseInt(value) });
  };

  const handleProjectsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(24, Math.max(6, parseInt(e.target.value) || 12));
    updateSettings({
      preferences: {
        ...settings.preferences,
        projectsPerPage: value,
      },
    });
  };

  const handleDateFormatChange = (value: string) => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        dateFormat: value,
      },
    });
  };

  const handleTimeZoneChange = (value: string) => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        timeZone: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="default-view">Default Landing Page</Label>
        <p className="text-sm text-muted-foreground">Choose which page to show when you open the app</p>
        <Select value={defaultView} onValueChange={handleDefaultViewChange}>
          <SelectTrigger id="default-view">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="projects">Projects</SelectItem>
            <SelectItem value="automation">Automation</SelectItem>
            <SelectItem value="deployment">Deployment</SelectItem>
            <SelectItem value="observability">Observability</SelectItem>
            <SelectItem value="files">Files</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="refresh-interval">Auto-Refresh Interval</Label>
        <p className="text-sm text-muted-foreground">How often to refresh data automatically</p>
        <Select value={refreshInterval.toString()} onValueChange={handleRefreshIntervalChange}>
          <SelectTrigger id="refresh-interval">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 seconds</SelectItem>
            <SelectItem value="30">30 seconds</SelectItem>
            <SelectItem value="60">1 minute</SelectItem>
            <SelectItem value="300">5 minutes</SelectItem>
            <SelectItem value="0">Off</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="projects-per-page">Projects Per Page</Label>
        <p className="text-sm text-muted-foreground">Number of projects to display per page (6-24)</p>
        <Input
          id="projects-per-page"
          type="number"
          min={6}
          max={24}
          value={projectsPerPage}
          onChange={handleProjectsPerPageChange}
          className="w-32"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="date-format">Date Format</Label>
        <p className="text-sm text-muted-foreground">How to display dates and times</p>
        <Select value={dateFormat} onValueChange={handleDateFormatChange}>
          <SelectTrigger id="date-format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relative">Relative (2 hours ago)</SelectItem>
            <SelectItem value="absolute">Absolute (Jan 15, 2025 3:42 PM)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="timezone">Time Zone</Label>
        <p className="text-sm text-muted-foreground">Select your preferred time zone</p>
        <Select value={timeZone} onValueChange={handleTimeZoneChange}>
          <SelectTrigger id="timezone">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto-detect</SelectItem>
            <SelectItem value="UTC">UTC</SelectItem>
            <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
            <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
            <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
            <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
            <SelectItem value="Europe/London">London (GMT)</SelectItem>
            <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
            <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
            <SelectItem value="Asia/Shanghai">Shanghai (CST)</SelectItem>
            <SelectItem value="Australia/Sydney">Sydney (AEST)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}