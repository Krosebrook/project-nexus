import { useState, useCallback } from "react";

export type TabValue = "dashboard" | "projects" | "automation" | "deployment" | "databases" | "settings";

export function useNavigation(initialTab: TabValue = "dashboard") {
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleTabChange = useCallback((tab: TabValue) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return {
    activeTab,
    sidebarOpen,
    handleTabChange,
    toggleSidebar,
    closeSidebar,
  };
}
