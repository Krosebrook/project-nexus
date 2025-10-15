import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RotateCcw } from "lucide-react";

interface KeyboardShortcutsProps {
  settings: any;
  updateSettings: (updates: any) => void;
  isSaving: boolean;
}

interface Shortcut {
  action: string;
  shortcut: string;
  category: string;
}

const defaultShortcuts: Shortcut[] = [
  { action: "Open Command Palette", shortcut: "Cmd+K", category: "Global" },
  { action: "Search Projects", shortcut: "Cmd+P", category: "Global" },
  { action: "Open Settings", shortcut: "Cmd+,", category: "Global" },
  { action: "Toggle Sidebar", shortcut: "Cmd+B", category: "Global" },
  { action: "Go to Dashboard", shortcut: "G then D", category: "Navigation" },
  { action: "Go to Projects", shortcut: "G then P", category: "Navigation" },
  { action: "Go to Automation", shortcut: "G then A", category: "Navigation" },
  { action: "Go to Deployment", shortcut: "G then E", category: "Navigation" },
  { action: "Go to Observability", shortcut: "G then O", category: "Navigation" },
  { action: "Go to Files", shortcut: "G then F", category: "Navigation" },
  { action: "Create New Project", shortcut: "Cmd+N", category: "Actions" },
  { action: "Run Tests", shortcut: "Cmd+T", category: "Actions" },
  { action: "Deploy", shortcut: "Cmd+D", category: "Actions" },
  { action: "Refresh Data", shortcut: "Cmd+R", category: "Actions" },
  { action: "Save Changes", shortcut: "Cmd+S", category: "Actions" },
  { action: "Undo", shortcut: "Cmd+Z", category: "Actions" },
  { action: "Redo", shortcut: "Cmd+Shift+Z", category: "Actions" },
];

export function KeyboardShortcuts({ settings, updateSettings }: KeyboardShortcutsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  
  const customShortcuts = settings.preferences?.keyboardShortcuts || {};
  const shortcuts = defaultShortcuts.map((s) => ({
    ...s,
    shortcut: customShortcuts[s.action] || s.shortcut,
  }));

  const filteredShortcuts = shortcuts.filter(
    (s) =>
      s.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.shortcut.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = Array.from(new Set(shortcuts.map((s) => s.category)));

  const handleEdit = (action: string, currentShortcut: string) => {
    setEditingAction(action);
    setEditingValue(currentShortcut);
  };

  const handleSave = (action: string) => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        keyboardShortcuts: {
          ...customShortcuts,
          [action]: editingValue,
        },
      },
    });
    setEditingAction(null);
    setEditingValue("");
  };

  const handleCancel = () => {
    setEditingAction(null);
    setEditingValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, action: string) => {
    e.preventDefault();
    
    const keys: string[] = [];
    if (e.ctrlKey || e.metaKey) keys.push("Cmd");
    if (e.shiftKey) keys.push("Shift");
    if (e.altKey) keys.push("Alt");
    
    const key = e.key;
    if (!["Control", "Meta", "Shift", "Alt"].includes(key)) {
      keys.push(key.length === 1 ? key.toUpperCase() : key);
    }
    
    if (keys.length > 0) {
      const shortcut = keys.join("+");
      setEditingValue(shortcut);
    }
  };

  const resetShortcuts = () => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        keyboardShortcuts: {},
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Keyboard Shortcuts</Label>
          <p className="text-sm text-muted-foreground">
            Customize keyboard shortcuts for faster navigation
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetShortcuts}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset All
        </Button>
      </div>

      <div>
        <Input
          placeholder="Search shortcuts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="space-y-6">
        {categories.map((category) => {
          const categoryShortcuts = filteredShortcuts.filter((s) => s.category === category);
          if (categoryShortcuts.length === 0) return null;

          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{category}</Badge>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Shortcut</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryShortcuts.map((shortcut) => (
                      <TableRow key={shortcut.action}>
                        <TableCell className="font-medium">{shortcut.action}</TableCell>
                        <TableCell>
                          {editingAction === shortcut.action ? (
                            <Input
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, shortcut.action)}
                              placeholder="Press keys..."
                              className="w-48"
                              autoFocus
                            />
                          ) : (
                            <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded">
                              {shortcut.shortcut}
                            </kbd>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingAction === shortcut.action ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSave(shortcut.action)}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancel}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(shortcut.action, shortcut.shortcut)}
                            >
                              Edit
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })}

        {filteredShortcuts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No shortcuts found matching "{searchQuery}"
          </div>
        )}
      </div>

      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          <strong>Tip:</strong> Click "Edit" next to any shortcut and press your desired key
          combination to customize it. The shortcut will be recorded automatically.
        </p>
      </div>
    </div>
  );
}