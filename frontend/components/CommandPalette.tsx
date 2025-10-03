import { useState, useEffect, useRef } from 'react';
import { Search, Rocket, FileText, Save, Terminal, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Project } from '~backend/projects/types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onAction: (action: string, project?: Project) => void;
}

interface CommandItem {
  id: string;
  type: 'project' | 'action' | 'recent';
  title: string;
  subtitle?: string;
  icon: any;
  data?: any;
}

export function CommandPalette({ isOpen, onClose, projects, onSelectProject, onAction }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentActions, setRecentActions] = useState<CommandItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      loadRecentActions();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const loadRecentActions = () => {
    const stored = localStorage.getItem('recentActions');
    if (stored) {
      setRecentActions(JSON.parse(stored));
    }
  };

  const saveRecentAction = (item: CommandItem) => {
    const recent = [item, ...recentActions.filter(r => r.id !== item.id)].slice(0, 5);
    setRecentActions(recent);
    localStorage.setItem('recentActions', JSON.stringify(recent));
  };

  const actions: CommandItem[] = [
    {
      id: 'deploy',
      type: 'action',
      title: 'Deploy Project',
      subtitle: 'Deploy to staging or production',
      icon: Rocket
    },
    {
      id: 'save-context',
      type: 'action',
      title: 'Save Context',
      subtitle: 'Save current work context',
      icon: Save
    },
    {
      id: 'view-logs',
      type: 'action',
      title: 'View Logs',
      subtitle: 'View application logs',
      icon: Terminal
    },
    {
      id: 'docs',
      type: 'action',
      title: 'Open Documentation',
      subtitle: 'View documentation',
      icon: FileText
    }
  ];

  const projectItems: CommandItem[] = projects.map(p => ({
    id: `project-${p.id}`,
    type: 'project',
    title: p.name,
    subtitle: p.status,
    icon: FileText,
    data: p
  }));

  const allItems = query
    ? [...actions, ...projectItems].filter(item =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle?.toLowerCase().includes(query.toLowerCase())
      )
    : [...recentActions, ...actions, ...projectItems];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % allItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % allItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(allItems[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelect = (item: CommandItem) => {
    saveRecentAction(item);
    if (item.type === 'project') {
      onSelectProject(item.data);
    } else {
      onAction(item.id);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-background border rounded-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 p-4 border-b">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {!query && recentActions.length > 0 && (
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
              Recent
            </div>
          )}

          {allItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No results found
            </div>
          ) : (
            allItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  {item.type === 'recent' && <Clock className="w-4 h-4 text-muted-foreground" />}
                  {item.type !== 'recent' && <Icon className="w-4 h-4" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.title}</div>
                    {item.subtitle && (
                      <div className={`text-sm truncate ${isSelected ? 'opacity-90' : 'text-muted-foreground'}`}>
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/50 text-xs text-muted-foreground">
          <div className="flex gap-4">
            <span><kbd className="px-1.5 py-0.5 bg-background border rounded">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 bg-background border rounded">Enter</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 bg-background border rounded">Esc</kbd> Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}