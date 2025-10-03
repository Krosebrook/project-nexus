import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Sun, Moon, Monitor } from "lucide-react";

interface AppearanceSettingsProps {
  settings: any;
  updateSettings: (updates: any) => void;
  isSaving: boolean;
}

const accentColors = [
  { name: "Blue", value: "blue", class: "bg-blue-500" },
  { name: "Purple", value: "purple", class: "bg-purple-500" },
  { name: "Green", value: "green", class: "bg-green-500" },
  { name: "Red", value: "red", class: "bg-red-500" },
  { name: "Orange", value: "orange", class: "bg-orange-500" },
  { name: "Pink", value: "pink", class: "bg-pink-500" },
  { name: "Teal", value: "teal", class: "bg-teal-500" },
  { name: "Gray", value: "gray", class: "bg-gray-500" },
];

export function AppearanceSettings({ settings, updateSettings }: AppearanceSettingsProps) {
  const currentTheme = settings.theme || "dark";
  const currentAccent = settings.preferences?.accentColor || "blue";
  const currentDensity = settings.preferences?.viewDensity || "comfortable";
  const sidebarExpanded = settings.preferences?.sidebarExpanded ?? true;
  const sidebarIconsOnly = settings.preferences?.sidebarIconsOnly ?? false;

  const handleThemeChange = (theme: string) => {
    updateSettings({ theme });
    
    if (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleAccentChange = (accent: string) => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        accentColor: accent,
      },
    });
  };

  const handleDensityChange = (density: string) => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        viewDensity: density,
      },
    });
  };

  const handleSidebarChange = (key: string, value: boolean) => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">Theme</Label>
          <p className="text-sm text-muted-foreground">Select your preferred theme</p>
        </div>
        <RadioGroup value={currentTheme} onValueChange={handleThemeChange}>
          <div className="grid grid-cols-3 gap-4">
            <div className="relative">
              <RadioGroupItem value="dark" id="theme-dark" className="peer sr-only" />
              <Label
                htmlFor="theme-dark"
                className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
              >
                <Moon className="h-6 w-6" />
                <span className="font-medium">Dark</span>
              </Label>
            </div>
            <div className="relative">
              <RadioGroupItem value="light" id="theme-light" className="peer sr-only" />
              <Label
                htmlFor="theme-light"
                className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
              >
                <Sun className="h-6 w-6" />
                <span className="font-medium">Light</span>
              </Label>
            </div>
            <div className="relative">
              <RadioGroupItem value="system" id="theme-system" className="peer sr-only" />
              <Label
                htmlFor="theme-system"
                className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
              >
                <Monitor className="h-6 w-6" />
                <span className="font-medium">System</span>
              </Label>
            </div>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">Accent Color</Label>
          <p className="text-sm text-muted-foreground">Choose an accent color for highlights</p>
        </div>
        <div className="grid grid-cols-8 gap-3">
          {accentColors.map((color) => (
            <button
              key={color.value}
              onClick={() => handleAccentChange(color.value)}
              className={`h-12 w-12 rounded-lg ${color.class} transition-all hover:scale-110 ${
                currentAccent === color.value ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""
              }`}
              title={color.name}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">View Density</Label>
          <p className="text-sm text-muted-foreground">Adjust spacing and padding</p>
        </div>
        <RadioGroup value={currentDensity} onValueChange={handleDensityChange}>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="compact" id="density-compact" />
              <Label htmlFor="density-compact" className="cursor-pointer">
                Compact - Minimal spacing for maximum content
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="comfortable" id="density-comfortable" />
              <Label htmlFor="density-comfortable" className="cursor-pointer">
                Comfortable - Balanced spacing (recommended)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="spacious" id="density-spacious" />
              <Label htmlFor="density-spacious" className="cursor-pointer">
                Spacious - Extra padding for better readability
              </Label>
            </div>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">Sidebar Settings</Label>
          <p className="text-sm text-muted-foreground">Configure sidebar behavior</p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sidebar-expanded"
              checked={sidebarExpanded}
              onCheckedChange={(checked) => handleSidebarChange("sidebarExpanded", checked as boolean)}
            />
            <Label htmlFor="sidebar-expanded" className="cursor-pointer">
              Always expanded
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sidebar-icons"
              checked={sidebarIconsOnly}
              onCheckedChange={(checked) => handleSidebarChange("sidebarIconsOnly", checked as boolean)}
            />
            <Label htmlFor="sidebar-icons" className="cursor-pointer">
              Show icons only
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}