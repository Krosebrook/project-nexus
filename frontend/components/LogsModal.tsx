import { useState, useEffect, useRef } from 'react';
import { X, Download, Search, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import backend from '~backend/client';
import type { Project } from '~backend/projects/types';
import type { LogEntry } from '~backend/deployments/types';

interface LogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

export function LogsModal({ isOpen, onClose, project }: LogsModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('1h');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && project) {
      loadLogs();
    }
  }, [isOpen, project, level, timeRange]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = logs.filter(log =>
        log.message.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredLogs(filtered);
    } else {
      setFilteredLogs(logs);
    }
  }, [searchQuery, logs]);

  const loadLogs = async () => {
    if (!project) return;
    try {
      const result = await backend.deployments.logs({
        project_id: project.id,
        level: level === 'all' ? undefined : level,
        time_range: timeRange
      });
      setLogs(result.logs);
      setFilteredLogs(result.logs);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  const handleDownload = () => {
    const logText = filteredLogs
      .map(log => `[${new Date(log.timestamp).toISOString()}] ${log.message}`)
      .join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.name}-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLevelColor = (level: string) => {
    const levelLower = level.toLowerCase();
    if (levelLower.includes('error')) return 'text-red-500';
    if (levelLower.includes('warning')) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  const highlightSearchTerm = (text: string, search: string) => {
    if (!search) return text;
    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === search.toLowerCase() ? (
        <span key={i} className="bg-yellow-300 dark:bg-yellow-600 text-black px-0.5">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-6xl h-[90vh] bg-background border rounded-lg shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Logs: {project.name}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex items-center gap-4 p-4 border-b flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>

          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last 1h</SelectItem>
              <SelectItem value="6h">Last 6h</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7d</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch checked={autoScroll} onCheckedChange={setAutoScroll} id="autoscroll" />
            <label htmlFor="autoscroll" className="text-sm">Auto-scroll</label>
          </div>

          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>

        <div
          ref={logsContainerRef}
          className="flex-1 overflow-y-auto bg-black text-green-400 p-4 font-mono text-sm"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No logs found matching your filters
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div key={index} className="mb-1 hover:bg-gray-900 px-2 py-1 rounded">
                <span className="text-gray-500">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`ml-3 ${getLevelColor(log.level)}`}>
                  {highlightSearchTerm(log.message, searchQuery)}
                </span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>

        <div className="p-3 border-t bg-muted/50 text-sm text-muted-foreground">
          Showing {filteredLogs.length} of {logs.length} log entries
        </div>
      </div>
    </div>
  );
}