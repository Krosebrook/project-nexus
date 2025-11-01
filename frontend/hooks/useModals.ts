import { useState, useCallback } from "react";

export function useModals() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snapshotPanelOpen, setSnapshotPanelOpen] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [docsPanelOpen, setDocsPanelOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [projectDetailModalOpen, setProjectDetailModalOpen] = useState(false);

  const closeAllModals = useCallback(() => {
    setCommandPaletteOpen(false);
    setSnapshotPanelOpen(false);
    setDeployModalOpen(false);
    setLogsModalOpen(false);
    setDocsPanelOpen(false);
    setProjectDetailModalOpen(false);
  }, []);

  return {
    settingsOpen,
    setSettingsOpen,
    snapshotPanelOpen,
    setSnapshotPanelOpen,
    deployModalOpen,
    setDeployModalOpen,
    logsModalOpen,
    setLogsModalOpen,
    docsPanelOpen,
    setDocsPanelOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    projectDetailModalOpen,
    setProjectDetailModalOpen,
    closeAllModals,
  };
}
