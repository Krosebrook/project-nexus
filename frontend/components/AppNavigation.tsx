import { Home, FolderKanban, Bot, Rocket, Settings, Database } from "lucide-react";
import type { TabValue } from "@/hooks/useNavigation";

interface NavItem {
  id: TabValue;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "automation", label: "Automation", icon: Bot },
  { id: "deployment", label: "Deployment", icon: Rocket },
  { id: "databases", label: "Databases", icon: Database },
  { id: "settings", label: "Settings", icon: Settings },
];

interface AppNavigationProps {
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
}

export function AppNavigation({ activeTab, onTabChange }: AppNavigationProps) {
  return (
    <nav className="p-4 space-y-2">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`
              w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
              ${isActive
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
              }
            `}
            role="tab"
            aria-selected={isActive}
            aria-label={`Navigate to ${item.label}`}
            tabIndex={isActive ? 0 : -1}
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
